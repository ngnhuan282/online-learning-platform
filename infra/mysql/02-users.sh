#!/bin/bash
# Run or sourced by the official MySQL entrypoint on an EMPTY data volume only.
# Never print credentials. Limit characters before interpolating SQL literals.
set -e
for service in auth course learning payment ai; do
  variable="${service^^}_DB_PASSWORD"
  password="${!variable}"
  if [[ -z "$password" || ! "$password" =~ ^[A-Za-z0-9_+=/@.-]+$ ]]; then
    echo "Set ${variable} to a nonempty base64/hex-style password (letters, digits, _+=/@.-)." >&2
    exit 1
  fi
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<EOSQL
CREATE USER IF NOT EXISTS '${service}_app'@'%' IDENTIFIED BY '${password}';
GRANT SELECT, INSERT, UPDATE, DELETE ON ${service}_db.* TO '${service}_app'@'%';
EOSQL
done
unset password variable service
