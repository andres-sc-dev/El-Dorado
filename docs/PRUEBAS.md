# Pruebas

Resultados reales del 12 de noviembre de 2026, rama `feat/fase-2-apuestas`.

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
