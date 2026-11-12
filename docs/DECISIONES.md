# Decisiones del proyecto

Registro en lenguaje simple de qué se decidió y por qué. Lo más reciente va primero.

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
