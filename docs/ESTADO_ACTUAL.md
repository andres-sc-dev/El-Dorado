# El Dorado: estado actual del proyecto

Auditoría de solo lectura del 12 de noviembre de 2026, sobre el commit `9bc78b0` de la rama `main` (árbol limpio).
Todo lo que aparece aquí se comprobó leyendo el código o ejecutando comandos. No se dio nada por supuesto.

## Resumen

El proyecto sigue siendo **un monolito con SQL Server**: un frontend React y una API Express conectada a una sola base. De los 27 puntos **cumple 1**, **3 son parciales** y **23 no se cumplen**. En el repositorio no existe nada de MySQL, PostgreSQL, MongoDB, Firebase, Wompi, API-Football, roles, Dockerfiles, la carpeta `database/` ni GitHub Actions.

Además hay **dos fallos de seguridad críticos** que no estaban en el estado conocido:

1. **Cualquiera puede crearse saldo sin iniciar sesión.** `POST /api/balance_movement` y `POST /api/account` no piden autenticación (`backend/src/routes/domainRoutes.js`). Basta un `curl` para registrar un movimiento de depósito en cualquier cuenta. Lo mismo pasa con `match`, `odds`, `team` y otros 14 recursos: se pueden crear partidos y cuotas sin autenticarse.
2. **Fuga de datos personales.** `GET /api/customer` y `GET /api/customer/:id` no piden autenticación y devuelven el nombre, el número de documento y la fecha de nacimiento de todos los clientes. `GET /api/account` y `GET /api/balance_movement` también están abiertos.

## 1. Los 27 puntos

| # | Punto | Estado | Evidencia | Qué falta |
|---|---|---|---|---|
| 1 | docker-compose con 6 servicios, healthchecks, volúmenes y `.env.example` | **No cumple** | `docker-compose.yml`: solo hay `backend` y `frontend` con la imagen `node:22-alpine` y `npm run dev`. SQL Server se usa desde el equipo anfitrión (`host.docker.internal`). `docker compose config` valida sin errores. | Agregar sqlserver, mysql, postgres y mongo, con healthchecks, volúmenes de datos y `depends_on: condition: service_healthy`. Completar `.env.example`, que hoy tiene solo 10 variables del backend. |
| 2 | Dockerfiles multi-etapa sin secretos | **No cumple** | No existe ningún `Dockerfile` (`find . -name "Dockerfile*"` no devuelve nada). | Escribir los Dockerfiles: backend con `npm ci --omit=dev` y usuario sin privilegios; frontend con build en Vite y luego nginx. |
| 3 | `database/` con esquema y semilla por motor | **No cumple** | No existe `database/`. Solo está `backend/docs/example-data.sql`, que contiene datos de SQL Server y **0 `CREATE TABLE`**. El README habla de un "script de esquema" que no está en el repositorio. | Escribir el esquema y la semilla de los 4 motores, más el script de Mongo. |
| 4 | SQL Server: user, client, login_history, user_status, role, document_type | **Parcial** | El código usa `users`, `customer`, `login_history` y el catálogo `user_status` (`domainDefinitions.js`). No hay tabla `role` ni `document_type`, y el esquema no está versionado, así que no se puede verificar. | Crear `role` (USR, ADM), `document_type`, la FK `users.role_id` y el script DDL. Decidir si `customer` pasa a llamarse `client`. |
| 5 | MySQL: country, sport, league, stadium, matchday, match, match_status, odds | **No cumple** | Todas esas tablas viven en SQL Server. No hay driver de MySQL en `backend/package.json`. | Instalar `mysql2`, crear el DDL y la semilla, crear un repositorio por entidad y migrar las consultas. |
| 6 | PostgreSQL: account, bet, bet_leg, balance_movement, catálogos y dataset de API-Football | **No cumple** | `account`, `bet`, `balance_movement`, `team`, `player`, `team_stats` y `player_stats` están en SQL Server. `bet_leg` no existe. No está instalado `pg`. | Instalar `pg`, crear el DDL con `bet` y `bet_leg`, catálogos y las tablas del dataset. |
| 7 | MongoDB: game_rule, odds_market, odds_outcome ($jsonSchema e índice único) y audit_log | **No cumple** | `game_rule` es una tabla de SQL Server. `odds_market` y `odds_outcome` son catálogos de SQL Server. No está instalado `mongodb`. | Script de inicialización con validadores e índices, y un repositorio en Node. |
| 8 | Firestore (pagos Wompi) y Firebase Auth (Google) | **No cumple** | Buscar "firebase" en el repositorio no da resultados. | Proyecto de Firebase, `firebase-admin` en el backend y SDK web en el frontend. |
| 9 | Un pool por motor, 503 si una base cae y `/api/health` por motor | **No cumple** | Hay un solo pool de mssql (`backend/src/config/db.js`). Es perezoso, así que el servidor arranca sin base de datos, y `errorHandler.js` responde 503 ante errores de socket de mssql. El único health es `GET /api/auth/health`, solo para SQL Server. | Crear `config/sqlserver.js`, `mysql.js`, `postgres.js` y `mongo.js`, con un `GET /api/health` que muestre el estado de cada motor, y un middleware `requireDb('pg')` que devuelva 503. |
| 10 | Apuestas mediante funciones PL/pgSQL (`fn_crear_apuesta`, `fn_recargar`, `fn_liquidar_*`, anulación) | **No cumple** | La lógica de apuestas vive en Node: `createBetsForUser` en `backend/src/services/domainService.js` con una transacción de SQL Server. No hay ninguna función en base de datos. | Escribir las 5 funciones PL/pgSQL y que la API solo haga `SELECT fn_crear_apuesta(...)`. |
| 11 | La API toma el usuario del JWT y las cuotas de MySQL, rechaza partidos iniciados, es idempotente y solo acepta apuestas simples | **Parcial** | ✅ El usuario sale del JWT (`request.user.userId`). ✅ La cuota se lee de la base de datos y no del cliente. ✅ Usa `SERIALIZABLE` con `UPDLOCK, HOLDLOCK` sobre el saldo. ❌ Acepta partidos con estado `1 = Live`: solo rechaza 2 y 3, y no compara `match_date` con la hora actual. ❌ No hay clave de idempotencia. ❌ Acepta **varias selecciones** y reparte el monto en apuestas separadas, lo que contradice la regla de "solo simples". ❌ No hay mínimo, máximo ni control de decimales. ❌ Las cuotas salen de SQL Server, no de MySQL. ❌ No comprueba si el usuario está inactivo en cada apuesta. | Rechazar `selections.length !== 1`. Validar `match_date > now()` y estado = 0. Agregar el header `Idempotency-Key` con índice único. Definir límites de monto. Pasar a MySQL y Postgres. |
| 12 | Pruebas automatizadas de valores de apuesta (19 casos, incluida la concurrencia) | **No cumple** | No hay tests en el backend: `package.json` no tiene script `test`. `frontend/test/run_tests.mjs` es un script viejo que importa los mocks de `src/data/users.js` e inicia sesión con datos semilla del mock; no está conectado a `npm test` ni prueba la API real. | Usar `node:test` (incluido en Node, gratis) más `supertest` contra Postgres en Docker, con los 19 casos y la prueba de concurrencia de 30.000 con 2×20.000. |
| 13 | Roles USR y ADM, middleware de rol, rutas /admin solo para ADM y admin creado por seed | **No cumple** | `authController.js` fija `role: 'user'` en la respuesta. No hay middleware de rol. `ProtectedRoute.jsx` solo comprueba que haya sesión. **`/admin/data-entry` está disponible para cualquier usuario autenticado.** | Tabla `role`, `role` dentro del JWT, `requireRole('ADM')`, `<ProtectedRoute roles={['ADM']}>` y un seed con `ADMIN_USERNAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`. |
| 14 | Registro con Google, verificación del idToken y pantalla para completar datos | **No cumple** | No existe. | Firebase Auth, `POST /api/auth/google` con `verifyIdToken` y una página `/complete-profile`. |
| 15 | Cédula con puntos de miles, sin enmascarar y nunca en los logs | **No cumple** | La cédula no se muestra en ninguna parte (`ProfilePage.jsx` muestra nombre, usuario, saldo y correo). No hay función de formato. En los logs no aparece: `errorHandler` solo registra `error.message`. Pero se expone en crudo en `GET /api/customer` sin autenticación. | Crear `formatDocument()` con `Intl.NumberFormat('es-CO')` y usarlo en el perfil. Cerrar el endpoint. |
| 16 | Barra de fortaleza de 4 colores con letrero de requisitos y la misma política en el backend | **No cumple** | `RegisterForm.jsx` solo compara la contraseña con su confirmación. El backend solo comprueba que no esté vacía (`requireText`). | Crear `passwordPolicy.js` compartido (mínimo 8 caracteres, mayúscula, minúscula, número y símbolo), el componente `PasswordStrength` y la validación en `register`. |
| 17 | Auditoría en MongoDB (login, apuesta, partido finalizado, recarga) | **No cumple** | Solo se escribe `login_history` en SQL Server. No hay Mongo. | `auditService.log(evento, username, meta)` con escritura en Mongo, que no bloquee la operación si Mongo falla. |
| 18 | Rutas de Wompi Sandbox: config, prepare con firma, webhook con checksum y estado | **No cumple** | Buscar "wompi" no da resultados. | `routes/payments.js` con firma SHA-256 de integridad, verificación de `signature.checksum` en el webhook e idempotencia por `transaction.id`. |
| 19 | `wompiFirebaseService.js` que guarda cada recarga en Firestore | **No cumple** | No existe. | Depende de los puntos 8 y 18. |
| 20 | Límites de recarga entre 10.000 y 3.000.000 COP por variables de entorno, en frontend y backend, con aviso visible | **No cumple** | `WalletPage.jsx` solo exige `amount > 0`, y el backend también (`balanceMovement`). No hay aviso de límites. | `WOMPI_MIN_COP` y `WOMPI_MAX_COP`, expuestos en `GET /api/payments/config` y mostrados en la billetera. |
| 21 | Quitar el depósito directo que suma saldo sin pago | **No cumple** | Siguen activos `POST /api/auth/balance/deposit` (`authRoutes.js`) y el botón "Confirmar depósito" de `WalletPage.jsx`. Además existe `POST /api/balance_movement` **sin autenticación**, que es todavía peor. | Eliminar las rutas y el botón, y dejar que el saldo solo suba mediante `fn_recargar` llamada desde el webhook de Wompi. |
| 22 | Datos de API-Football 2024 cargados una vez (JSON local, loader idempotente, Postgres) | **No cumple** | No hay JSON, loader ni referencias a api-football. Los equipos están en SQL Server y en el mock `frontend/src/data/teams.js`. | Descargar una sola vez, guardar en `database/postgres/seed/api-football-2024/*.json` y hacer el loader con `ON CONFLICT DO NOTHING`. Comprobar si el plan gratuito incluye 2024; si no, usar datos fijos. |
| 23 | Escudos servidos desde Google Drive por un endpoint con caché y escudo genérico | **No cumple** | Solo existe la columna `team.crest_url`. No hay endpoint. | `GET /api/teams/:code/crest` con proxy a Drive, `Cache-Control`, caché en memoria y SVG genérico de respaldo. |
| 24 | El ADMIN finaliza partidos, pone el resultado y se liquidan las apuestas | **No cumple** | No existe ningún endpoint para finalizar partidos. `AdminDataPage.jsx` es un formulario genérico de inserción que cualquier usuario puede abrir, y `POST /api/match` permite crear partidos **sin autenticación**. | `POST /api/admin/matches/:code/finish` con `requireRole('ADM')`, que actualice MySQL y llame a `fn_liquidar_partido`. Una pantalla de administración. |
| 25 | Cupón persistente y responsivo, aviso de cambio de cuota, estados de carga, vacío y error, formatos es-CO, `index.html` en español y avisos de 18+ y de proyecto académico | **Parcial** | ✅ `index.html` tiene `lang="es"` y título en español. ✅ `toLocaleString('es-CO')` en montos y fechas. ✅ El cupón es fijo (`sticky`) en escritorio, pero **solo en `/matches`**. ❌ No se conserva al recargar ni entre páginas, y en móvil no hay hoja inferior: el cupón queda debajo de la lista. ❌ No hay aviso de cambio de cuota. ❌ `MatchesPage.jsx` no tiene estado de carga, vacío ni error: `getMatchDetails().then(...)` no tiene `catch`. ❌ No hay aviso de 18+ ni de proyecto académico en la interfaz (`Footer.jsx`); solo aparecen en el README. ❌ `PromotionsPage` sigue usando el mock de `src/data/promotions.js`. | Guardar el cupón en `sessionStorage`, hacer el *drawer* móvil, comparar la cuota al enviar (la API devuelve 409 con la cuota nueva), crear los componentes `Loading`, `Empty` y `Error`, y agregar el banner en el footer. |
| 26 | Azure (gratis), Key Vault, Cloudflare Pages y GitHub Actions | **No cumple** | No existe `.github/`. No hay configuración de despliegue. | Ver la sección 3. Hace falta tu cuenta de Azure for Students y tu cuenta de Cloudflare. |
| 27 | Repositorio sin secretos | **Cumple** | `.gitignore` en la raíz ignora `.env` y `.env.*` excepto `.env.example`. `git log --all --name-only` solo muestra `backend/.env.example` y `frontend/.env.example`. En todo el historial, `JWT_SECRET=` y `DB_PASSWORD=` aparecen 6 veces, siempre vacíos (0 con valor). `backend/.env` y `backend/smoke-cookies.txt` existen en local pero están ignorados (`git check-ignore`). | Cuando se agreguen credenciales de Firebase, ignorar también `*-firebase-adminsdk-*.json` y `serviceAccount*.json`. Borrar `smoke-cookies.txt`, que puede contener un token de sesión. |

## 2. Comprobaciones ejecutadas

| Comando | Resultado real |
|---|---|
| `git status` | Rama `main`, al día con `origin/main`, árbol limpio. |
| `git log` | 2 commits: `8138d46 Versión inicial de El Dorado` y `9bc78b0 correccion pequeña en el README`. |
| `docker compose config` | ✅ Válido. Resuelve 2 servicios (`backend` y `frontend`) y 2 volúmenes de `node_modules`. Funciona porque `backend/.env` existe en local; en un clon limpio fallaría porque `env_file` es obligatorio. |
| `npm run build` (frontend) | ✅ Compila en 2,34 s. JS de 280 kB (85 kB en gzip). ⚠️ `el-dorado.png` pesa **802 kB**: conviene pasarlo a WebP. |
| `npm run lint` (frontend, oxlint) | ✅ 0 errores y 10 advertencias: `set-state-in-effect` (MyBetsPage, AdminDataPage), `exhaustive-deps` (BetSlipContext, AuthContext), `only-export-components` (2 contextos) y variables sin usar en `test/run_tests.mjs`. |
| `node --check` (14 archivos del backend) | ✅ Todos sin errores de sintaxis. |
| Tests | No existen tests ejecutables: el backend no tiene script `test` y el frontend no tiene `npm test`. |

No se ejecutó nada contra bases de datos reales: no hay ninguna en Docker y la de SQL Server está en el equipo anfitrión.

## 3. Pendientes en orden de ejecución

Leyenda: **Yo** = lo puedo hacer solo. **Tú** = necesito cuentas, llaves o una decisión tuya.

| Orden | Tarea | Tiempo | Quién | Depende de |
|---|---|---|---|---|
| 0 | **Parche de seguridad inmediato**: exigir autenticación y rol ADM en todos los POST genéricos, cerrar los GET de `customer`, `account` y `balance_movement`, y quitar el depósito directo. | 1 h | Yo | — |
| 1 | Carpeta `database/` con DDL y semilla de SQL Server (incluyendo `role` y `document_type`), MySQL, Postgres y Mongo, más `docker-compose` con los 6 servicios, healthchecks y `.env.example` completo. | 6–8 h | Yo | Tu decisión sobre el nombre de las tablas (`customer` o `client`). |
| 2 | Capa de datos con un pool por motor, `/api/health` por motor, middleware 503 y migración de las consultas al motor que les corresponde. | 6–8 h | Yo | 1 |
| 3 | Funciones PL/pgSQL (`fn_crear_apuesta`, `fn_recargar`, `fn_liquidar_apuesta`, `fn_liquidar_partido`, `fn_anular_apuesta`) y la API reducida a validar y llamarlas. Solo apuestas simples, idempotencia y rechazo de partidos iniciados. | 5–6 h | Yo | 1, 2 |
| 4 | Suite de pruebas con los 19 casos, incluida la concurrencia. | 4 h | Yo | 3 |
| 5 | Roles: JWT con rol, `requireRole`, `ProtectedRoute` por rol y seed del administrador. | 2–3 h | Yo | 1. Tú defines el usuario y la contraseña del admin en tu `.env`. |
| 6 | Panel de administración para finalizar partidos y poner resultados, con liquidación. | 3–4 h | Yo | 3, 5 |
| 7 | Política de contraseñas (barra y backend), formato de cédula y auditoría en Mongo. | 3 h | Yo | 2 |
| 8 | Experiencia de usuario: cupón persistente con *drawer* móvil, aviso de cambio de cuota, estados de carga, vacío y error, avisos de 18+ y académico, y quitar los mocks de promociones (o esconder la página). | 4–5 h | Yo | 3 |
| 9 | Dataset de API-Football 2024: descarga única, JSON y loader idempotente. | 2–3 h | **Tú** pones la llave; yo hago el resto. | Llave gratuita de API-Football. Confirmar si 2024 está en el plan gratuito. |
| 10 | Escudos desde Google Drive con caché y respaldo. | 2 h | **Tú** subes los escudos y me das la carpeta; yo hago el endpoint. | Carpeta pública de Drive. |
| 11 | Wompi Sandbox: config, prepare, webhook, estado y límites. | 5–6 h | **Tú** creas la cuenta Sandbox. | 3 y llaves de Wompi. Para probar el webhook en local hace falta un túnel gratuito (cloudflared). |
| 12 | Firebase: Firestore para pagos, login con Google y pantalla para completar datos. | 5–6 h | **Tú** creas el proyecto de Firebase. | 11 y credenciales de Firebase. |
| 13 | Dockerfiles multi-etapa. | 2 h | Yo | 1 |
| 14 | Despliegue en Azure (App Service F1 y bases de datos) con Key Vault, Cloudflare Pages y GitHub Actions. | 6–10 h | **Tú**: cuentas, suscripción y secretos en GitHub. Yo: workflows e infraestructura. | 13 y todo lo anterior. |

**Total estimado: 57 a 73 horas de trabajo.**

## 4. Riesgos principales

1. **Los fallos de seguridad están en producción si se publica hoy.** Cualquiera puede darse saldo y los documentos de identidad se pueden leer sin autenticarse. Hay que corregirlo antes de cualquier otra cosa.
2. **La arquitectura de 5 motores es el núcleo de la materia y no existe.** Es la mayor cantidad de trabajo (puntos 1 a 10) y bloquea casi todo lo demás. Migrar las consultas de SQL Server a MySQL y Postgres sin claves foráneas entre motores rompe los `JOIN` actuales, por ejemplo `listUserBets` une `bet`, `match`, `team` y `odds`. Habrá que combinar los datos en Node usando las claves naturales.
3. **SQL Server en Docker pesa** (unos 2 GB de RAM) y no corre en ARM. En Azure no tiene capa gratuita permanente: la opción gratuita de Azure SQL tiene límites mensuales. Mantener 5 motores en la nube gratis es el punto más frágil del despliegue, porque Azure for Students da créditos que se acaban.
4. **El webhook de Wompi necesita una URL pública.** En local hace falta un túnel. Si el despliegue se retrasa, no hay forma de demostrar el pago completo.
5. **No hay pruebas.** Cada cambio grande puede romper lo que ya funciona sin que nadie lo note.
6. **API-Football gratis tiene un límite diario** y quizá no incluya 2024. Por eso hay que descargar una sola vez y guardar el JSON.

### Qué recortaría si solo hubiera un día (unas 8 h)

Haría **0** (parche de seguridad, 1 h), luego **1 y 2 en versión mínima** (compose con los 4 motores y healthchecks, DDL y semilla, pools y health), y **3** (`fn_crear_apuesta` y `fn_recargar` en Postgres, solo apuestas simples).

Recortaría por completo: Wompi, Firebase y Google, Drive, despliegue, API-Football (en su lugar, unos 20 equipos como datos fijos) y la hoja inferior móvil.

Así se demuestra lo que evalúa Bases de Datos II: los 5 motores repartidos, las transacciones en PL/pgSQL y la ausencia de FK entre motores.

## 5. Llaves y cuentas que faltan (solo nombres)

```
# Bases de datos (las inventas tú en el .env local; no son cuentas externas)
MSSQL_SA_PASSWORD
SQLSERVER_HOST  SQLSERVER_PORT  SQLSERVER_DB  SQLSERVER_USER  SQLSERVER_PASSWORD
MYSQL_HOST  MYSQL_PORT  MYSQL_DATABASE  MYSQL_USER  MYSQL_PASSWORD  MYSQL_ROOT_PASSWORD
POSTGRES_HOST  POSTGRES_PORT  POSTGRES_DB  POSTGRES_USER  POSTGRES_PASSWORD
MONGO_URI  MONGO_DB  MONGO_INITDB_ROOT_USERNAME  MONGO_INITDB_ROOT_PASSWORD

# Sesión y administrador
JWT_SECRET          (ya existe en tu .env local)
ADMIN_USERNAME  ADMIN_EMAIL  ADMIN_PASSWORD  ADMIN_DOCUMENT

# Wompi Sandbox (cuenta gratuita en comercios.wompi.co)
WOMPI_PUBLIC_KEY  WOMPI_PRIVATE_KEY  WOMPI_INTEGRITY_SECRET  WOMPI_EVENTS_SECRET
WOMPI_API_URL  WOMPI_REDIRECT_URL  WOMPI_MIN_COP  WOMPI_MAX_COP
VITE_WOMPI_PUBLIC_KEY

# Firebase (proyecto gratuito en el plan Spark)
FIREBASE_PROJECT_ID  FIREBASE_CLIENT_EMAIL  FIREBASE_PRIVATE_KEY
VITE_FIREBASE_API_KEY  VITE_FIREBASE_AUTH_DOMAIN  VITE_FIREBASE_PROJECT_ID  VITE_FIREBASE_APP_ID

# API-Football (plan gratuito; se usa solo una vez, al descargar)
API_FOOTBALL_KEY

# Google Drive (escudos)
GDRIVE_CRESTS_FOLDER_ID   (y GDRIVE_API_KEY si la carpeta no es pública)

# Despliegue (secretos de GitHub Actions)
AZURE_CREDENTIALS  AZURE_WEBAPP_NAME  AZURE_KEYVAULT_NAME  AZURE_RESOURCE_GROUP
CLOUDFLARE_API_TOKEN  CLOUDFLARE_ACCOUNT_ID  CLOUDFLARE_PAGES_PROJECT
VITE_API_URL   (URL pública del backend)
```

## 6. Siguiente fase recomendada

**Fase 1, "Cimientos multi-motor": parche de seguridad, `database/` y docker-compose de 6 servicios, con un pool y un health por motor** (pendientes 0, 1 y 2, unas 14 a 17 h).

Por qué esta fase:

- **Es lo que se evalúa en la materia.** El reparto en 5 motores y los scripts de esquema son el entregable central de Bases de Datos II, y hoy no existen.
- **Bloquea todo lo demás.** Las funciones PL/pgSQL, los roles, la auditoría, la liquidación, Wompi y las pruebas dependen de que existan Postgres, Mongo y MySQL con su esquema.
- **No necesita nada tuyo.** Puedo hacerla completa sin cuentas ni llaves externas. Mientras tanto, tú puedes ir creando las cuentas de Wompi Sandbox, Firebase y API-Football, que se necesitan en las fases siguientes.
- **El parche de seguridad va primero dentro de la fase** porque cuesta una hora y cierra la creación libre de saldo y la fuga de documentos.

Antes de empezar necesito una sola decisión tuya: si la tabla de clientes se renombra de `customer` a `client`, como pide el punto 4, o se queda como está.
