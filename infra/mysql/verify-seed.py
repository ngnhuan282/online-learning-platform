"""Verify migrations + demo seed against disposable MySQL 8.4 and real service JARs.

Prerequisites: Docker, Python 3, `mvn -f backend/pom.xml verify`, and the project's
local auth/course/learning/payment Docker images (used only as Java runtimes).
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
SERVICES = {'auth': 8081, 'course': 8082, 'learning': 8083, 'payment': 8084}
TABLES = {
    'auth': ['users', 'user_roles', 'refresh_tokens'],
    'course': ['categories', 'courses'],
    'learning': ['enrollments', 'lesson_progress', 'quizzes', 'quiz_questions',
                 'quiz_options', 'quiz_attempts', 'quiz_answers', 'notifications'],
    'payment': ['orders', 'order_items', 'payments', 'payment_transactions'],
}
password = secrets.token_hex(24)
environment = dict(os.environ, MYSQL_ROOT_PASSWORD=password, JWT_SECRET=secrets.token_hex(32))
for service in [*SERVICES, 'ai']:
    environment[service.upper() + '_DB_PASSWORD'] = password
containers = []
network_created = False
origins = {}


def docker(*args, input=None, check=True):
    result = subprocess.run(['docker', *args], input=input, text=True, encoding='utf-8',
                            capture_output=True, env=environment, timeout=300)
    if check and result.returncode:
        # Do not echo argv/environment; only tool output, with test secrets redacted.
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
    return sql((ROOT / 'infra/mysql/05-seed-data.sql').read_text(encoding='utf-8'), check=check)


def histories():
    return '\n'.join(sql(f'SELECT version, checksum, success FROM {service}_db.flyway_schema_history ORDER BY installed_rank;').stdout
                     for service in SERVICES)


def verify():
    global network_created
    # Fail before creating resources when a build artifact or runtime image is missing.
    jars = {}
    for service in SERVICES:
        jars[service] = ROOT / f'backend/{service}-service/target/{service}-service-0.0.1-SNAPSHOT.jar'
        assert jars[service].is_file(), 'Build backend first: ' + str(jars[service])
        docker('image', 'inspect', f'online-learning-platform-{service}-service:latest')
    docker('network', 'create', RUN)
    network_created = True
    args = ['run', '-d', '--name', MYSQL, '--network', RUN, '--network-alias', 'mysql', '--memory', '768m',
            '--tmpfs', '/var/lib/mysql', '-e', 'MYSQL_ROOT_PASSWORD']
    for service in [*SERVICES, 'ai']:
        args += ['-e', service.upper() + '_DB_PASSWORD']
    for local, remote in [('init.sql', '01-databases.sql'), ('02-users.sh', '02-users.sh'),
                          ('03-auth-migrations.sql', '03-auth-migrations.sql'),
                          ('04-course-migrations.sql', '04-course-migrations.sql'),
                          ('04-learning-migrations.sql', '04-learning-migrations.sql'),
                          ('04-payment-migrations.sql', '04-payment-migrations.sql')]:
        args += ['--mount', f'type=bind,source={ROOT / "infra/mysql" / local},target=/docker-entrypoint-initdb.d/{remote},readonly']
    docker(*args, 'mysql:8.4')
    containers.append(MYSQL)
    # TCP ensures the entrypoint's temporary initialization server has exited.
    wait_until(lambda: docker('exec', MYSQL, 'sh', '-c',
               'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql -h127.0.0.1 -uroot -Nse "SELECT 1"', check=False).returncode == 0,
               'MySQL initialization')
    print('MySQL initialized with project grants; starting service migrations.', flush=True)

    for service, port in SERVICES.items():
        name = RUN + '-' + service
        args = ['run', '-d', '--name', name, '--network', RUN, '--memory', '640m',
                '-p', f'127.0.0.1::{port}', '-e', 'JWT_SECRET',
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
        # Start one at a time to keep peak compilation/migration memory low on developer machines.
        wait_until(lambda s=service: api(s, '/actuator/health')['status'] == 'UP', service + ' migration/health')
    before = histories()
    print('All four services migrated empty schemas and passed Hibernate validation.', flush=True)

    # A collision after auth inserts must roll back work across database boundaries.
    sql("INSERT INTO course_db.categories (id,name,slug,created_at,updated_at) VALUES (900001,'Existing category','existing-category',NOW(),NOW());")
    failure = seed(check=False)
    assert failure.returncode != 0 and 'Seed ID collision' in failure.stderr
    assert count('auth_db.users') == 0
    assert count('course_db.categories', "slug='existing-category'") == 1
    sql("DELETE FROM course_db.categories WHERE id=900001 AND slug='existing-category';")

    # A conflicting natural key must fail, not overwrite or silently skip another user.
    sql("INSERT INTO auth_db.users (id,email,password_hash,full_name,status,created_at,updated_at) VALUES (42,'demo.dung@example.com','existing-hash','Existing person','LOCKED',NOW(),NOW());")
    failure = seed(check=False)
    assert failure.returncode != 0
    assert count('auth_db.users') == 1
    assert count('auth_db.users', "id=42 AND status='LOCKED' AND password_hash='existing-hash'") == 1
    sql("DELETE FROM auth_db.users WHERE id=42 AND email='demo.dung@example.com';")
    print('ID and natural-key collisions abort without overwrites; cross-schema rollback passed.', flush=True)

    seed()
    for service, tables in TABLES.items():
        for table in tables:
            assert count(f'{service}_db.{table}') == 5, table
    assert count('auth_db.roles') == 2
    assert count('auth_db.refresh_tokens', 'revoked_at IS NOT NULL AND expires_at < NOW()') == 5
    # A second run must preserve application edits and unrelated users.
    sql("UPDATE auth_db.users SET full_name='Edited demo name' WHERE id=900002;")
    sql("INSERT INTO auth_db.users (id,email,password_hash,full_name,status,created_at,updated_at) VALUES (42,'existing@example.com','existing-hash','Existing person','LOCKED',NOW(),NOW());")
    seed()
    assert count('auth_db.users') == 6
    assert count('auth_db.users', "id=900002 AND full_name='Edited demo name'") == 1
    assert count('auth_db.users', "id=42 AND status='LOCKED' AND password_hash='existing-hash'") == 1
    for service, tables in TABLES.items():
        for table in tables:
            key = 'user_id' if table == 'user_roles' else 'id'
            assert count(f'{service}_db.{table}', f'{key} BETWEEN 900001 AND 900005') == 5
    assert histories() == before, 'Seed must not change Flyway metadata'
    print('87 fixture rows verified (17 x 5 + 2 roles); rerun preserved data and Flyway history.', flush=True)

    # Payment APIs are explicitly unfinished stubs; verify their fixtures relationally.
    assert count('payment_db.payment_transactions',
                 "event_type IN ('CREATED','PROVIDER_REQUESTED','PROVIDER_RETURNED','PROVIDER_CALLBACK','STATUS_CHANGED')") == 5
    payment_matches = sql('''SELECT COUNT(*) FROM payment_db.orders o
        JOIN payment_db.order_items i ON i.order_id=o.id
        JOIN payment_db.payments p ON p.order_id=o.id
        JOIN payment_db.payment_transactions t ON t.payment_id=p.id
        JOIN learning_db.enrollments e ON e.user_id=o.user_id AND e.course_id=i.course_id
        WHERE o.total_amount=i.final_price AND i.final_price=i.unit_price-i.discount_amount
          AND p.amount=o.total_amount AND t.amount=p.amount
          AND o.status='PAID' AND p.status='SUCCESS' AND t.status='SUCCESS'
          AND p.provider='MOCK' AND t.provider='MOCK';''')
    assert int(payment_matches.stdout.strip()) == 5

    # Real authentication verifies the documented BCrypt passwords and exercises enum mappings.
    for n, email in enumerate(['demo.admin@example.com', 'demo.an@example.com', 'demo.binh@example.com',
                               'demo.chi@example.com', 'demo.dung@example.com'], start=1):
        auth = api('auth', '/api/v1/auth/login', {'email': email, 'password': 'Admin123' if n == 1 else 'User123!'})['data']
        token = auth['accessToken']
        assert auth['user']['roles'] == (['ADMIN'] if n == 1 else ['USER'])
        assert api('auth', '/api/v1/users/me', token=token)['data']['email'] == email
        for path in ['/dashboard', '/enrollments/me', f'/quizzes/{900000+n}',
                     f'/quizzes/{900000+n}/result', f'/progress/courses/{900000+n}', '/notifications']:
            assert api('learning', '/api/v1/learning' + path, token=token)['success']
        try:
            api('payment', '/api/v1/payments/history', token=token)
        except HTTPError as error:
            assert error.code == 501
            assert json.load(error)['code'] == 'FEATURE_NOT_IMPLEMENTED'
        else:
            raise AssertionError('Update the verification when Payment APIs are implemented')
        assert api('course', f'/api/v1/courses/{900000+n}', token=token)['success']
    print('All five logins and Course/Learning API reads passed; Payment relations verified in SQL (APIs still 501).', flush=True)


try:
    verify()
    print('PASS: demo seed verification complete.', flush=True)
except BaseException:
    log_dir = ROOT / '.tmp' / RUN
    log_dir.mkdir(parents=True, exist_ok=True)
    for name in containers:
        result = docker('logs', '--tail', '150', name, check=False)
        content = (result.stdout + result.stderr).replace(password, '[redacted]')
        (log_dir / (name + '.log')).write_text(content.replace(environment['JWT_SECRET'], '[redacted]'), encoding='utf-8')
    raise
finally:
    # Only resource names created by this invocation; tmpfs holds all verification data.
    for name in reversed(containers):
        docker('rm', '-f', '-v', name, check=False)
    if network_created:
        docker('network', 'rm', RUN, check=False)
