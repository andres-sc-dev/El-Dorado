# Decisiones del proyecto

Registro en lenguaje simple de qué se decidió y por qué. Lo más reciente va primero.

## Verificación de los 5 motores para la entrega (12 de noviembre de 2026)

### Qué se decidió

- **Respaldo antes de verificar.** Hay un respaldo por motor en `backups/` (Git lo ignora), generado dentro de cada contenedor con sus propias variables. El detalle y cómo restaurar están en `docs/ESTADO_BASES_DE_DATOS.md`. Firestore no se respalda en local porque su exportación administrada es de pago.
- **`npm run check:db`** (`backend/scripts/check-databases.js`) comprueba los 5 motores: conteos, una escritura y lectura que se deshace sola (ROLLBACK o borrado), las funciones PL/pgSQL, los CHECK y el UNIQUE de `balance_movement`, los validadores e índices únicos de MongoDB, y que cada clave natural apunte a algo que existe en su motor dueño. Si un conteo es mayor al esperado por uso normal, sale OK con aviso: nunca falla por datos de pruebas anteriores. No imprime secretos.
- **Firestore entra en `GET /api/health`** como quinto motor (`ping` que lee un documento de `payments`). Antes solo se veían los 4 de Docker, y una falla de credenciales de Firebase pasaba desapercibida hasta la primera recarga.
- **`db-init` reintenta cada script** hasta 12 veces, con 5 segundos de pausa. Al reabrir Docker Desktop, SQL Server ya respondía al healthcheck pero la base `el_dorado` seguía recuperándose ("Database cannot be autostarted during server shutdown or startup") y `db-init` fallaba en el primer intento. Los scripts son idempotentes, así que repetirlos es seguro.
- **`scripts/check-env.ps1`** avisa, solo con nombres, si una variable de la terminal tiene un valor distinto al del `.env`. Compara por hash. Quita las comillas que envuelven el valor y convierte `\n` literal en salto de línea; en `FIREBASE_PRIVATE_KEY` compara sin saltos de línea, porque Docker Compose deja `\n` literal y salto real a la vez y eso daba falsos positivos.
- **Ningún servicio usa una contraseña distinta a la del `.env`.** Se compararon por hash las 43 variables de los 7 contenedores contra el `.env`. Todas coinciden; `FIREBASE_PRIVATE_KEY` coincide una vez normalizada, igual que la resuelve Docker Compose. Los healthchecks usan las variables del propio contenedor (`$$MSSQL_SA_PASSWORD`, `$$MYSQL_PASSWORD`, `$$POSTGRES_USER`, `$$MONGO_INITDB_ROOT_*`).
- **Origen probable de las variables inyectadas:** `.vscode/settings.json` tiene `"python.terminal.useEnvFile": true`, así que la extensión de Python carga el `.env` en las terminales de VS Code (y en lo que se abre desde ellas). Las dos contraseñas de SQL Server tienen un `#`, que ese lector seguramente toma como inicio de comentario, y la llave de Firebase lleva comillas y `\n`. No se tocó esa configuración: si quieres evitarlo, ponla en `false`.

## Incidente · SQL Server "unhealthy" por una contraseña de sa distinta (12 de noviembre de 2026, 19:21)

### Qué pasó

- Después de `docker compose up -d`, `eldorado-sqlserver` quedó `unhealthy` y su registro repetía `Login failed for user 'sa'. Reason: Password did not match` desde 172.18.0.3. Esa IP es el propio contenedor de SQL Server: quien fallaba era su **healthcheck**. Como el servicio nunca quedaba sano, `db-init` y el backend no arrancaban.
- **El `.env` no cambió.** Su fecha de modificación es 18:18, no lo reescribe ningún script del proyecto, y SQL Server **sí acepta** la contraseña de `sa` que tiene el `.env`.
- **El contenedor se recreó a las 19:21 con otros valores.** Se compararon hashes, nunca los valores: `MSSQL_SA_PASSWORD` y `SQLSERVER_PASSWORD` de `eldorado-sqlserver`, `eldorado-db-init` y `eldorado-backend` eran distintos de los del `.env`. El resto de variables (`SQLSERVER_USER`, `JWT_SECRET`, Postgres, MySQL) sí coincidían. La carpeta y el `docker-compose.yml` eran los de siempre.
- **Causa:** `docker compose up` se ejecutó desde una terminal que tenía `MSSQL_SA_PASSWORD` y `SQLSERVER_PASSWORD` definidas como variables de entorno. Docker Compose les da prioridad sobre el `.env`, así que el contenedor nuevo recibió otra contraseña. SQL Server solo usa `MSSQL_SA_PASSWORD` la primera vez, cuando crea el volumen; después la contraseña real de `sa` es la que quedó guardada en el volumen. El healthcheck usaba la contraseña nueva y el servidor la rechazaba.
- No era una variable de Windows (usuario ni máquina) ni algo de `.vscode/`: quedó solo en esa terminal.

### Cómo se arregló, sin perder datos

- Desde una terminal sin esas variables: `docker compose up -d --force-recreate --no-deps sqlserver` y luego `docker compose up -d`. Compose recreó `sqlserver`, `db-init` y `backend` con los valores del `.env`.
- **No se tocó ningún volumen.** La tabla `users` sigue con sus 6 filas.
- Verificado: las 4 bases y el backend `healthy`, `GET /api/health` con los 4 motores en `ok`, cero `Login failed` después de recrear, y login del demo y del admin con `200`.

### Cómo evitarlo

- **Nunca definir en la terminal** (`$env:MSSQL_SA_PASSWORD=...` en PowerShell, `export` en bash) variables que ya están en el `.env`. Si hace falta probar algo, abrir una terminal nueva para `docker compose`.
- **Para revisar sin mostrar valores:** en PowerShell, `Get-ChildItem env: | Where-Object Name -match 'MSSQL|SQLSERVER|POSTGRES|MYSQL|MONGO'` solo debe listar nombres si alguna está definida. Si aparece algo, cerrar esa terminal.
- **La contraseña de `sa` del `.env` no se cambia** mientras exista el volumen `eldorado_sqlserver_data`: SQL Server no la aplica a un volumen que ya existe. Para cambiarla hay que hacer `ALTER LOGIN sa` dentro del servidor o recrear solo ese volumen (se pierden usuarios, clientes e historial de acceso; la semilla recrea demo y admin).

## Fase 6 · Cierre: experiencia mínima, auditoría y documentación (12 de noviembre de 2026)

### Cupón

- **El cupón se guarda en `sessionStorage`** (`frontend/src/utils/slipStore.js`): sobrevive a recargar la página y a cambiar de ruta, y se borra al cerrar la pestaña. Se eligió `sessionStorage` y no `localStorage` para que una apuesta a medias no reaparezca días después con una cuota vieja. Solo se guarda lo que se ve en el cupón (partido, mercado, cuota y monto); nada de la sesión. Si lo guardado está incompleto, se descarta.
- **En móvil hay una barra fija abajo** con el número de selecciones (0 o 1, porque solo hay apuestas simples) y la cuota. Al tocarla se abre el cupón como hoja deslizable. En pantallas grandes el cupón sigue al lado de los partidos.
- **Los límites de monto se comparten por el contexto**, para que la hoja móvil use los mismos que trae `GET /api/matches`.
- **Cuando la API responde 409 ODDS_CHANGED**, el cupón toma la cuota nueva, la resalta, muestra "Las cuotas cambiaron" con la cuota de antes y la de ahora, y ofrece "Aceptar y apostar". Ese botón envía la apuesta ya con la cuota nueva. Nunca se apuesta con una cuota distinta sin que la persona la vea.

### Pantallas que no se quedan cargando

- **Toda petición a la API tiene un tope de 15 segundos** (`frontend/src/services/apiClient.js`). Al vencerse se muestra el error con "Reintentar". Antes, si el servidor no respondía, una pantalla podía quedarse en "Cargando…" para siempre.
- **El Widget de Wompi también tiene tope de 15 segundos** para cargar. Antes el botón podía quedarse en "Preparando…".
- La recarga ya terminaba siempre en "Pago aprobado", "Pago rechazado" o "Todavía no recibimos la confirmación de Wompi" con "Verificar de nuevo" (arreglo anterior). Se comprobó de nuevo con sus pruebas.

### Registros del flujo de pagos

- **Cada paso deja una línea JSON** con `"scope":"payments"`: preparar, consultar a Wompi, aplicar, acreditar, rechazar, webhook recibido o ignorado, y errores de conexión con Wompi.
- **Solo pasan campos de una lista permitida** (`backend/src/utils/paymentLog.js`): referencia, id de transacción, monto, estados, origen y tiempos. Usuario, correo, cédula, firmas y llaves no pueden salir aunque alguien los pase por error; una prueba lo comprueba. La referencia es un UUID aleatorio y no identifica a nadie.
- Durante `npm test` no se escribe nada, para no ensuciar la salida.

### Datos de prueba fuera de la interfaz

- **Se eliminó la página de Promociones** y su sección en la portada. Usaba datos inventados y un botón "Canjear bono" que no tocaba ninguna base: parecía real sin serlo.
- Se borró la carpeta `frontend/src/data/` (datos inventados de la primera versión) y `frontend/test/run_tests.mjs`, que los probaba y ya no corría.

### Otros

- **Logo en WebP:** de 801 KB (PNG de 2172x724) a 61 KB (WebP de 840x280), con `width` y `height` fijos para que la página no salte al cargar. Se convirtió con `sharp` fuera del repositorio; no se agregó ninguna dependencia.
- **Pie de página:** aviso "Mayores de 18 años" y "Proyecto académico: dinero de prueba, sin valor real".
- **Pruebas de valores de apuesta** (`backend/test/betValues.test.js`): texto, NaN, cero, negativo, por debajo del mínimo, por encima del máximo y más de 2 decimales.

### Auditoría y despliegue

- **`docs/CHECKLIST_PROFE.md`** tiene el estado real de cada requisito con su evidencia. Azure, Key Vault y Cloudflare quedan en "No cumple" porque hoy no se desplegó nada; GitHub queda en "Parcial" porque el remoto existe pero las fases 3 a 6 no se han subido.
- **`docs/DESPLIEGUE.md`** es el plan paso a paso y gratuito (Azure for Students, Key Vault, Container Apps, GitHub Actions con OIDC y Cloudflare Pages). Se recomienda que Cloudflare reenvíe `/api` al backend, para que la cookie de sesión siga siendo del mismo sitio y no dependa de cookies de terceros.
- **Secretos:** no se encontró ninguno en el historial de Git. El `backend/.env` local es de una versión vieja; Git lo ignora y conviene borrarlo.

## Fase 5 · Datos reales de la Liga BetPlay con API-Football (12 de noviembre de 2026)

### Qué temporada se usó y por qué

- **Se usó la temporada 2024 de la Primera A (id 239), sin plan B.** Respuestas reales de la API (sin la llave):
  - `GET /status`: plan `Free`, `limit_day: 100`, vigente hasta 2027-11-12.
  - `GET /leagues?country=Colombia`: 5 ligas; la Primera A (`type: League`, id 239) lista las temporadas 2016 a 2026.
  - `GET /teams?league=239&season=2024`: `results: 20` y `errors: []`. El plan gratuito sí da acceso a 2024.
- **Se eligió 2024 porque es la temporada pedida y está completa:** Apertura y Finalización con cuadrangulares y final, 432 partidos jugados.

### Descarga (una sola vez, `backend/scripts/seed/apifootball-download.js`)

- **Se corre a mano en tu equipo**, nunca desde la app ni en Docker. La llave sale de `API_FOOTBALL_KEY` y **no se pasa al contenedor del backend**, así que la app no tiene cómo llamar a la API.
- **Cada respuesta cruda se guarda en `backend/data/apifootball/2024/`** (`teams.json`, `fixtures.json`, `team-stats/<id>.json` y `squads/<id>.json`). Si el archivo existe, no se vuelve a pedir: se puede reanudar otro día sin gastar cuota.
- **Presupuesto:**
  - máximo 70 peticiones por día, contadas en `_meta/budget.json`, y además se leen los headers `x-ratelimit-*`;
  - una petición cada 7 segundos (el límite es 10 por minuto);
  - se detiene si a la cuota diaria le quedan 3;
  - sin reintentos agresivos: ante un 429 espera 65 segundos y prueba una sola vez más.
- **Primera tanda: 43 peticiones según el registro propio:** 1 de ligas, 1 de equipos, 1 de partidos, 20 de estadísticas y 20 de plantillas. Al final, el header de la API decía que quedaban entre 60 y 65 de 100. El contador de la API va algo atrasado frente al registro propio, y se usa el más conservador.
- **Estadísticas de jugador (opcional, con el presupuesto sobrante):**
  - `/players?league=239&season=2024` en el plan gratuito responde, desde la página 4: `"Free plans are limited to a maximum value of 3 for the Page parameter"`. Se bajaron las páginas 1 a 3 (60 jugadores).
  - Se sumó la página 1 de `/players?team=<id>&season=2024` de cada equipo, con `--players-by-team=1`: son 20 peticiones y salen los 20 jugadores con más minutos de cada equipo.
  - Las páginas 2 y 3 por equipo (40 peticiones más) quedan para otro día con `--players-by-team=3`: el script salta lo que ya existe.
  - Resultado: 308 filas de `player_stats` de 2024.
  - Un jugador de 2024 que ya no está en la plantilla actual se agrega con el equipo de esa temporada. Si está en la plantilla actual, `player.team_id` es su equipo **actual**: las estadísticas son de 2024, pero el equipo no se reescribe.
- **Gasto total de hoy:** 67 de 70 peticiones en el registro propio. Al terminar, la API decía que quedaban 34 de 100.
- **Las plantillas (`/players/squads`) son las actuales, no las de 2024:** ese endpoint no recibe temporada.
- **¿Los escudos cuentan en la cuota?** No se pudo leer la documentación de API-Football: la página respondió 403 al consultarla desde aquí. Por eso se midió: se pidió `/status` antes y después de bajar los escudos de `media.api-sports.io`, y el contador no cambió (32 → 32 con 19 escudos; 40 → 40 con 2). **En la práctica, no cuentan.** Se bajaron los 20.
- **Se corrigió un choque de códigos.** "Internacional de Bogotá" (antes La Equidad) contiene la palabra "nacional" y tomaba el código `NAC`. Ahora es `EQU`, y la regla de Nacional exige "Atlético Nacional".

### Claves naturales

- **`team_code` sale de `scripts/seed/teamCodes.js`,** que reconoce cada equipo por su nombre, porque el campo `code` de la API viene vacío (Fortaleza) o es distinto (`SAN`, `DEP`, `ITA`).
  - **Se conservan los 8 códigos de la demo** (MIL, NAC, AME, JUN, CAL, SFE, TOL, MED), así las apuestas existentes siguen apuntando al mismo equipo.
  - Los nombres se guardan con tildes; la API los trae sin ellas.
- **`match_code` de los partidos reales: `BP` + `24` + jornada + número.**
  - El Apertura y la Finalización comparten liga y año en el código, así que **en el código la jornada de la Finalización suma 50**: Apertura 01–26 y Finalización 51–76.
  - Los cuadrangulares son las jornadas 20–25 y la final, la 26.
  - En la tabla `matchday` la jornada sigue siendo la real (1–26), y cada torneo es una fila de `league` (2024-I y 2024-II).

### Carga (`backend/scripts/seed/apifootball-load.js`)

- **Solo lee archivos.** Una prueba revisa que no use `fetch` ni ninguna URL.
- **Es idempotente:** hace upsert por clave natural, con `ON CONFLICT` en PostgreSQL y su equivalente de MySQL, `ON DUPLICATE KEY UPDATE`. Probado: correrlo dos veces deja los mismos conteos.
- **Corre en cada arranque del backend**, después de `seed:demo`. Si falla, el servidor arranca igual.
- **PostgreSQL:**
  - 20 equipos, 830 jugadores (632 de las plantillas actuales y 198 que solo aparecen en las estadísticas de 2024), 20 filas de `team_stats` y 308 de `player_stats` de 2024. Un jugador aparece en dos plantillas y queda en la última que se carga.
  - Se borran los jugadores ficticios de la semilla ("Jugador Millonarios 1"...) y sus estadísticas.
  - Se borran las cifras inventadas de `team_stats` 2026. La regla es: `team_stats` solo guarda temporadas descargadas.
- **MySQL:**
  - ligas 2024-I, 2024-II y la de demo;
  - 24 estadios nuevos, tomados de la sede de cada partido, con la capacidad de la sede del equipo;
  - 58 jornadas;
  - 432 partidos `FINISHED` con marcador.
- **Se conservan los datos de demo con apuestas.**
  - No se borra ningún partido `BP26…`; había 2 apuestas en `BP261802`.
  - Los que siguen programados y quedaron en el pasado se corren semanas completas hacia el futuro, para que sigan jugables.

### Partidos jugables de demo (claramente marcados)

- **30 réplicas de las jornadas 1 a 3 de la Finalización 2024,** en la liga **`DM` "Liga BetPlay · demo (réplica de 2024-II)"**. El código empieza por `DM` (por ejemplo `DM265101`): **no son partidos reales**.
- **Llevan los mismos equipos, estadios y horas;** las fechas se corren para que la primera quede mañana, conservando el espaciado real entre jornadas. Quedan `SCHEDULED` y sin resultado.
- **Si se vuelve a correr el loader:**
  - una réplica ya finalizada no se toca;
  - una réplica programada con la fecha vencida se vuelve a correr hacia el futuro.

### Modelo de cuotas (`backend/scripts/seed/oddsModel.js`)

- **Se aplica solo a las réplicas `DM`:** 1X2 y total de goles con línea 2,5.
- **Cálculo, desde `team_stats`:**
  1. Ataque = goles a favor por partido ÷ promedio de la liga. Defensa = goles en contra por partido ÷ promedio.
  2. Se suavizan hacia el promedio, como si cada equipo tuviera 5 partidos promedio extra, para evitar cuotas extremas.
  3. Goles esperados, con una distribución de Poisson:
     - local = promedio × ataque local × defensa visitante × 1,12 (ventaja de local);
     - visitante = promedio × ataque visitante × defensa local ÷ 1,12.
  4. Con las probabilidades de 0 a 10 goles por lado salen P(local), P(empate), P(visitante) y P(más de 2,5).
  5. Cuota = 1 ÷ (probabilidad × 1,06), redondeada hacia abajo a 2 decimales y nunca menor a 1,01.
- **Resultado:** en los 30 partidos el margen real de la casa quedó entre 6,07 % y 6,59 %. Las pruebas exigen entre 5 % y 8 %, y cuotas mayores a 1, en los 380 cruces posibles.

### Escudos (`GET /api/teams/:teamCode/crest`)

- **El escudo se busca en este orden:**
  1. Google Drive, si hay `GDRIVE_CRESTS_FOLDER_ID` y credenciales de Firebase. Busca `<team_code>.png` en esa carpeta con la misma cuenta de servicio y el scope `drive.readonly`. El token se firma con `jsonwebtoken`, que ya estaba instalado, así que no hay dependencias nuevas.
  2. El archivo `backend/data/crests/<team_code>.png`.
  3. Un SVG genérico con el código del equipo.
- **Nunca responde 500.** Si Drive o el disco fallan, pasa al siguiente paso. Si el código no son 3 letras responde 400, y eso también impide salir de la carpeta.
- **Caché:**
  - en memoria, por una hora;
  - `ETag`: responde 304 si el escudo no cambió;
  - `Cache-Control` de un día (5 minutos para el genérico).
- **`crest_url` siempre es `/api/teams/<code>/crest`**, aunque PostgreSQL esté caído.
- **Frontend:** el componente `TeamShield` (carga diferida y, si la imagen falla, muestra las iniciales) aparece en las tarjetas de partido, el cupón, el panel admin y el histórico.

### API de partidos

- **`GET /api/matches` ya no devuelve los 469 partidos.**
  - Por defecto (`view=current`) trae los programados o en juego y los de los últimos 30 días.
  - Con `view=history&team=MIL&limit=20&offset=0` trae el histórico real, paginado.
  - Un parámetro inválido responde 400.
- **El panel admin usa la misma vista actual** y finaliza las réplicas `DM` igual que en la Fase 2.

## Fase 4 · Registro e inicio de sesión con Google (12 de noviembre de 2026)

### Datos (SQL Server, `database/sqlserver/03_auth_provider.sql`)

- **Catálogo `auth_provider`** con los valores LOCAL (1) y GOOGLE (2), y la columna `users.auth_provider_id`. Los usuarios que ya existían quedaron LOCAL gracias al `DEFAULT 1`.
- **`password_hash` admite NULL** y hay un nuevo `google_uid VARCHAR(128)`. Es VARCHAR porque el UID de Firebase tiene longitud variable.
- **`google_uid` es único con un índice filtrado** (`WHERE google_uid IS NOT NULL`): un UNIQUE normal de SQL Server solo admite un NULL.
- **El CHECK `ck_users_auth_provider`** garantiza la coherencia en la base: LOCAL siempre tiene contraseña; GOOGLE siempre tiene UID y nunca contraseña.
- **El script activa `QUOTED_IDENTIFIER`,** porque sqlcmd lo trae apagado y los índices filtrados lo exigen. El driver de Node lo trae activo.

### Flujo

1. El navegador abre el popup de Google con el SDK de Firebase (`signInWithPopup`) y obtiene un `idToken`.
2. `POST /api/auth/google` lo verifica con `firebase-admin`, que revisa la firma, el proyecto, el vencimiento y la revocación. Además exige `email_verified` y que el proveedor sea `google.com`.
   - **Si la cuenta existe**, por `google_uid` o por un correo de una cuenta GOOGLE, inicia sesión con el **mismo JWT en cookie HttpOnly** que el login local y registra `GOOGLE_LOGIN`.
   - **Si el correo es de una cuenta LOCAL**, responde 409: "ya existe una cuenta con ese correo; entra con tu contraseña". **No se enlazan cuentas automáticamente:** alguien con acceso a un Gmail no debe poder tomar una cuenta creada con contraseña.
   - **Si no existe**, responde `202 PROFILE_INCOMPLETE` y no crea nada.
3. `/complete-profile` pide lo que Google no entrega: tipo y número de documento, fecha de nacimiento y la casilla de términos. `POST /api/auth/google/complete` vuelve a verificar el idToken, valida todo, devuelve 400 con la **lista de campos** inválidos y crea `users` (USR, GOOGLE, sin contraseña) y `customer` en una transacción y la cuenta en PostgreSQL con saldo 0. Si PostgreSQL falla, borra el usuario creado (la misma compensación del registro local) y responde 503.
4. La sesión de Firebase en el navegador se cierra apenas termina el flujo: desde ahí manda la cookie de El Dorado.

### Otras decisiones

- **El usuario se genera a partir del correo:** `maria.perez@gmail.com` da `maria.perez`. Si ya existe, se agregan 4 dígitos al azar, y si dos registros chocan al mismo tiempo se reintenta.
- **Formato del documento:**
  - CC: 6 a 10 dígitos;
  - CE: 6 a 12 dígitos;
  - PEP: 6 a 15 dígitos;
  - pasaporte: 5 a 20 letras o números.

  Se aceptan con puntos y se guardan sin ellos. El documento duplicado se revisa antes de crear (409) y también lo detiene el UNIQUE de la base.
- **Una cuenta GOOGLE no entra con contraseña:** el login local responde 401 `GOOGLE_ACCOUNT` con el mensaje "Esta cuenta se creó con Google: entra con el botón «Continuar con Google»", y lo audita como `LOGIN_FAIL` con el motivo `GOOGLE_ACCOUNT`.
- **Errores:** 401 si el token es inválido, está vencido, no es de Google o el correo no está verificado; 400 para la validación; 409 para duplicados. Si Firebase no responde o faltan las credenciales, 503: es un problema del servidor, no del token.
- **Una sola app de `firebase-admin`** (`config/firebase.js`) sirve a Firestore (pagos) y a Authentication.
- **Los `VITE_FIREBASE_*` son la configuración web pública** del proyecto: van al navegador y no son secretos. Las protecciones son los dominios autorizados de Firebase y la verificación del idToken en el backend.
- **Dominios autorizados:** se comprobó por la API de administración, en modo de solo lectura, que `localhost` está autorizado y el proveedor Google activo.

## Regresión · El Widget dejó de abrir con 403 (12 de noviembre de 2026)

- **Causa:** el arreglo anterior agregó `redirectUrl: <origen>/wallet` al Widget, es decir, `http://localhost:5173/wallet`. Era el único parámetro que cambió: la firma, la referencia, el monto y la llave son iguales y `POST /api/payments/prepare` no cambió.
- **Reproducción**, con una firma válida calculada en el servidor:
  - `https://checkout.wompi.co/p/?mode=widget&...` responde **403** con la página de error de su CDN ("The request could not be satisfied") cuando lleva `redirect-url` hacia localhost, sea `http` o `https`;
  - responde 200 sin `redirect-url`, o con la URL del ejemplo oficial.
- **Lo que dice la documentación:** `redirectUrl` es opcional y debe "pertenecer a tu sitio web". No menciona localhost; el bloqueo lo mostró la prueba.
- **Decisión:**
  - Se quita `redirectUrl` y el resultado depende del callback del Widget.
  - Con id de transacción, se consulta al backend hasta un estado final o hasta el tope.
  - Sin id, se hace una consulta por referencia y, si aún no hay decisión, se muestra de inmediato "Todavía no recibimos la confirmación de Wompi" con "Verificar de nuevo".
  - El manejo del `?id=` al volver a `/wallet` se conserva, por si algún día hay una URL pública.
- **Prueba de regresión:** el Widget se crea solo con `currency`, `amountInCents`, `reference`, `publicKey` y `signature`.

## Arreglo · La recarga se quedaba en "Procesando…" (12 de noviembre de 2026)

### Causa real

**El frontend nunca consultó al backend.**

- `RechargePanel` guardaba `active = useRef(true)` y lo apagaba en la limpieza de un efecto.
- En desarrollo, `<StrictMode>` monta, desmonta y vuelve a montar cada componente. La limpieza dejaba `active.current = false` y nada lo volvía a encender.
- Cuando el Widget llamaba el callback, el panel pasaba a "Procesando…". El bucle de consulta salía sin dar una sola vuelta, y el aviso de tope tampoco se mostraba, porque también miraba `active.current`.

El documento de Firestore seguía `CREATED` con `updated_at` igual a `created_at`, mientras Wompi Sandbox ya tenía la transacción APPROVED. Una prueba con la versión anterior dentro de StrictMode lo reprodujo: 0 consultas tras 90 segundos simulados.

Sin StrictMode (en un build de producción) el bug no se veía. Por eso las pruebas de componentes corren ahora dentro de `<StrictMode>`.

### Qué cambió

- **El ref de montaje se enciende en cada montaje** (`mounted.current = true` dentro del efecto). Cada verificación lleva un número: si empieza otra, la anterior se detiene, así no corren dos a la vez.
- **Tres caminos para obtener el resultado, y todos terminan en el backend:**
  - **(a) redirect-url.** El Widget se abre con `redirectUrl: <origen>/wallet`. Según docs.wompi.co, Wompi lleva al usuario allí con `?id=<id de transacción>` al presionar "Volver al comercio". La página lee ese id, lo verifica con `GET /api/payments/transactions/:id` y lo quita de la barra de direcciones. La doc dice que la redirección es solo informativa: por eso el id siempre se verifica con Wompi desde el backend, con la llave privada.
  - **(b) callback del Widget,** con `result.transaction.id` si viene.
  - **(c) solo la referencia.** El backend consulta `GET /v1/transactions?reference=…`. **Se verificó en vivo en Sandbox:** con la llave privada responde 200 con `{ data: [...] }` y con la pública responde 401.
- **El backend responde `PENDING`** (y guarda `stored_status` y `wompi_status`) mientras Wompi no tiene decisión. Solo `CREDITED`, `DECLINED`, `ERROR` y `VOIDED` son finales.
- **Un id que pertenece a otra referencia se descarta** y se busca por la referencia propia. Así un id equivocado no deja la recarga en `ERROR`. La transacción encontrada debe coincidir en referencia, monto y moneda con lo firmado. Todo acredita solo con `fn_recargar`, que es idempotente: los tres caminos y el webhook juntos acreditan una vez.
- **La recarga pendiente se guarda en `sessionStorage`** de la pestaña. Si la persona vuelve a `/wallet` sin `?id=`, se verifica sola. Si el almacenamiento está bloqueado, el flujo sigue funcionando por los otros caminos.
- **La pantalla siempre termina en un estado claro:**
  - "Pago aprobado";
  - "Pago rechazado";
  - "Todavía no recibimos la confirmación de Wompi", con el botón "Verificar de nuevo", después de 20 consultas (unos 60 segundos). Un 4xx detiene la verificación y muestra el error.
- **Recarga en caliente en Docker sobre Windows.** Durante el diagnóstico apareció un segundo problema: el contenedor seguía corriendo código viejo, porque en Windows los cambios de un volumen montado no generan eventos de archivo. Ahora nodemon corre con `--legacy-watch` y Vite con `VITE_USE_POLLING=true`.
- **Pruebas de componentes con Vitest, Testing Library y jsdom** (gratis, solo para desarrollo), con `npm test` en `frontend/`.
- **Una advertencia de lint que se acepta:** `set-state-in-effect` en el efecto que verifica al volver de Wompi. Ese efecto sincroniza con un sistema externo (la URL y el backend), que es el uso previsto de un efecto.

## Fase 3 · Recargas con Wompi Sandbox, contraseña y auditoría (12 de noviembre de 2026)

### Lo que dice la documentación oficial de Wompi (consultada hoy)

- **Firma de integridad** (guía "Widget & Checkout Web"): `SHA256(referencia + monto en centavos + moneda + secreto de integridad)`. La fecha de expiración es opcional y no se usa. La prueba compara el resultado con el ejemplo oficial de la página (`37c84077…3bf5`).
- **Checksum de eventos** (guía "Eventos"): se concatenan los valores de `signature.properties` tomados de `data`, después `timestamp` y después el secreto de eventos, y se aplica SHA256. Wompi espera un `200`; si no lo recibe, reintenta a los 30 minutos, a las 3 horas y a las 24 horas.
- **Consulta de transacciones:** "Seguimiento de transacciones" y "Transacciones" dicen que `GET /v1/transactions/{id}` **solo funciona con la llave privada** (`Authorization: Bearer prv_…`), desde el backend. Con la llave pública o sin llave responde 404.
- **Diferencia con lo pedido:** **la consulta por `?reference=` no aparece en las guías oficiales que se leyeron.** Solo la mencionan terceros, que citan la referencia "Buscar transacciones". Por eso:
  - el frontend envía el id de la transacción que entrega el callback del Widget (`result.transaction.id`) y el backend consulta por id;
  - `?reference=` queda solo como respaldo, cuando aún no se conoce el id.
- **Tarjetas de Sandbox** (guía "Datos de prueba"): 4242 4242 4242 4242 aprueba y 4111 1111 1111 1111 declina. Cualquier otra termina en `ERROR`.
- **Prefijos de las llaves** (guía "Ambientes y llaves"): en Sandbox son `pub_test_`, `prv_test_`, `test_events_` y `test_integrity_`; en producción, `pub_prod_`, `prv_prod_`, `prod_events_` y `prod_integrity_`.

### Solo Sandbox, siempre

- **La API revisa el prefijo de cada llave y la URL** (`config/wompi.js`). Si no son de Sandbox, `prepare`, la consulta y el webhook responden `503 PAYMENTS_NOT_CONFIGURED`. La respuesta dice qué llave está mal, pero nunca muestra su valor. Proyecto académico: no debe existir ningún camino que cobre dinero real.
- **El `.env` local tenía llaves de producción**, y hoy los pagos quedan bloqueados por esta revisión. Hay que reemplazarlas por las de Sandbox.

### Flujo de una recarga

1. `POST /api/payments/prepare` valida el monto (entero JSON entre `WOMPI_MIN_COP` y `WOMPI_MAX_COP`), crea la referencia `ELD-<uuid>`, la firma y guarda el documento `CREATED` en Firestore (`payments/<reference>`).
2. El usuario paga en el Widget oficial.
3. El estado llega por **dos caminos que terminan en la misma función** (`applyTransaction`):
   - la consulta directa a Wompi, `GET /api/payments/:reference`, que es la que funciona hoy sin URL pública;
   - el webhook, `POST /api/payments/webhook`, que funcionará cuando haya URL pública.
4. Si Wompi dice APPROVED, `fn_recargar(username, monto, reference)` acredita y el documento pasa a `CREDITED`.

Decisiones sobre ese flujo:

- **Una sola acreditación.** `fn_recargar` es idempotente por `reference`: si los dos caminos llegan a la vez, o el evento se repite, se acredita una sola vez. Firestore es el registro del pago, no el candado; el candado es PostgreSQL.
- **Se revisa que la transacción sea la firmada.** Referencia, monto en centavos y moneda deben coincidir con el documento. Si no, la recarga queda `ERROR` y no se acredita.
- **El webhook verifica el checksum antes de leer nada**, con comparación en tiempo constante, y responde 401 si no coincide. Se monta con `express.raw()` antes de `express.json()`. Un evento auténtico pero ignorado (otro tipo, de producción o con una referencia desconocida) responde 200 para que Wompi no reintente. Si PostgreSQL está caído responde 503, y así Wompi sí reintenta.
- **`CREDITED` nunca vuelve atrás:** un evento viejo que llega tarde no cambia el estado.
- **Firestore caído o sin credenciales** responde 503 solo en las rutas de pagos. `FIREBASE_PRIVATE_KEY` acepta saltos de línea reales o `\n` escritos.
- **Se eliminó la ruta `POST /api/auth/balance/deposit`.** Ya no hay ninguna ruta que sume saldo sin pago. El único otro crédito es la semilla de demo, un script de consola que también pasa por `fn_recargar`. Los retiros siguen deshabilitados.
- **El script `scripts/simulate-wompi-webhook.js`** arma un evento con la misma estructura de la documentación, lo firma y lo envía, para demostrar el webhook sin túnel.

### Contraseña, cédula y auditoría

- **Política:** mínimo 10 caracteres, mayúscula, minúscula, número y símbolo, sin espacios, y sin contener el usuario ni el correo (tampoco la parte antes de la @). El backend la aplica siempre en el registro y responde `400 WEAK_PASSWORD` con `failed_rules`.
- **Una copia en el frontend.** La versión del navegador (`frontend/src/utils/passwordPolicy.js`) es una copia porque el contenedor del frontend no ve la carpeta del backend. Una prueba compara que las dos den el mismo resultado.
- **La barra tiene 4 colores y un checklist** en el que cada regla lleva un ícono ✔ o ✖ y su texto, no solo el color. El nivel 4 (verde) exige cumplir todas las reglas.
- **`DocumentInput`** muestra la cédula con puntos de miles mientras se escribe y envía solo los dígitos. No se enmascara y nunca va a los logs.
- **Eventos de auditoría:**
  - `LOGIN_OK` y `LOGIN_FAIL`, con el motivo: usuario desconocido, contraseña errada o cuenta inactiva. Nunca se guarda la contraseña ni lo que se escribió como usuario.
  - `USER_CREATED`.
  - `RECHARGE_CREATED`, `RECHARGE_APPROVED` y `RECHARGE_DECLINED`.
- **Los eventos viejos siguen siendo válidos.** El validador de `audit_log` en Mongo admite los nuevos y conserva los antiguos (`LOGIN`...) para los registros ya guardados. La auditoría nunca bloquea la operación.

## Fase 2 · Apuestas, roles y liquidación (12 de noviembre de 2026)

### El dinero vive en PostgreSQL

- **Cinco funciones PL/pgSQL en `database/postgres/03_bets.sql`:** `fn_recargar`, `fn_crear_apuesta`, `fn_liquidar_apuesta`, `fn_liquidar_partido` y `fn_anular_apuesta`. Node solo hace `SELECT fn_...()`. No hay ningún `UPDATE account` en JavaScript.
- **Todas bloquean primero la cuenta (`FOR UPDATE`) y después la apuesta.** Siempre en el mismo orden, así dos operaciones no se bloquean entre sí en círculo. Por eso dos apuestas simultáneas del mismo usuario se hacen una detrás de otra, y la segunda ve el saldo ya descontado.
- **La idempotencia se revisa después del bloqueo.** Un doble clic manda dos peticiones con la misma `Idempotency-Key`. La segunda espera, encuentra la apuesta de la primera y la devuelve sin cobrar otra vez. Si la misma clave llega con otro monto u otra selección, responde 409.
- **Los errores de negocio tienen un código fijo** (`INSUFFICIENT_FUNDS`, `STAKE_OUT_OF_RANGE`...). La API lo traduce a HTTP en `utils/pgErrors.js`.
- **La función revisa los decimales antes de guardar.** `NUMERIC(14,2)` redondea en silencio (1000,129 quedaría como 1000,13), así que un monto con más de 2 decimales se rechaza antes de llegar a la tabla.
- **Límites de apuesta en tres capas:** la API los lee de `BET_MIN_COP` y `BET_MAX_COP`; la semilla los copia a la tabla `bet_limit`, que lee la función; y el `CHECK ck_bet_stake_limits` de `bet` es un tope duro de 1.000 a 500.000. Un `CHECK` no puede leer variables de entorno: si se amplían los límites en el `.env`, hay que cambiar también ese `CHECK`.
- **El estado 0 de apuesta pasó de `PENDING` a `OPEN` ("Abierta")**, como piden las reglas de anulación. Se agregó `REFUNDED` ("Devuelta") para el empate exacto contra la línea: hándicap -1 con victoria por un gol, o total 3 con 3 goles.
- **La recarga de la semilla de demo ahora usa `fn_recargar`.** Ya no queda ninguna operación de dinero fuera de PL/pgSQL.

### La apuesta recorre los cuatro motores

`POST /api/bets` valida en este orden, cada motor lo suyo:

1. La entrada. El monto debe ser un número JSON: un texto como `"5000"` se rechaza para no adivinar.
2. SQL Server: el usuario sigue activo. Un JWT válido de un usuario desactivado ya no apuesta.
3. MySQL: el partido existe, está programado y no ha empezado. La cuota vigente se lee de aquí.
4. MongoDB: el mercado, la selección y la línea son válidos.
5. PostgreSQL: `fn_crear_apuesta`.
6. Auditoría en MongoDB. No se espera: si Mongo falla, la apuesta ya está hecha y solo se avisa en consola.

- **La cuota del cliente nunca se usa.** El cliente puede mandar `expected_odds` solo para enterarse de que la cuota cambió: si no coincide con la de MySQL, responde `409 ODDS_CHANGED` con la cuota nueva y el cupón le pide confirmarla.
- **Solo apuestas simples:** un cuerpo con `selections` (combinada) responde 400. En la base, `bet_leg.bet_id` sigue siendo UNIQUE.

### Liquidación

- **La API calcula el resultado de cada selección** (`services/settlementService.js`) y `fn_liquidar_partido` paga todo en una sola transacción. Si falta el resultado de alguna selección apostada, no se paga nada.
- **El orden es MySQL primero y después PostgreSQL, con compensación.** Se marca `FINISHED` con un `UPDATE ... WHERE status IN (programado, en juego)`: es atómico, así que si dos administradores finalizan a la vez solo uno gana (el otro recibe 409). Si la liquidación en PostgreSQL falla, el partido vuelve a su estado anterior y se puede reintentar. Es el mismo patrón que el registro: no hay transacciones entre motores.
- **El administrador puede finalizar un partido aunque su fecha sea futura.** Así se puede hacer la demo sin esperar al partido real.
- **"Otro marcador" (`OTHER`)** gana cuando el resultado no está entre los marcadores listados en MongoDB.

### Roles

- **El rol viaja en el JWT** con el código de la tabla `role` de SQL Server. `requireRole('ADM')` responde 403 antes de tocar cualquier base.
- **El administrador sale solo de la semilla** (`ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_DOCUMENT`). El registro público siempre crea `USR`, aunque el cuerpo pida otro rol.
- **El administrador no apuesta:** `POST /api/bets` exige el rol `USR`. En la interfaz, el ADM no ve "Mis apuestas" ni la billetera, y el USR no ve "Administración".
- **Se eliminó la pantalla genérica `AdminDataPage`** y su servicio. Las escrituras genéricas siguen respondiendo 403. La única escritura de administración es finalizar un partido.

### Frontend

- **Todo viene de `GET /api/matches`**, que ya combina MySQL, PostgreSQL y MongoDB por `match_code`, `team_code` y `market_code`. El frontend no conoce ningún id autoincremental.
- **El cupón acepta una sola selección:** elegir otra cuota la reemplaza. La `Idempotency-Key` se genera en el navegador y cambia solo cuando cambia la apuesta.
- **La interfaz nunca calcula el saldo.** Muestra el que devuelve la API después de apostar. El bono de bienvenida que sumaba saldo falso se quitó de la página de inicio; las promociones siguen siendo solo visuales.
- **La cédula se muestra con puntos de miles** (`formatDocument`) en el perfil.

### Arreglo de datos: tildes en MySQL

La imagen oficial de MySQL leía los scripts de `database/mysql/` como latin1, y en la base quedaban textos como `FÃºtbol`. Se agregó `SET NAMES utf8mb4;` al inicio de los dos scripts y se reparó tu base local una sola vez, con un `UPDATE ... CONVERT` limitado a las filas dañadas. Se comprobó con un contenedor nuevo y vacío que ahora carga bien.

## Fase 1 · Cimientos multi-motor (12 de noviembre de 2026)

### Seguridad

- **Toda escritura genérica responde 403.** Antes cualquiera, sin sesión, podía crear saldo, partidos o cuotas con un POST. Un solo middleware (`blockWrites`) al final de las rutas bloquea todo POST, PUT, PATCH o DELETE que no tenga una ruta propia. Así no se puede olvidar ninguna. Vuelven en la Fase 2, solo para el rol ADM.
- **Los datos personales y de dinero exigen sesión y devuelven solo lo del dueño.** `customer`, `account`, `balance_movement`, `bet` y `login_history` leen el usuario del JWT. Se eliminaron las rutas `/:id` de cliente y cuenta, y la lista `/api/users`: no hay razón para que un usuario pida a otro por id.
- **El depósito directo y el retiro responden 403.** Movían dinero desde Node sin pago real. El retiro no estaba en la lista, pero tenía el mismo problema; vuelve con las funciones PL/pgSQL.
- **El JWT ahora lleva `username` y `role`.** PostgreSQL identifica la cuenta por `username`, así las rutas de dinero no necesitan consultar SQL Server. Los tokens viejos (sin `username`) se rechazan y piden iniciar sesión de nuevo.
- **La API usa un login propio en SQL Server (`el_dorado_app`)**, con permisos de lectura y escritura, y no la cuenta `sa`.
- **Las bases solo escuchan en 127.0.0.1** en tu equipo. Dentro de Docker se hablan por nombre de servicio en la red `eldorado_net`.

### Reparto y claves naturales

- No existía `backend/docs/schema.sql`. El esquema se reconstruyó desde `domainDefinitions.js`, las consultas y `example-data.sql`. **Suposiciones:**
  - Los catálogos conservan sus nombres de columna (`id_status_user`, `id_status_match`, etc.) y sus valores de `backend/docs/ids.md`.
  - `company` no está en ningún motor del reparto, así que no se creó. Si se necesita, hay que decidir dónde va.
  - `player.nationality_id` pasa a `nationality_code CHAR(3)` (país ISO) porque `country` vive en MySQL y el jugador en PostgreSQL: no puede haber FK entre ellos.
  - El mercado "goles de jugador" y los mercados de tarjetas de `ids.md` se reemplazaron por los 5 mercados pedidos (1X2, total de goles, marcador exacto, ambos anotan, hándicap).
  - Los equipos ya no tienen `league_id` ni `stadium_id`: la liga y el estadio están en MySQL y el equipo en PostgreSQL. El estadio se asigna a cada partido.
- **Claves naturales elegidas:**
  - `username`: une SQL Server con la cuenta de PostgreSQL.
  - `match_code CHAR(8)`: liga + año + jornada + número, por ejemplo `BP261801`. Lo usan `odds` (MySQL) y `bet_leg` (PostgreSQL).
  - `team_code CHAR(3)`, por ejemplo `MIL` o `NAC`. MySQL lo usa en `match.home_team_code` y `away_team_code`.
  - `market_code` y `outcome_code`, por ejemplo `1X2` y `HOME`. Viven en MongoDB y los usan `odds` y `bet_leg`.
- **El hándicap se expresa siempre desde el equipo local**, para que una sola línea describa el mercado.
- **La línea vale 0 cuando el mercado no la usa**, en lugar de NULL, porque MySQL permite varios NULL en un índice único y eso dejaría duplicar cuotas.

### Tipos de datos

- **VARCHAR solo donde la longitud varía de verdad**, siempre con un comentario: nombres, correos, teléfonos, IP, documentos (un pasaporte tiene letras) y códigos de mercado.
- **CHAR donde la longitud es fija:** `password_hash CHAR(60)` (bcrypt siempre mide 60), `match_code CHAR(8)`, `team_code CHAR(3)` y los códigos de país.
- **En PostgreSQL se usa TEXT con CHECK de longitud.** Es lo que recomienda su documentación y no es VARCHAR.
- **En SQL Server se usa NVARCHAR para texto con tildes** (nombres y direcciones).
- **La temporada de la liga son dos números** (`season_year` y `season_half`) en lugar del texto `'2026-II'`.
- **`team_stats.points` es una columna calculada** (`victorias × 3 + empates`), así nunca queda desalineada.

### Dinero

- **`account.balance` guarda el saldo**, con `CHECK (balance >= 0)`. Antes se calculaba sumando movimientos en cada consulta. Ahora las funciones PL/pgSQL de la Fase 2 bloquean la fila de la cuenta (`FOR UPDATE`) y actualizan saldo y movimiento juntos.
- **`balance_movement.reference` es UNIQUE**, por ejemplo `SEED:demo`, `WOMPI:<id>` o `BET:<tiquete>`. Si el mismo evento llega dos veces (por ejemplo un webhook repetido), el segundo INSERT falla y el saldo no se duplica.
- **`bet_leg.bet_id` es UNIQUE: la base de datos impide las apuestas combinadas.** Si algún día se permiten, basta con quitar esa restricción.
- **`bet.idempotency_key UUID UNIQUE`** queda lista para el header `Idempotency-Key` de la Fase 2.
- **El saldo de la semilla de demo se carga con una sola sentencia SQL atómica** (CTE con `FOR UPDATE` y `ON CONFLICT DO NOTHING`). Es la única operación de dinero fuera de PL/pgSQL y solo corre en la semilla. En la Fase 2 se reemplaza por `fn_recargar`.
- **`POST /api/bets` responde 503** hasta que exista `fn_crear_apuesta`. La lógica vieja escribía en tablas de SQL Server que ya no existen.

### Registro en dos motores

No hay transacciones entre motores. El registro crea `users` y `customer` en SQL Server (en una transacción) y luego `account` en PostgreSQL. Si PostgreSQL falla, se **compensa**: se borra el usuario recién creado. Además, el registro exige que las dos bases estén arriba antes de empezar (`requireDb('sqlserver', 'pg')`).

### Tolerancia a fallos

- **Cada motor tiene su propio pool, que se crea al primer uso.** El servidor arranca aunque una base esté caída.
- **`requireDb('pg')`** hace un ping corto (guardado 3 segundos) y responde 503 con el nombre del motor. Si la base cae entre el ping y la consulta, el manejador de errores reconoce el error de conexión y también responde 503.
- **`GET /api/health` responde 200 aunque haya bases caídas**, con `status: "degraded"`. La API sigue viva, y así el healthcheck del contenedor no reinicia el backend por culpa de una base.
- **El inicio de sesión solo depende de SQL Server.** Si PostgreSQL está caído, entras igual y el saldo llega como `null`.
- **Los catálogos de un motor caído se listan en `unavailable`** en `GET /api/catalogs`, en lugar de tumbar toda la respuesta.

### Docker

- **`db-init` usa la misma imagen de SQL Server**, que ya trae `sqlcmd`. Así no se descarga una imagen extra. Corre en cada `up`, y como los scripts son idempotentes no pasa nada.
- **Los healthchecks de MySQL y PostgreSQL se conectan por TCP a 127.0.0.1.** Durante la carga inicial esos motores solo escuchan por socket, así el servicio no se marca sano antes de terminar los scripts. El de Mongo espera a que exista `audit_log`, que es lo último que crea el script.
- **SQL Server se limita a 2 GB** (`MSSQL_MEMORY_LIMIT_MB`) para que quepan los cuatro motores en 8 GB.
- **La semilla de demo corre al arrancar el backend.** Si falla, el servidor arranca igual. No se hizo un servicio aparte porque compartiría la carpeta `node_modules` con el backend y los dos `npm ci` chocarían.
- **Los partidos de la semilla se fechan desde el momento de la carga** (por ejemplo, dentro de 2 días), así siempre hay partidos futuros para apostar. Hay uno ya finalizado (`BP261701`) para probar la liquidación en la Fase 2.
- **La red no es `internal: true`.** Una red interna impediría publicar puertos y que el backend descargue paquetes con `npm ci`. Se usa una red bridge propia y los puertos de las bases solo en 127.0.0.1.
- **Los Dockerfiles multi-etapa quedan para el pendiente 13.** Por ahora el backend y el frontend usan `node:22-alpine` con el código montado, como antes.

### Pruebas

- **`node:test` (incluido en Node, gratis) sin supertest:** levanta la app en un puerto libre y usa `fetch`. Son 52 casos y no necesitan bases. Los motores apuntan a un puerto cerrado para comprobar que la respuesta es 503 y no 500.
