CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS course_db;
CREATE DATABASE IF NOT EXISTS learning_db;
CREATE DATABASE IF NOT EXISTS payment_db;
CREATE DATABASE IF NOT EXISTS ai_db;

-- Application credentials and scoped Flyway DDL/DML grants for all five databases
-- are provisioned by 02-users.sh using environment variables.
-- Production can use a separate migration account via SPRING_FLYWAY_USER/PASSWORD.
