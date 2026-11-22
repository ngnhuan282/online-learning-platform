"""Verify consolidated V1 migrations + comprehensive seed (>=15 rows per business table)
against disposable MySQL 8.4 and real service JARs.

Prerequisites: Docker, Python 3, `mvn -f backend/pom.xml verify`, and the project's
local auth/course/learning/payment/ai Docker images (used only as Java runtimes).
No repository .env values or existing databases are read or modified.
"""

import json
import os
from pathlib import Path
import secrets
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
RUN = 'olp-seed-check-' + uuid4().hex[:10]
MYSQL = RUN + '-mysql'
SERVICES = {'auth': 8081, 'course': 8082, 'learning': 8083, 'payment': 8084, 'ai': 8085}

EXPECTED_COUNTS = {
    # auth_db (users includes 2 unrelated pre-existing rows inserted during verification)
    'auth_db.roles': 2,
    'auth_db.permissions': 54,
    'auth_db.role_permissions': 54,
    'auth_db.users': 20,
    'auth_db.user_roles': 19,
    'auth_db.refresh_tokens': 18,
    'auth_db.admin_audit_logs': 16,
    'auth_db.user_external_identities': 15,
    'auth_db.google_link_intents': 15,
    'auth_db.oauth_login_codes': 15,
    'auth_db.password_reset_tokens': 15,
    'auth_db.password_reset_rate_limits': 15,
    # course_db
    'course_db.categories': 15,
    'course_db.courses': 18,
    'course_db.sections': 36,
    'course_db.lessons': 54,
    'course_db.lesson_resources': 24,
    'course_db.reviews': 33,
    # learning_db
    'learning_db.engagement_settings': 1,
    'learning_db.learning_admin_actor_locks': 0,
    'learning_db.enrollments': 20,
    'learning_db.payment_enrollment_receipts': 16,
    'learning_db.lesson_progress': 26,
    'learning_db.quizzes': 16,
    'learning_db.quiz_questions': 32,
    'learning_db.quiz_options': 128,
    'learning_db.quiz_attempts': 18,
    'learning_db.quiz_answers': 34,
    'learning_db.notifications': 20,
    'learning_db.learner_profiles': 18,
    'learning_db.learning_xp_events': 26,
    'learning_db.learning_activity_days': 25,
    'learning_db.learner_rewards': 20,
    'learning_db.community_topics': 15,
    'learning_db.community_posts': 18,
    'learning_db.community_comments': 24,
    'learning_db.shop_items': 15,
    'learning_db.shop_inventory': 28,
    'learning_db.shop_purchases': 18,
    'learning_db.learning_frozen_days': 16,
    'learning_db.pro_memberships': 15,
    'learning_db.pro_grants': 18,
    'learning_db.pro_activation_codes': 16,
    'learning_db.pro_activation_attempts': 15,
    'learning_db.engagement_reward_rules': 15,
    'learning_db.learner_admin_adjustments': 15,
    'learning_db.learning_admin_audit': 16,
    'learning_db.gem_topup_receipts': 15,
    'learning_db.toeic_attempts': 16,
    'learning_db.toeic_lesson_progress': 16,
    'learning_db.toeic_notes': 18,
    'learning_db.toeic_media': 15,
    'learning_db.dictation_audio': 15,
    'learning_db.dictation_exercises': 15,
    'learning_db.dictation_revisions': 15,
    'learning_db.dictation_attempts': 16,
    'learning_db.dictation_responses': 24,
    'learning_db.dictation_workbook_imports': 15,
    'learning_db.dictation_workbook_sync': 15,
    'learning_db.dictation_workbook_sources': 15,
    # payment_db
    'payment_db.pro_plans': 15,
    'payment_db.orders': 36,
    'payment_db.order_items': 36,
    'payment_db.payments': 36,
    'payment_db.payment_transactions': 36,
    'payment_db.payment_admin_audit': 15,
    # ai_db
    'ai_db.ai_conversations': 16,
    'ai_db.ai_messages': 32,
    'ai_db.ai_usage_logs': 16,
    'ai_db.ai_daily_usage': 16,
}

SYSTEM_TABLES = {
    'auth_db.roles',
    'learning_db.engagement_settings',
    'learning_db.learning_admin_actor_locks',
}

password = secrets.token_hex(24)
environment = dict(os.environ, MYSQL_ROOT_PASSWORD=password, JWT_SECRET=secrets.token_hex(32),
                   INTERNAL_SERVICE_TOKEN=secrets.token_hex(32))
for service in SERVICES:
    environment[service.upper() + '_DB_PASSWORD'] = password
containers = []
network_created = False
origins = {}


def docker(*args, input=None, check=True):
    result = subprocess.run(['docker', *args], input=input, text=True, encoding='utf-8',
                            capture_output=True, env=environment, timeout=300)
    if check and result.returncode:
        detail = (result.stdout + result.stderr).replace(password, '[redacted]')
        raise RuntimeError(detail.replace(environment['JWT_SECRET'], '[redacted]'))
    return result


def sql(statement, check=True):
    return docker('exec', '-i', MYSQL, 'sh', '-c',
                  'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --batch --skip-column-names --default-character-set=utf8mb4',
                  input=statement, check=check)


def count(table, condition='1=1'):
    return int(sql(f'SELECT COUNT(*) FROM {table} WHERE {condition};').stdout.strip())


def api(service, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = Request(origins[service] + path, headers=headers,
                      data=None if body is None else json.dumps(body).encode())
    with urlopen(request, timeout=5) as response:
        return json.load(response)


def wait_until(predicate, description, seconds=150):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            if predicate():
                return
        except (URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(1)
    raise AssertionError('Timed out: ' + description)


def seed(check=True):
    return sql((ROOT / 'infra/mysql/seed-data.sql').read_text(encoding='utf-8'), check=check)


def histories():
    return '\n'.join(sql(f'SELECT version, checksum, success FROM {service}_db.flyway_schema_history ORDER BY installed_rank;').stdout
                     for service in SERVICES)


def verify():
    global network_created
    jars = {}
    for service in SERVICES:
        jars[service] = ROOT / f'backend/{service}-service/target/{service}-service-0.0.1-SNAPSHOT.jar'
        assert jars[service].is_file(), 'Build backend first: ' + str(jars[service])
        docker('image', 'inspect', f'online-learning-platform-{service}-service:latest')
    docker('network', 'create', RUN)
    network_created = True
    args = ['run', '-d', '--name', MYSQL, '--network', RUN, '--network-alias', 'mysql', '--memory', '768m',
            '--tmpfs', '/var/lib/mysql', '-e', 'MYSQL_ROOT_PASSWORD']
    for service in SERVICES:
        args += ['-e', service.upper() + '_DB_PASSWORD']
    for local, remote in [('init.sql', '01-databases.sql'), ('02-users.sh', '02-users.sh')]:
        args += ['--mount', f'type=bind,source={ROOT / "infra/mysql" / local},target=/docker-entrypoint-initdb.d/{remote},readonly']
    docker(*args, 'mysql:8.4')
    containers.append(MYSQL)
    wait_until(lambda: docker('exec', MYSQL, 'sh', '-c',
               'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql -h127.0.0.1 -uroot -Nse "SELECT 1"', check=False).returncode == 0,
               'MySQL initialization')
    print('MySQL initialized with project grants; starting 5 service V1 migrations.', flush=True)

    for service, port in SERVICES.items():
        name = RUN + '-' + service
        args = ['run', '-d', '--name', name, '--network', RUN, '--memory', '640m',
                '-p', f'127.0.0.1::{port}', '-e', 'JWT_SECRET', '-e', 'INTERNAL_SERVICE_TOKEN',
                '-e', f'COURSE_SERVICE_URL=http://{RUN}-course:8082',
                '-e', f'LEARNING_SERVICE_URL=http://{RUN}-learning:8083',
                '-e', f'{service.upper()}_DB_PASSWORD',
                '-e', f'{service.upper()}_DB_URL=jdbc:mysql://mysql:3306/{service}_db',
                '--mount', f'type=bind,source={jars[service]},target=/tmp/seed-check.jar,readonly',
                '--entrypoint', 'java', f'online-learning-platform-{service}-service:latest',
                '-Xms32m', '-Xmx192m', '-XX:MaxMetaspaceSize=160m',
                '-XX:ReservedCodeCacheSize=48m', '-XX:ActiveProcessorCount=2',
                '-jar', '/tmp/seed-check.jar']
        docker(*args)
        containers.append(name)
        origins[service] = 'http://' + docker('port', name, str(port)).stdout.strip()
        wait_until(lambda s=service: api(s, '/actuator/health')['status'] == 'UP', service + ' migration/health')
    for service in SERVICES:
        assert count(f'{service}_db.flyway_schema_history', "type='SQL' AND success=1") == 1, service
    before = histories()
    print('All five services ran consolidated V1 migrations and passed Hibernate validation.', flush=True)

    # Existing accounts occupy the old hard-coded IDs. The requested admin is ID 22.
    sql("""INSERT INTO auth_db.users
        (id,email,password_hash,full_name,status,created_at,updated_at) VALUES
        (1,'existing-one@example.com','existing-hash','Existing one','LOCKED',NOW(),NOW()),
        (2,'existing-two@example.com','existing-hash','Existing two','ACTIVE',NOW(),NOW()),
        (22,'admin@gmail.com','before-seed-hash','Existing admin profile','LOCKED',NOW(),NOW());""")

    # A category collision must roll back credentials and inserts across databases.
    sql("INSERT INTO course_db.categories (id,name,slug,created_at,updated_at) VALUES (1,'Existing category','existing-category',NOW(),NOW());")
    failure = seed(check=False)
    assert failure.returncode != 0 and 'Seed ID collision' in failure.stderr
    assert count('auth_db.users') == 3
    assert count('auth_db.users', "id=22 AND status='LOCKED' AND password_hash='before-seed-hash'") == 1
    assert count('auth_db.user_roles') == 0
    assert count('course_db.categories', "slug='existing-category'") == 1
    sql("DELETE FROM course_db.categories WHERE id=1 AND slug='existing-category';")

    # A conflicting category name at another ID must also abort, without overwriting it.
    sql("INSERT INTO course_db.categories (id,name,slug,created_at,updated_at) VALUES (42,'Luyện thi IELTS','existing-ielts-category',NOW(),NOW());")
    failure = seed(check=False)
    assert failure.returncode != 0 and 'Seed natural key collision' in failure.stderr
    assert count('auth_db.users') == 3
    assert count('course_db.categories', "id=42 AND slug='existing-ielts-category'") == 1
    sql("DELETE FROM course_db.categories WHERE id=42 AND slug='existing-ielts-category';")

    seed()
    for table, expected in EXPECTED_COUNTS.items():
        actual = count(table)
        assert actual == expected, f'{table}: expected {expected}, got {actual}'
        if table not in SYSTEM_TABLES:
            assert actual >= 15, f'{table} must have >=15 rows, got {actual}'
    # toeic_exams has 15 seed exams + any bundled ETS collections loaded by ToeicSeedConfig
    assert count('learning_db.toeic_exams') >= 15
    assert count('auth_db.refresh_tokens', 'revoked_at IS NOT NULL AND expires_at < NOW() AND session_id IS NOT NULL') == 18
    assert count('auth_db.users', "id=22 AND email='admin@gmail.com' AND full_name='Existing admin profile'") == 1
    assert count('auth_db.users', "id IN (1,2) AND password_hash='existing-hash'") == 2

    # Re-running preserves edited profiles, unrelated users and every row count.
    sql("UPDATE auth_db.users SET full_name='Edited learner profile' WHERE email='user@gmail.com';")
    seed()
    for table, expected in EXPECTED_COUNTS.items():
        assert count(table) == expected, table
    assert count('auth_db.users', "email='user@gmail.com' AND full_name='Edited learner profile'") == 1
    assert count('auth_db.users', "id=1 AND status='LOCKED' AND password_hash='existing-hash'") == 1
    assert histories() == before, 'Seed must not change Flyway metadata'

    # A late payment collision rolls back credential changes and all earlier tables too.
    sql("UPDATE payment_db.orders SET order_code='existing-unrelated-order' WHERE id=1;")
    sql("UPDATE auth_db.users SET password_hash='unchanged-on-failure' WHERE email='admin@gmail.com';")
    failure = seed(check=False)
    assert failure.returncode != 0 and 'Seed ID collision' in failure.stderr
    assert count('auth_db.users', "id=22 AND password_hash='unchanged-on-failure'") == 1
    assert count('payment_db.orders', "id=1 AND order_code='existing-unrelated-order'") == 1
    sql("UPDATE payment_db.orders SET order_code='ORD-2026-0001' WHERE id=1;")
    seed()
    assert histories() == before
    print('Verified email-based accounts, repeated imports, >=15 rows/table, and cross-database rollback.', flush=True)

    payment_matches = sql("""SELECT COUNT(*) FROM payment_db.orders o
        JOIN payment_db.order_items i ON i.order_id=o.id
        JOIN payment_db.payments p ON p.order_id=o.id
        JOIN payment_db.payment_transactions t ON t.payment_id=p.id
        JOIN learning_db.enrollments e ON e.user_id=o.user_id AND e.course_id=i.course_id
        WHERE o.product_type='COURSE'
          AND o.total_amount=i.final_price AND i.final_price=i.unit_price-i.discount_amount
          AND p.amount=o.total_amount AND t.amount=p.amount
          AND o.status='PAID' AND p.status='SUCCESS' AND t.status='SUCCESS'
          AND p.provider='MOCK' AND t.provider='MOCK';""")
    assert int(payment_matches.stdout.strip()) == 16
    assert count('payment_db.payment_transactions', "event_type IN ('CREATED','STATUS_CHANGED')") == 36
    assert int(sql("""SELECT COUNT(*) FROM learning_db.lesson_progress p
        JOIN course_db.lessons l ON l.id=p.lesson_id
        JOIN course_db.sections s ON s.id=l.section_id AND s.course_id=p.course_id;""").stdout.strip()) == 26

    admin = api('auth', '/api/v1/auth/login', {'email': 'admin@gmail.com', 'password': 'Admin123'})['data']
    assert admin['user']['id'] == 22
    assert set(admin['user']['roles']) == {'ADMIN', 'USER'}
    assert api('course', '/api/v1/admin/courses', token=admin['accessToken'])['success']
    for email, course_id in [('user@gmail.com', 1), ('tran.thi.b@elearning.com', 2),
                             ('le.van.c@elearning.com', 3), ('hoang.van.e@elearning.com', 4)]:
        auth = api('auth', '/api/v1/auth/login', {'email': email,
                   'password': 'User123' if email == 'user@gmail.com' else 'User123!'})['data']
        token = auth['accessToken']
        assert auth['user']['roles'] == ['USER']
        assert auth['user']['id'] not in (1, 2, 22)
        assert api('auth', '/api/v1/users/me', token=token)['data']['email'] == email
        for path in ['/dashboard', '/enrollments/me', f'/quizzes/{course_id}',
                     f'/quizzes/{course_id}/result', f'/progress/courses/{course_id}', '/notifications']:
            assert api('learning', '/api/v1/learning' + path, token=token)['success'], path
        assert api('payment', '/api/v1/payments/history', token=token)['success']
        assert api('course', f'/api/v1/courses/{course_id}/sections', token=token)['success']
        assert api('ai', '/api/v1/ai/conversations', token=token)['success']
    try:
        api('auth', '/api/v1/auth/login', {'email': 'pham.thi.d@elearning.com', 'password': 'User123!'})
    except HTTPError as error:
        assert error.code == 403
    else:
        raise AssertionError('The locked sample account must remain locked')
    print('Active logins, admin access, curriculum, progress, quizzes, AI and payment history passed.', flush=True)


try:
    verify()
    print('PASS: consolidated V1 migrations + seed verification complete.', flush=True)
except BaseException:
    log_dir = ROOT / '.tmp' / RUN
    log_dir.mkdir(parents=True, exist_ok=True)
    for name in containers:
        result = docker('logs', '--tail', '150', name, check=False)
        content = (result.stdout + result.stderr).replace(password, '[redacted]')
        (log_dir / (name + '.log')).write_text(content.replace(environment['JWT_SECRET'], '[redacted]'), encoding='utf-8')
    raise
finally:
    for name in reversed(containers):
        docker('rm', '-f', '-v', name, check=False)
    if network_created:
        docker('network', 'rm', RUN, check=False)
