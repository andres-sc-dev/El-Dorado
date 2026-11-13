#!/bin/bash
# Ejecuta en orden los scripts .sql de esta carpeta contra el servicio sqlserver.
# Todos los scripts son idempotentes, así que correr esto en cada arranque es seguro.
set -euo pipefail

SQLCMD=/opt/mssql-tools18/bin/sqlcmd
HOST="${SQLSERVER_HOST:-sqlserver}"

# Reintentos: justo después de arrancar, SQL Server ya responde (healthcheck sano) pero la base
# el_dorado puede seguir recuperándose ("Database cannot be autostarted during server startup").
# Como los scripts son idempotentes, repetir uno es seguro.
MAX_TRIES=12
for file in /scripts/*.sql; do
  for attempt in $(seq 1 "$MAX_TRIES"); do
    echo "db-init: ejecutando $(basename "$file") (intento $attempt)"
    if "$SQLCMD" -S "$HOST" -U sa -P "$MSSQL_SA_PASSWORD" -C -b -f 65001 \
        -v APP_LOGIN="$SQLSERVER_USER" APP_PASSWORD="$SQLSERVER_PASSWORD" \
        -i "$file"; then
      break
    fi
    if [ "$attempt" -eq "$MAX_TRIES" ]; then
      echo "db-init: $(basename "$file") falló $MAX_TRIES veces" >&2
      exit 1
    fi
    sleep 5
  done
done

echo "db-init: SQL Server listo"
