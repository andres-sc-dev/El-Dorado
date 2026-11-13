# Estado de las bases de datos · El Dorado

Verificación hecha el 12 de noviembre de 2026, entre las 21:30 y las 21:40 (hora de Colombia), en la rama `main`, con los contenedores levantados. Todos los números de este documento salieron de comandos ejecutados esa noche; ninguno es estimado.

**Resultado:** `npm run check:db` dio **76 de 76 comprobaciones OK y 0 FAIL**, y `GET /api/health` mostró los **5 motores en `ok`**.

## Cómo se reparte el proyecto

| Motor | Qué guarda | Por qué ahí |
|---|---|---|
| SQL Server 2022 | Identidad: usuarios, clientes, roles, estados, tipos de documento, proveedor de acceso e historial de acceso | Datos personales con reglas estrictas (UNIQUE de usuario y correo, CHECK de proveedor). Se separan del dinero para que un fallo en uno no exponga el otro. |
| MySQL 8 | Competición: país, deporte, liga, estadio, jornada, partido, estado del partido y cuotas | Catálogo deportivo que se lee mucho y cambia poco. Las cuotas viven junto al partido que las usa. |
| PostgreSQL 16 | Dinero (cuentas, apuestas, selecciones, movimientos y sus catálogos) y el dataset de equipos y jugadores | El dinero necesita transacciones con `SELECT ... FOR UPDATE` dentro de funciones PL/pgSQL. Los equipos están aquí porque las estadísticas se consultan junto con el resto de datos relacionales. |
| MongoDB 7 | Mercados de apuesta, resultados posibles, reglas de juego y auditoría | Documentos con forma variable (reglas de liquidación por mercado) y un registro de auditoría que solo crece. Los validadores `$jsonSchema` imponen la forma mínima. |
| Firestore | Una ficha por recarga de Wompi (colección `payments`) | Requisito del curso. Se usa la misma cuenta de servicio que Firebase Auth (Google). |

No hay FOREIGN KEY entre motores. Se referencian por claves naturales (`username`, `match_code`, `market_code`, `team_code` y la `reference` de la recarga), y la API combina los datos.

## Detalle por motor

### SQL Server (`el_dorado`)

Conexión del backend: `SQLSERVER_HOST`, `SQLSERVER_PORT`, `SQLSERVER_DB`, `SQLSERVER_USER` y `SQLSERVER_PASSWORD` (login de la app, no `sa`). `MSSQL_SA_PASSWORD` solo la usan `db-init` y el healthcheck.

| Tabla | Esperado | Real | Resultado |
|---|---|---|---|
| users | 6 o más | 6 | OK |
| customer | 6 o más | 6 | OK |
| role | 2 (USR y ADM) | 2: ADM, USR | OK |
| document_type | 4 | 4 | OK |
| user_status | 3 | 3 | OK |
| auth_provider | 2 (LOCAL, GOOGLE) | 2 | OK |
| login_history | (crece con cada login) | 19 | OK |

| Comprobación | Resultado |
|---|---|
| Existe el usuario demo con rol USR | OK |
| Existe el usuario admin con rol ADM | OK |
| Escritura y lectura en `login_history` dentro de una transacción con ROLLBACK | OK: 1 fila leída, 0 después del ROLLBACK |

### MySQL (`el_dorado`)

Conexión del backend: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER` y `MYSQL_PASSWORD`.

| Tabla | Esperado | Real | Resultado |
|---|---|---|---|
| league | 4 | 4 | OK |
| matchday | 58 | 58 | OK |
| match (total) | 469 | 469 | OK |
| match reales 2024 finalizados | 432 | 432 | OK |
| match DM (demo) en total | 30 | 30 | OK |
| match DM programados | 30 al cargar | 27 | OK, con aviso: 3 ya los finalizó el administrador durante las pruebas de hoy (el último fue DM265309 en el flujo de punta a punta) |
| odds | 234 | 234 | OK |
| match_status | 4 | 4 | OK |
| stadium | 26 | 26 | OK |

| Comprobación | Resultado |
|---|---|
| Escritura y lectura en `country` dentro de una transacción con ROLLBACK | OK: 1 fila leída, 0 después del ROLLBACK |

### PostgreSQL (`el_dorado`)

Conexión del backend: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD`.

| Tabla | Esperado | Real | Resultado |
|---|---|---|---|
| account | una por usuario USR | 5 (el admin no tiene cuenta) | OK |
| balance_movement | (crece con el uso) | 17 | OK |
| bet | (crece con el uso) | 5 | OK |
| bet_leg | igual a bet (solo apuestas simples) | 5 | OK |
| team | 20 | 20 | OK |
| player | 830 | 830 | OK |
| team_stats | 20 | 20 | OK |
| player_stats | 308 | 308 | OK |

| Comprobación | Resultado |
|---|---|
| Funciones PL/pgSQL `fn_recargar`, `fn_crear_apuesta`, `fn_liquidar_apuesta`, `fn_liquidar_partido` y `fn_anular_apuesta` | OK: las 5 existen |
| Restricciones `ck_movement_amount`, `balance_movement_resulting_balance_check`, `balance_movement_reference_check` y `uq_movement_reference` | OK: las 4 existen |
| CHECK rechaza un monto negativo | OK: rechazado con 23514 |
| CHECK rechaza un saldo resultante negativo | OK: rechazado con 23514 |
| CHECK rechaza una `reference` de 2 caracteres | OK: rechazado con 23514 |
| UNIQUE rechaza una `reference` repetida | OK: rechazado con 23505 |
| Escritura y lectura en `balance_movement` (todo en una transacción con ROLLBACK) | OK: 1 fila leída, 0 después del ROLLBACK |

### MongoDB (`el_dorado`)

Conexión del backend: `MONGO_URI` (en Docker se arma con `MONGO_INITDB_ROOT_USERNAME` y `MONGO_INITDB_ROOT_PASSWORD`) y `MONGO_DB`.

| Colección | Esperado | Real | Resultado |
|---|---|---|---|
| odds_market | 5 | 5 | OK |
| odds_outcome | 19 | 19 | OK |
| game_rule | 5 | 5 | OK |
| audit_log | (crece con el uso) | 741 | OK |

| Comprobación | Resultado |
|---|---|
| El validador `$jsonSchema` de `odds_market` rechaza un mercado incompleto | OK: rechazado con 121 |
| El validador de `audit_log` rechaza un evento que no está en la lista | OK: rechazado con 121 |
| El índice único `(sport, market_code)` rechaza un duplicado | OK: rechazado con 11000 |
| Escritura y lectura en `audit_log`, y luego `deleteMany` | OK: 1 documento leído, 0 después de borrar |

### Firestore (proyecto de Firebase)

Conexión del backend: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` (cuenta de servicio).

| Colección | Real | Resultado |
|---|---|---|
| payments | 9 documentos | OK |

| Comprobación | Resultado |
|---|---|
| Conexión con las credenciales | OK |
| Escritura, lectura y borrado de un documento en `_db_check` | OK: leído y luego borrado |
| Aparece en `GET /api/health` | OK: `firestore: ok` (se agregó esta noche) |

## Prueba cruzada por claves naturales

| Referencia | Resultado |
|---|---|
| El `username` del demo existe en SQL Server | OK |
| El demo tiene cuenta y saldo en PostgreSQL | OK: 581.950 COP |
| `account.username` de PostgreSQL existe en `users` de SQL Server | OK: 0 huérfanas |
| Partidos programados con cuotas activas en MySQL | OK: 32 |
| `team_code` de esos partidos existe en `team` de PostgreSQL | OK: 20 equipos, 0 huérfanos |
| `team_code` de todos los partidos existe en PostgreSQL | OK: 0 huérfanos |
| `market_code` de las cuotas existe en `odds_market` de MongoDB | OK: 5 mercados (1X2, TOTAL_GOALS, BTTS, EXACT_SCORE, HANDICAP), 0 huérfanos |
| `outcome_code` de las cuotas existe en `odds_outcome` de MongoDB | OK: 0 huérfanos |
| `bet_leg` (`match_code`, `market_code`) existe en MySQL y MongoDB | OK: 0 huérfanas |
| Última recarga del demo en Firestore | CREDITED, 50.000 COP |
| Esa recarga tiene su movimiento en PostgreSQL (misma `reference`) | OK |
| Todas las recargas CREDITED de Firestore tienen movimiento en PostgreSQL | OK: 6 de 6 |

## Base caída: solo fallan sus rutas

Se detuvo una base a la vez con `docker compose stop <servicio>` y se probaron 9 rutas. Después se reinició con `docker compose start <servicio>` y todas volvieron a 200.

| Base detenida | `/api/health` | `/api/auth/me` y `/api/customer` (SQL Server) | `/api/matches` y `/api/country` (MySQL) | `/api/teams` y `/api/wallet/me` (PostgreSQL) | `/api/markets` y `/api/game-rules` (MongoDB) |
|---|---|---|---|---|---|
| sqlserver | 200, marca sqlserver | **503** | 200 | 200 | 200 |
| mysql | 200, marca mysql | 200 | **503** | 200 | 200 |
| postgres | 200, marca postgres | 200 | 200 | **503** | 200 |
| mongo | 200, marca mongo | 200 | 200 | 200 | **503** |

`/api/matches` sigue en 200 sin PostgreSQL ni MongoDB a propósito: muestra los códigos en vez de los nombres. Solo MySQL es obligatorio para esa ruta.

## Persistencia

Se guardaron los conteos de los 5 motores, se ejecutó `docker compose restart` (nunca `down -v`) y se volvieron a contar. **Los conteos fueron idénticos.** En ese reinicio `db-init` volvió a correr sus scripts y terminó con `Exited (0)`.

## Flujo de punta a punta por la API

| Paso | Motores | Resultado |
|---|---|---|
| 1. Login del demo | SQL Server | 200, rol USR |
| 2. Listar partidos | MySQL, PostgreSQL, MongoDB | 37 partidos; se eligió DM265309 (CHI vs ENV, 17 de diciembre, a más de 30 minutos) |
| 3. Apostar 5.000 a Local con cuota vigente 2,21 | PostgreSQL (`fn_crear_apuesta`), MySQL, MongoDB, SQL Server | 201; saldo de 575.900 a 570.900 |
| 4. El admin finaliza el partido 3-1 | MySQL, PostgreSQL (`fn_liquidar_partido`), MongoDB | 200 |
| 5. Liquidación | PostgreSQL | WON, pago 11.050 (5.000 x 2,21) |
| 6. Saldo final | PostgreSQL | 581.950 = 575.900 - 5.000 + 11.050 |
| 7. Movimientos | PostgreSQL | `BET_PLACED` 5.000 (saldo 570.900) y `BET_PAYOUT` 11.050 (saldo 581.950) |
| 8. Auditoría | MongoDB | `BET_PLACED` y `MATCH_FINISHED` de DM265309 en `audit_log` |
| 9. Salud | los 5 | `sqlserver`, `mysql`, `postgres`, `mongo` y `firestore` en `ok` |

## Pruebas

| Comando | Resultado |
|---|---|
| `cd backend && npm test` | 162 de 162 pasan |
| `docker compose exec backend npm run test:integration` | 91 de 91 pasan |
| `cd frontend && npm test` | 18 de 18 pasan |
| `cd frontend && npm run lint` | 0 errores |
| `cd frontend && npm run build` | correcto |

## Respaldos (Parte 0)

Se generaron dentro de cada contenedor, con sus propias variables y sin mostrar contraseñas. Están en `backups/`, que Git ignora (`git check-ignore -v backups/...` lo confirma).

| Archivo | Motor | Fecha | Tamaño | Verificación |
|---|---|---|---|---|
| `el_dorado_sqlserver_20261112-1945.bak` | SQL Server | 12-nov-2026 19:45 | 6.082.560 bytes | `RESTORE VERIFYONLY ... WITH CHECKSUM`: "The backup set on file 1 is valid." |
| `el_dorado_postgres_20261112-1945.dump` | PostgreSQL | 12-nov-2026 19:45 | 66.074 bytes | `pg_restore --list`: 13 tablas con datos y 10 funciones |
| `el_dorado_mysql_20261112-1945.sql` | MySQL | 12-nov-2026 19:45 | 57.519 bytes | 8 tablas y 8 sentencias INSERT; termina en "Dump completed" |
| `el_dorado_mongo_20261112-1945.archive.gz` | MongoDB | 12-nov-2026 19:45 | 25.164 bytes | `mongorestore --dryRun`: las 4 colecciones (`audit_log`, `game_rule`, `odds_market`, `odds_outcome`) |

Firestore no se respalda en local: es un servicio de Google y la exportación administrada necesita un plan de pago. Sus recargas también quedan reflejadas en `balance_movement` de PostgreSQL (misma `reference`).

### Cómo se generaron

```bash
TS=$(date +%Y%m%d-%H%M)
# SQL Server
docker exec eldorado-sqlserver bash -c "mkdir -p /var/opt/mssql/backup && /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"\$MSSQL_SA_PASSWORD\" -C -b -Q \"BACKUP DATABASE el_dorado TO DISK = N'/var/opt/mssql/backup/el_dorado_sqlserver_$TS.bak' WITH INIT, COPY_ONLY, CHECKSUM\""
docker cp eldorado-sqlserver:/var/opt/mssql/backup/el_dorado_sqlserver_$TS.bak backups/
# PostgreSQL
docker exec eldorado-postgres sh -c "pg_dump -U \"\$POSTGRES_USER\" -d el_dorado -Fc -f /tmp/el_dorado_postgres_$TS.dump"
docker cp eldorado-postgres:/tmp/el_dorado_postgres_$TS.dump backups/
# MySQL
docker exec eldorado-mysql sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysqldump -uroot --single-transaction --routines --triggers --events --databases el_dorado > /tmp/el_dorado_mysql_$TS.sql"
docker cp eldorado-mysql:/tmp/el_dorado_mysql_$TS.sql backups/
# MongoDB
docker exec eldorado-mongo sh -c "mongodump --quiet -u \"\$MONGO_INITDB_ROOT_USERNAME\" -p \"\$MONGO_INITDB_ROOT_PASSWORD\" --authenticationDatabase admin --db el_dorado --gzip --archive=/tmp/el_dorado_mongo_$TS.archive.gz"
docker cp eldorado-mongo:/tmp/el_dorado_mongo_$TS.archive.gz backups/
```

En Git Bash, antes de estos comandos, ejecuta `export MSYS_NO_PATHCONV=1` para que no cambie las rutas `/tmp/...`.

### Cómo restaurar cada uno

Restaurar **reemplaza** los datos actuales de esa base. Hazlo solo si la base quedó dañada, y una base a la vez.

```bash
# SQL Server: copia el .bak al contenedor y restaura sobre el_dorado.
docker cp backups/el_dorado_sqlserver_20261112-1945.bak eldorado-sqlserver:/tmp/restore.bak
docker exec eldorado-sqlserver bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"\$MSSQL_SA_PASSWORD\" -C -b -Q \"ALTER DATABASE el_dorado SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE el_dorado FROM DISK = N'/tmp/restore.bak' WITH REPLACE; ALTER DATABASE el_dorado SET MULTI_USER;\""
docker compose up -d --force-recreate db-init   # vuelve a mapear el login de la app

# PostgreSQL: borra y recrea los objetos desde el dump.
docker cp backups/el_dorado_postgres_20261112-1945.dump eldorado-postgres:/tmp/restore.dump
docker exec eldorado-postgres sh -c "pg_restore -U \"\$POSTGRES_USER\" -d el_dorado --clean --if-exists /tmp/restore.dump"

# MySQL: el dump incluye CREATE DATABASE y DROP TABLE.
docker cp backups/el_dorado_mysql_20261112-1945.sql eldorado-mysql:/tmp/restore.sql
docker exec eldorado-mysql sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot < /tmp/restore.sql"

# MongoDB: --drop reemplaza cada colección del archivo.
docker cp backups/el_dorado_mongo_20261112-1945.archive.gz eldorado-mongo:/tmp/restore.gz
docker exec eldorado-mongo sh -c "mongorestore -u \"\$MONGO_INITDB_ROOT_USERNAME\" -p \"\$MONGO_INITDB_ROOT_PASSWORD\" --authenticationDatabase admin --gzip --archive=/tmp/restore.gz --drop"

docker compose restart backend
```

## Cómo repetir la verificación

```powershell
# 1. Antes de cualquier docker compose: ninguna variable de la terminal debe pisar el .env.
powershell -ExecutionPolicy Bypass -File scripts\check-env.ps1

# 2. Levantar y comprobar la salud de los 5 motores.
docker compose up -d
curl http://localhost:4000/api/health

# 3. Las 76 comprobaciones (conteos, escritura y lectura, restricciones, referencias cruzadas).
docker compose exec backend npm run check:db

# 4. Base caída (repetir con mysql, postgres y mongo): solo sus rutas deben dar 503.
docker compose stop sqlserver
curl -i http://localhost:4000/api/health
docker compose start sqlserver

# 5. Persistencia: contar, reiniciar sin borrar volúmenes y volver a contar.
docker compose exec backend npm run check:db -- --json
docker compose restart
docker compose exec backend npm run check:db -- --json

# 6. Pruebas.
cd backend; npm test; cd ..
docker compose exec backend npm run test:integration
cd frontend; npm test; npm run lint; npm run build
```

`check:db` termina con código 0 si no hay FAIL y con 1 si hay alguno. Si un conteo es **mayor** que el esperado por uso normal (registros, apuestas, recargas o pruebas), sale OK con un aviso; nunca falla por datos de pruebas anteriores.

## Lo que no cumple o queda pendiente

- **Partidos DM programados:** hay 27 de 30. No es un error: 3 los finalizó el administrador durante las pruebas de hoy. Si para la demo quieres los 30 abiertos, hay que volver a cargar la semilla de partidos demo. No lo hice porque cambiaría datos que ya tienen apuestas liquidadas.
- **Firestore no tiene respaldo local** (ver arriba).
- **El despliegue en la nube no está hecho** (ver `docs/DESPLIEGUE.md`).
