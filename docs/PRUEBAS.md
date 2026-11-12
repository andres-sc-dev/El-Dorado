# Pruebas

Resultados reales del 12 de noviembre de 2026. Fase 2 (apuestas) en `feat/fase-2-apuestas`; Fase 3 (recargas, contraseña y auditoría) en `feat/fase-3-wompi`.

## Cómo correrlas

```bash
# Unitarias y de seguridad (no necesitan bases; 82 casos)
cd backend && npm test

# Integración contra los contenedores (necesita docker compose up; 48 pruebas, 51 comprobaciones)
docker compose exec backend npm run test:integration
```

Las pruebas de integración usan `node:test` y `supertest` (los dos gratis) contra SQL Server, MySQL, PostgreSQL y MongoDB reales.
Crean sus propios usuarios (`zt_…`) y partidos (`ZT……`), y los borran al terminar: no tocan al usuario `demo` ni a los partidos `BP…`.
Cada ejecución reescribe la tabla en `backend/test/integration/report.md`, que Git ignora. La de abajo es una copia.

## Resultado

| Suite | Resultado |
|---|---|
| `npm test` (seguridad: 61 casos; reglas de liquidación: 21 casos) | **82 de 82 pasan** |
| `npm run test:integration` | **48 de 48 pasan** (51 comprobaciones en la tabla) |

## Integración: caso, esperado y obtenido

Los saldos están en COP. "Obtenido" es lo que respondió la API real en esta ejecución.

| # | Caso | Esperado | Obtenido | ¿Pasa? |
|---|---|---|---|---|
| 1 | stake 0 | 400 INVALID_STAKE | 400 INVALID_STAKE | Sí |
| 2 | stake negativo (-5000) | 400 INVALID_STAKE | 400 INVALID_STAKE | Sí |
| 3 | stake NaN (texto "NaN") | 400 INVALID_STAKE | 400 INVALID_STAKE | Sí |
| 4 | stake null | 400 INVALID_STAKE | 400 INVALID_STAKE | Sí |
| 5 | stake texto ("cinco mil") | 400 INVALID_STAKE | 400 INVALID_STAKE | Sí |
| 6 | stake numérico como texto ("5000") | 400 INVALID_STAKE | 400 INVALID_STAKE | Sí |
| 7 | stake con 3 decimales (1000.123) | 400 INVALID_STAKE | 400 INVALID_STAKE | Sí |
| 8 | stake mínimo - 1 (999) | 400 STAKE_OUT_OF_RANGE | 400 STAKE_OUT_OF_RANGE | Sí |
| 9 | stake mínimo (1000) | 201 | 201 | Sí |
| 10 | stake mínimo + 1 (1001) | 201 | 201 | Sí |
| 11 | stake con 2 decimales (1000.55) | 201 | 201 | Sí |
| 12 | stake máximo - 1 (499999) | 201 | 201 | Sí |
| 13 | stake máximo (500000) | 201 | 201 | Sí |
| 14 | stake máximo + 1 (500001) | 400 STAKE_OUT_OF_RANGE | 400 STAKE_OUT_OF_RANGE | Sí |
| 15 | stake igual al saldo (20.000 de 20.000) | 201 saldo 0 | 201 saldo 0 | Sí |
| 16 | stake mayor al saldo (20.001 de 20.000) | 409 INSUFFICIENT_FUNDS saldo 20000 | 409 INSUFFICIENT_FUNDS saldo 20000 | Sí |
| 17 | cuota alterada por el cliente (expected_odds 9.99, real 2.00) | 409 ODDS_CHANGED 2 | 409 ODDS_CHANGED 2 | Sí |
| 18 | cuota cambió en MySQL (3.50 -> 4.25) | 409 ODDS_CHANGED 4.25 | 409 ODDS_CHANGED 4.25 | Sí |
| 19 | cliente envía odds: 50 en el cuerpo | 201 cuota 2 | 201 cuota 2 | Sí |
| 20 | partido ya iniciado | 409 MATCH_STARTED | 409 MATCH_STARTED | Sí |
| 21 | partido en juego (LIVE) | 409 MATCH_NOT_OPEN | 409 MATCH_NOT_OPEN | Sí |
| 22 | partido finalizado | 409 MATCH_NOT_OPEN | 409 MATCH_NOT_OPEN | Sí |
| 23 | partido inexistente (ZZ999999) | 404 MATCH_NOT_FOUND | 404 MATCH_NOT_FOUND | Sí |
| 24 | mercado inexistente (CORNERS) | 404 MARKET_NOT_FOUND | 404 MARKET_NOT_FOUND | Sí |
| 25 | selección que no es del mercado (1X2 / OVER) | 400 INVALID_SELECTION | 400 INVALID_SELECTION | Sí |
| 26 | línea no permitida (TOTAL_GOALS 3.0) | 400 INVALID_SELECTION | 400 INVALID_SELECTION | Sí |
| 27 | apuesta combinada (varias selecciones) | 400 SIMPLE_BETS_ONLY | 400 SIMPLE_BETS_ONLY | Sí |
| 28 | usuario inactivo en SQL Server (JWT aún válido) | 403 USER_INACTIVE | 403 USER_INACTIVE | Sí |
| 29 | JWT ausente | 401 | 401 | Sí |
| 30 | JWT vencido | 401 | 401 | Sí |
| 31 | JWT con firma falsa (rol ADM inventado) | 401 | 401 | Sí |
| 32 | sin header Idempotency-Key | 400 IDEMPOTENCY_KEY_REQUIRED | 400 IDEMPOTENCY_KEY_REQUIRED | Sí |
| 33 | USR -> GET /api/admin/matches | 403 FORBIDDEN_ROLE | 403 FORBIDDEN_ROLE | Sí |
| 34 | USR -> POST /api/admin/.../finish | 403 FORBIDDEN_ROLE SCHEDULED | 403 FORBIDDEN_ROLE SCHEDULED | Sí |
| 35 | ADM -> POST /api/bets | 403 FORBIDDEN_ROLE | 403 FORBIDDEN_ROLE | Sí |
| 36 | registro público con role: ADM en el cuerpo | USR | USR | Sí |
| 37 | inyección en match_code (BP261801' OR '1'='1) | 400 INVALID_MATCH | 400 INVALID_MATCH | Sí |
| 38 | inyección en market_code (1X2'; DROP TABLE bet;--) | 400 INVALID_SELECTION | 400 INVALID_SELECTION | Sí |
| 39 | inyección en el login (' OR 1=1 --) | 401 | 401 | Sí |
| 40 | doble clic (2 peticiones simultáneas, misma Idempotency-Key) | 200+201 mismo tiquete 1 apuesta saldo 40000 | 200+201 mismo tiquete 1 apuesta saldo 40000 | Sí |
| 41 | misma Idempotency-Key con otro monto | 409 IDEMPOTENCY_KEY_REUSED | 409 IDEMPOTENCY_KEY_REUSED | Sí |
| 42 | CONCURRENCIA: saldo 30.000, 2 × 20.000 a la vez | 201 + 409 INSUFFICIENT_FUNDS saldo 10000 1 apuesta | 201 + 409 INSUFFICIENT_FUNDS saldo 10000 1 apuesta | Sí |
| 43 | CONCURRENCIA: saldo 30.000, 10 × 5.000 a la vez | 6 creadas saldo 0 | 6 creadas saldo 0 | Sí |
| 44 | ADM finaliza 2-1 (5 apuestas: 3 ganan, 1 pierde, 1 devuelta) | 200 liquidadas 5 ganadas 3 perdidas 1 devueltas 1 pagado 91000 | 200 liquidadas 5 ganadas 3 perdidas 1 devueltas 1 pagado 91000 | Sí |
| 45 | saldos después de liquidar | 121000 90000 100000 135000 | 121000 90000 100000 135000 | Sí |
| 46 | finalizar dos veces el mismo partido | 409 MATCH_ALREADY_FINISHED saldo 121000 | 409 MATCH_ALREADY_FINISHED saldo 121000 | Sí |
| 47 | GET /api/bets/me del ganador | WON,WON | WON,WON | Sí |
| 48 | marcador inválido (-1, "dos") | 400 INVALID_SCORE | 400 INVALID_SCORE | Sí |
| 49 | finalizar partido inexistente | 404 MATCH_NOT_FOUND | 404 MATCH_NOT_FOUND | Sí |
| 50 | fn_anular_apuesta sobre abierta y luego sobre anulada | reintegra 4000 saldo 10000 luego BET_NOT_OPEN | reintegra 4000 saldo 10000 luego BET_NOT_OPEN | Sí |
| 51 | fn_recargar dos veces con la misma referencia | true false saldo 15000 | true false saldo 15000 | Sí |

## Cómo se prueba la concurrencia

Las casillas 42 y 43 lanzan las peticiones al mismo tiempo con `Promise.all`. Cada una abre su propia conexión a PostgreSQL.
`fn_crear_apuesta` bloquea la fila de la cuenta con `SELECT ... FOR UPDATE`, así que la segunda espera a que la primera termine y ve el saldo ya descontado.
Con 30.000 de saldo, la primera apuesta de 20.000 deja 10.000 y la segunda recibe `409 INSUFFICIENT_FUNDS`.

El doble clic (casilla 40) funciona igual: las dos peticiones traen la misma `Idempotency-Key`.
La segunda espera el bloqueo, encuentra la apuesta que creó la primera y la devuelve con `200` sin cobrar otra vez.

## Recorrido manual (a través del frontend en http://localhost:5173)

Se hizo con las mismas peticiones que hace el navegador, a través del proxy de Vite:

| Paso | Resultado real |
|---|---|
| 1. Login como `demo` | rol `USR`, saldo 490.000 (ya tenía una apuesta abierta de 10.000 a `BP261802` 1X2 Local) |
| 2. Apostar 5.000 a `BP261802` "Ambos anotan: Sí" (cuota 1,95) | tiquete creado `OPEN`, pago posible 9.750, saldo 485.000 |
| 3. Login como `admin` | rol `ADM`; el panel muestra `BP261802` con 2 apuestas abiertas |
| 4. Finalizar `BP261802` con marcador 2-1 | `liquidadas 2, ganadas 2, perdidas 0, total pagado 29.250` |
| 5. `demo` revisa "Mis apuestas" y la billetera | las dos `WON` (pagos de 9.750 y 19.500), saldo **514.250** = 485.000 + 29.250 |
| Auditoría en MongoDB | eventos `LOGIN`, `BET_PLACED` y `MATCH_FINISHED` en `audit_log` |

`BP261802` quedó finalizado en tu base local. Quedan 5 partidos abiertos para seguir probando.

## Fase 3 · Recargas con Wompi, contraseña y auditoría

| Suite | Resultado |
|---|---|
| `npm test` en tu equipo: seguridad, liquidación, pagos (`payments.test.js`) y contraseña (`passwordPolicy.test.js`) | **123 de 123 pasan** |
| `npm test` dentro del contenedor | 122 pasan y 1 se omite: la comparación con la copia del frontend, porque allí no está montada la carpeta `frontend/` |
| `npm run test:integration` (apuestas y pagos) | **62 de 62 pasan** |

Las pruebas de pagos **no escriben en tu Firestore ni llaman a Wompi**: usan dobles en memoria y secretos de prueba con formato Sandbox.
Las de integración sí usan `fn_recargar` real en PostgreSQL y el registro real en SQL Server.

### Pagos: caso, esperado y obtenido (integración)

| # | Caso | Esperado | Obtenido | ¿Pasa? |
|---|---|---|---|---|
| 1 | recarga: monto 0 | 400 INVALID_AMOUNT | 400 INVALID_AMOUNT | Sí |
| 2 | recarga: monto negativo (-10.000) | 400 INVALID_AMOUNT | 400 INVALID_AMOUNT | Sí |
| 3 | recarga: monto texto ("50000") | 400 INVALID_AMOUNT | 400 INVALID_AMOUNT | Sí |
| 4 | recarga: monto con decimales (10.000,5) | 400 INVALID_AMOUNT | 400 INVALID_AMOUNT | Sí |
| 5 | recarga: menor al mínimo (9.999) | 400 AMOUNT_OUT_OF_RANGE | 400 AMOUNT_OUT_OF_RANGE | Sí |
| 6 | recarga: mínimo exacto (10.000) | 201 | 201 | Sí |
| 7 | recarga: máximo exacto (3.000.000) | 201 | 201 | Sí |
| 8 | recarga: mayor al máximo (3.000.001) | 400 AMOUNT_OUT_OF_RANGE | 400 AMOUNT_OUT_OF_RANGE | Sí |
| 9 | firma de integridad = SHA256(reference + centavos + COP + secreto) | coincide | coincide | Sí |
| 10 | webhook con checksum inválido | 401 INVALID_CHECKSUM saldo 0 | 401 INVALID_CHECKSUM saldo 0 | Sí |
| 11 | evento APPROVED duplicado 4 veces | 200,200,200,200 saldo 50000 1 recarga | 200,200,200,200 saldo 50000 1 recarga | Sí |
| 12 | pago DECLINED | 200 DECLINED saldo 0 | 200 DECLINED saldo 0 | Sí |
| 13 | webhook APPROVED con otro monto (3.000.000 vs 50.000 firmado) | ERROR saldo 0 | ERROR saldo 0 | Sí |
| 14 | registro con contraseña débil (contiene el usuario) | 400 WEAK_PASSWORD UPPERCASE,NO_USERNAME,NO_EMAIL | 400 WEAK_PASSWORD UPPERCASE,NO_USERNAME,NO_EMAIL | Sí |
| 15 | camino c: consulta por referencia (sin id), primero sin transacción y luego APPROVED | 200 PENDING -> 200 CREDITED saldo 50000 | 200 PENDING -> 200 CREDITED saldo 50000 | Sí |
| 16 | camino a: volver con ?id= (2 veces) | 200 CREDITED, 200 CREDITED saldo 50000 1 recarga | 200 CREDITED, 200 CREDITED saldo 50000 1 recarga | Sí |
| 17 | camino a: ?id= de la recarga de otro usuario | 403 saldos 0 0 | 403 saldos 0 0 | Sí |
| 18 | redirect + callback + referencia + webhook a la vez | 200,200,200,200 saldo 50000 1 recarga | 200,200,200,200 saldo 50000 1 recarga | Sí |

### Pagos y contraseña: pruebas unitarias (`npm test`)

| Caso | Esperado | Obtenido |
|---|---|---|
| Monto 0, negativo, texto, decimales, menor al mínimo, mayor al máximo y ausente | 400 con "Mínimo $10.000 · Máximo $3.000.000" en el mensaje, sin documento en Firestore | Pasa |
| Mínimo y máximo exactos | 201 | Pasa |
| Recarga sin sesión o con rol ADM | 401 y 403 | Pasa |
| Firma de integridad contra el **ejemplo oficial** de docs.wompi.co | `37c84077…3bf5` | Pasa |
| La respuesta de `prepare` no incluye llave privada, secreto de eventos ni secreto de integridad | Ningún secreto | Pasa |
| Checksum de eventos contra la cadena de ejemplo oficial | SHA256 igual | Pasa |
| Webhook con checksum inválido, con un monto alterado después de firmar y con cuerpo que no es JSON | 401 sin tocar datos | Pasa |
| Mismo evento APPROVED 3 veces a la vez | Se acredita una vez | Pasa |
| DECLINED y luego APPROVED con la misma referencia | No acredita | Pasa |
| Evento con `environment: prod` | 200, se ignora y no acredita | Pasa |
| Consulta directa con APPROVED varias veces, PENDING y consulta por otro usuario o ADM | Una acreditación; CREATED; 403 o se permite | Pasa |
| Llaves de producción | 503 `PAYMENTS_NOT_CONFIGURED`, sin mostrar las llaves | Pasa |
| `FIREBASE_PRIVATE_KEY` con `
` escritos o saltos de línea reales | Misma llave | Pasa |
| Contraseña: vacía, corta, sin mayúscula, minúscula, número o símbolo, con espacio, con el usuario o con el correo | Lista exacta de reglas incumplidas | Pasa (10 casos) |
| Niveles de la barra (0 a 4) | 0, 1, 2, 3 y 4 | Pasa |
| Registro con contraseña débil | 400 `WEAK_PASSWORD` con `failed_rules` | Pasa |
| La copia del frontend da el mismo resultado que la del backend | Igual | Pasa (en tu equipo) |

### Webhook simulado contra Firestore real y PostgreSQL real

Hoy no hay URL pública. Tus llaves de Wompi son de producción, así que el backend bloquea los pagos (`503 PAYMENTS_NOT_CONFIGURED`).
Para la demostración se levantó una segunda instancia temporal del backend en el puerto 4100, con secretos de simulación con formato Sandbox, y luego se detuvo. Esa instancia no llama a Wompi: usa tu Firestore real y tu PostgreSQL real.

| Paso | Resultado real |
|---|---|
| Login `demo` | saldo 514.250 |
| `POST /api/payments/prepare {"amountCop": 50000}` | 201, `reference ELD-a899647e-1f68-460b-9e96-72e2465f71c8`, `amountInCents 5000000`, firma y llave pública |
| `node scripts/simulate-wompi-webhook.js <reference> APPROVED --amount=50000` | `200 {"status":"CREDITED"}` |
| El mismo script otra vez | `200 CREDITED`, sin segunda acreditación |
| Con `--bad-signature` | `401 INVALID_CHECKSUM` |
| Documento en Firestore `payments/ELD-a899647e-…` | `status: CREDITED`, `wompi_status: APPROVED`, `username: demo`, `amount_cop: 50000`, `amount_in_cents: 5000000`, `balance: 564250`, `credited_at` |
| PostgreSQL `balance_movement` con esa referencia | **una** fila `DEPOSIT 50000.00 -> 564250.00` |
| MongoDB `audit_log` | `RECHARGE_CREATED` y `RECHARGE_APPROVED` (con `source: WEBHOOK`); también hay `LOGIN_OK`, `LOGIN_FAIL` y `USER_CREATED` |
| Backend real con tus llaves de producción | `config.sandbox_ready: false` y `prepare` responde 503 sin mostrar ninguna llave |

## Arreglo: la recarga se quedaba en "Procesando…" (12 de noviembre de 2026)

### Evidencia del bug

| Comprobación | Resultado real |
|---|---|
| Último documento de `payments` en Firestore (`ELD-548ecbe4-…`, usuario `ansaca21`, 50.000) | `status CREATED`, `transaction_id null`, `wompi_status null` y `updated_at` igual a `created_at`: **el backend nunca lo tocó** |
| Logs del backend | Ninguna consulta registrada para esa referencia (la API no registra peticiones; tampoco hubo errores) |
| `GET https://sandbox.wompi.co/v1/transactions?reference=ELD-548ecbe4-…` con la llave **privada** | `200`, transacción `12240303-1794521672-86523`, `APPROVED`, 5.000.000 centavos, COP, `redirect_url: null` |
| La misma consulta con la llave **pública** | `401 INVALID_ACCESS_TOKEN` |
| `getTransaction(id)` y `findTransactionByReference` del backend contra Sandbox | Las dos encuentran la transacción APPROVED |
| La versión anterior de `RechargePanel` dentro de `<StrictMode>`, con 90 s simulados después del callback | **0 consultas al backend; sigue en "Procesando…"** |
| La misma versión sin StrictMode | 1 consulta, estado final |
| La versión corregida, con y sin StrictMode | 1 consulta, estado final |

### Pruebas nuevas

| Suite | Resultado |
|---|---|
| Frontend `npm test` (Vitest, `RechargePanel.test.jsx` dentro de `<StrictMode>`) | **8 de 8 pasan** |
| Backend `npm test` (+9 casos en `payments.test.js`) | **132 de 132 pasan** |
| Backend `npm run test:integration` (+4 casos de pagos, filas 15 a 18 de la tabla de arriba) | **66 de 66 pasan** |

Casos del frontend:

- **Camino b:** el id del callback se verifica y se muestra "Pago aprobado"; además se configura `redirectUrl` hacia `/wallet`.
- **Camino c:** un callback sin id consulta por referencia y sigue mientras la respuesta sea PENDING.
- **Camino a:** al volver con `?id=` se verifica una sola vez (aunque StrictMode ejecute el efecto dos veces), y también funciona sin una recarga pendiente en la pestaña.
- **Tope:** sin confirmación, después de 20 consultas se muestra "Todavía no recibimos la confirmación de Wompi" y el botón "Verificar de nuevo".
- **Errores:** un 5xx se reintenta hasta el tope; un 4xx se detiene y muestra el error.
- **Recarga pendiente:** al volver a `/wallet`, la que quedó guardada en la pestaña se verifica sola.

Casos nuevos del backend:

- Sin id, se busca por referencia: si Wompi tiene la transacción, se acredita; si no, responde PENDING sin tocar Firestore.
- Un id que pertenece a otra referencia se descarta y se busca por la referencia propia, sin marcar ERROR.
- `verifyTransaction` (`?id=` de la redirect-url):
  - acredita una sola vez;
  - con una recarga de otro usuario responde 403, con una transacción inexistente o ajena 404, y con un id inválido 400;
  - con otra moneda marca ERROR; con DECLINED no acredita.
- Los tres caminos a la vez acreditan una sola vez.

### Verificación de punta a punta con el pago real atascado (Wompi Sandbox real, Firestore y PostgreSQL reales)

| Paso | Resultado real |
|---|---|
| `GET /api/payments/ELD-548ecbe4-…` sin id (camino c), como ADM | `200 CREDITED`; el backend encontró la transacción por referencia en Wompi |
| Firestore | `CREDITED`, `transaction_id 12240303-1794521672-86523`, `wompi_status APPROVED`, `balance 50000`, `credited_at` |
| PostgreSQL | una fila `DEPOSIT 50000.00 -> 50000.00` para `ansaca21` |
| `GET /api/payments/transactions/12240303-1794521672-86523` (camino a) | `200 CREDITED`; sigue habiendo **1** recarga y el saldo es 50.000 |

## Regresión: el Widget no abría con 403 (12 de noviembre de 2026)

URL del Widget pedida desde el contenedor del backend, con firma de integridad válida:

| Parámetros | Respuesta de checkout.wompi.co |
|---|---|
| Sin `redirect-url` | **200** |
| `redirect-url=http://localhost:5173/wallet` | **403** "The request could not be satisfied" |
| `redirect-url=https://localhost:5173/wallet` | **403** |
| `redirect-url=https://transaction-redirect.wompi.co/check` (ejemplo de la doc) | 200 |
| Firma inválida, sin `redirect-url` (control) | 200 (la página carga; la firma se valida al pagar) |

| Suite después del arreglo | Resultado |
|---|---|
| Frontend `npm test` (+2 casos: Widget sin `redirectUrl` y callback sin id) | **10 de 10 pasan** |
| Backend `npm test` dentro del contenedor | 131 pasan y 1 se omite (la comparación con el frontend, que allí no está montado) |
| Backend `npm run test:integration` | **66 de 66 pasan** |
| JS de `RechargePanel` que sirve Vite en localhost:5173 | 0 apariciones de `redirectUrl:` |

## Fase 4 · Registro e inicio de sesión con Google (12 de noviembre de 2026)

| Suite | Resultado |
|---|---|
| Backend `npm run test:integration` (+19 casos de `google.test.js`) | **85 de 85 pasan** |
| Backend `npm test` | 132 de 132 en el equipo (131 más 1 omitida en el contenedor) |
| Frontend `npm test` (+4 casos de `GoogleSignInButton.test.jsx`) | **14 de 14 pasan** |

Las pruebas de Google usan SQL Server y PostgreSQL reales y un `verifyIdToken` falso: no llaman a Firebase ni crean usuarios allí.

### Google: caso, esperado y obtenido (integración)

| # | Caso | Esperado | Obtenido | ¿Pasa? |
|---|---|---|---|---|
| 1 | Google: idToken inválido | 401 GOOGLE_TOKEN_INVALID | 401 GOOGLE_TOKEN_INVALID | Sí |
| 2 | Google: idToken vencido | 401 GOOGLE_TOKEN_EXPIRED | 401 GOOGLE_TOKEN_EXPIRED | Sí |
| 3 | Google: sin idToken | 401 GOOGLE_TOKEN_INVALID | 401 GOOGLE_TOKEN_INVALID | Sí |
| 4 | Google: email_verified false | 401 GOOGLE_EMAIL_NOT_VERIFIED | 401 GOOGLE_EMAIL_NOT_VERIFIED | Sí |
| 5 | Google: token de otro proveedor (password) | 401 GOOGLE_TOKEN_INVALID | 401 GOOGLE_TOKEN_INVALID | Sí |
| 6 | Google: usuario nuevo | 202 PROFILE_INCOMPLETE sin cookie sin usuario | 202 PROFILE_INCOMPLETE sin cookie sin usuario | Sí |
| 7 | Google: completar perfil válido | 201 USR GOOGLE sin contraseña saldo 0 sesión iniciada | 201 USR GOOGLE sin contraseña saldo 0 sesión iniciada | Sí |
| 8 | Google: usuario existente inicia sesión | 200 LOGGED_IN HttpOnly | 200 LOGGED_IN HttpOnly | Sí |
| 9 | Google: mismo correo de cuenta GOOGLE con otro uid | 200 LOGGED_IN | 200 LOGGED_IN | Sí |
| 10 | Google: completar con 17 años | 400 VALIDATION_ERROR birth_date | 400 VALIDATION_ERROR birth_date | Sí |
| 11 | Google: tipo de documento, fecha y términos inválidos | 400 VALIDATION_ERROR document_type,birth_date,accepted_terms | 400 VALIDATION_ERROR document_type,birth_date,accepted_terms | Sí |
| 12 | Google: cédula con letras | 400 VALIDATION_ERROR document_number | 400 VALIDATION_ERROR document_number | Sí |
| 13 | Google: documento ya registrado (enviado con puntos) | 409 DOCUMENT_TAKEN sin usuario | 409 DOCUMENT_TAKEN sin usuario | Sí |
| 14 | Google: correo de una cuenta LOCAL | 409 LOCAL_ACCOUNT_EXISTS / 409 LOCAL_ACCOUNT_EXISTS / sigue LOCAL | 409 LOCAL_ACCOUNT_EXISTS / 409 LOCAL_ACCOUNT_EXISTS / sigue LOCAL | Sí |
| 15 | Google: completar dos veces | 409 GOOGLE_ACCOUNT_EXISTS | 409 GOOGLE_ACCOUNT_EXISTS | Sí |
| 16 | Google: login con contraseña (por usuario y por correo) | 401 GOOGLE_ACCOUNT / 401 GOOGLE_ACCOUNT | 401 GOOGLE_ACCOUNT / 401 GOOGLE_ACCOUNT | Sí |
| 17 | Google: dos correos con la misma parte local | usernames distintos | usernames distintos | Sí |
| 18 | Google: PostgreSQL falla al crear la cuenta | 503 sin usuario (compensado) | 503 sin usuario | NO |
| 19 | Registro y login locales | 201 200 LOCAL | 201 200 LOCAL | Sí |

### Frontend (`GoogleSignInButton.test.jsx`, dentro de StrictMode)

| Caso | Esperado | Obtenido |
|---|---|---|
| 202 PROFILE_INCOMPLETE | Navega a `/complete-profile` con el correo y no inicia sesión | Pasa |
| 200 LOGGED_IN | `setSessionUser(user)` y navega a `/` | Pasa |
| Popup cerrado y popup bloqueado | Mensajes "Cerraste la ventana…" y "…bloqueó la ventana…" | Pasa |
| 409 de una cuenta LOCAL | Muestra el mensaje del backend y cierra la sesión de Google | Pasa |

### Comprobaciones contra el proyecto real de Firebase (solo lectura)

| Comprobación | Resultado real |
|---|---|
| Dominios autorizados de Firebase Authentication | `localhost`, `<proyecto>.firebaseapp.com`, `<proyecto>.web.app` |
| Proveedor `google.com` | `enabled=true` |
| `VITE_FIREBASE_PROJECT_ID` igual a `FIREBASE_PROJECT_ID`, y `authDomain` = `<proyecto>.firebaseapp.com` | Sí |
| `POST /api/auth/google` con un JWT falso, usando el `verifyIdToken` real | `401 GOOGLE_TOKEN_INVALID`, no 503: firebase-admin y las credenciales funcionan |
| `db-init` dos veces seguidas con `03_auth_provider.sql` | Sin errores; demo, admin y ansaca21 quedan `LOCAL` con contraseña |
