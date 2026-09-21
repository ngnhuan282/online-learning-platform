CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS course_db;
CREATE DATABASE IF NOT EXISTS learning_db;
CREATE DATABASE IF NOT EXISTS payment_db;
CREATE DATABASE IF NOT EXISTS ai_db;

-- Credentials and grants are created by 02-users.sh using environment variables.
-- Local Auth Flyway DDL privileges are scoped to auth_db in 03-auth-migrations.sql.
-- Local Payment Flyway DDL privileges are scoped to payment_db in 04-payment-migrations.sql.
-- Production can use a separate migration account via SPRING_FLYWAY_USER/PASSWORD.
