ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP(6) NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
INSERT INTO permissions(code) VALUES ('USER_DELETE');
INSERT INTO role_permissions(role_id, permission_code) SELECT id, 'USER_DELETE' FROM roles WHERE name = 'ADMIN';
