ALTER TABLE roles MODIFY COLUMN name VARCHAR(64) NOT NULL;
ALTER TABLE roles ADD COLUMN label VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE roles ADD COLUMN description VARCHAR(500) NULL;
ALTER TABLE roles ADD COLUMN system_role BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE roles ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
UPDATE roles SET label = 'Quản trị viên', description = 'Toàn quyền quản trị hệ thống', system_role = TRUE WHERE name = 'ADMIN';
UPDATE roles SET label = 'Học viên', description = 'Học tập và quản lý tài khoản cá nhân', system_role = TRUE WHERE name = 'USER';
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP(6) NULL;
CREATE TABLE permissions (code VARCHAR(64) PRIMARY KEY);
CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL,
    permission_code VARCHAR(64) NOT NULL,
    PRIMARY KEY (role_id, permission_code),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_role_permissions_code FOREIGN KEY (permission_code) REFERENCES permissions(code)
);
CREATE TABLE admin_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);
CREATE INDEX idx_admin_audit_created ON admin_audit_logs(created_at);
INSERT INTO permissions(code) VALUES
('ADMIN_ACCESS'),
('DASHBOARD_VIEW'),
('USER_VIEW'),
('USER_CREATE'),
('USER_UPDATE'),
('USER_STATUS_UPDATE'),
('USER_ROLES_ASSIGN'),
('ROLE_VIEW'),
('ROLE_MANAGE'),
('AUDIT_VIEW'),
('COURSE_VIEW'),
('COURSE_CREATE'),
('COURSE_UPDATE'),
('COURSE_DELETE'),
('CATEGORY_VIEW'),
('CATEGORY_CREATE'),
('CATEGORY_UPDATE'),
('CATEGORY_DELETE'),
('LEARNING_REPORT_VIEW'),
('PAYMENT_REPORT_VIEW');
INSERT INTO role_permissions(role_id, permission_code)
SELECT r.id, p.code FROM roles r CROSS JOIN permissions p WHERE r.name = 'ADMIN';
