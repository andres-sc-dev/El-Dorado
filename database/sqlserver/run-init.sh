#!/bin/bash
# Ejecuta en orden los scripts .sql de esta carpeta contra el servicio sqlserver.
# Todos los scripts son idempotentes, así que correr esto en cada arranque es seguro.
set -euo pipefail

SQLCMD=/opt/mssql-tools18/bin/sqlcmd
HOST="${SQLSERVER_HOST:-sqlserver}"

for file in /scripts/*.sql; do
  echo "db-init: ejecutando $(basename "$file")"
  "$SQLCMD" -S "$HOST" -U sa -P "$MSSQL_SA_PASSWORD" -C -b -f 65001 \
    -v APP_LOGIN="$SQLSERVER_USER" APP_PASSWORD="$SQLSERVER_PASSWORD" \
    -i "$file"
done

echo "db-init: SQL Server listo"
