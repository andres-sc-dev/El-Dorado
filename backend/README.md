# El Dorado API

API en Node.js + Express. Cada motor tiene su propia conexión en `src/config/`:

| Motor | Archivo | Qué guarda |
|---|---|---|
| SQL Server | `sqlserver.js` | Identidad: users, customer, login_history, role, document_type |
| MySQL | `mysql.js` | Competición: ligas, partidos, cuotas |
| PostgreSQL | `postgres.js` | Dinero (cuentas, apuestas, movimientos) y equipos |
| MongoDB | `mongo.js` | Mercados, resultados, reglas de juego y auditoría |

Si un motor está caído, el servidor arranca igual y solo las rutas que lo usan responden 503 (middleware `requireDb`).

## Capas

`routes` → `middleware` → `controllers` (solo req/res) → `services` (reglas) → `repositories` (SQL parametrizado) → `config` (pools).

## Comandos

```bash
npm run dev         # servidor con recarga automática
npm run seed:demo   # crea demo (USR) y admin (ADM) y copia BET_MIN_COP/BET_MAX_COP a PostgreSQL
npm test            # seguridad y reglas de liquidación (no necesitan bases)
npm run test:integration   # contra las 4 bases; correrlo dentro del contenedor (ver docs/PRUEBAS.md)
```

Lo normal es correrlo con `docker compose up -d` desde la raíz (ver el README principal). Para correrlo fuera de Docker, copia `../.env.example` como `backend/.env` y apunta los `*_HOST` y `*_PORT` a los puertos publicados (por defecto 14333, 13306, 15432 y 27027).

## Endpoints

| Método y ruta | Sesión | Motor | Notas |
|---|---|---|---|
| `GET /api/health` | No | Todos | Estado de cada motor. 200 siempre; `status` es `ok` o `degraded`. |
| `POST /api/auth/login` | No | SQL Server | Crea la cookie HttpOnly `el_dorado_token`. |
| `POST /api/auth/register` | No | SQL Server + PostgreSQL | Si falla la cuenta en PostgreSQL, se borra el usuario creado. |
| `GET /api/auth/me` | Sí | SQL Server | El saldo llega como `null` si PostgreSQL está caído. |
| `POST /api/auth/logout` | No | — | |
| `POST /api/auth/balance/deposit` y `/withdraw` | Sí | — | **Deshabilitados (403):** recargas con Wompi y retiros, próximamente. |
| `GET /api/matches` | No | MySQL (+ PostgreSQL y MongoDB opcionales) | Partidos con equipos, mercados, cuotas, estado y límites de apuesta. |
| `POST /api/bets` | Sí, rol **USR** | Los 4 | Header `Idempotency-Key` (UUID). Cuerpo: `match_code`, `market_code`, `selection`, `line`, `stake` y `expected_odds` (opcional). 201 si la crea, 200 si la clave ya tenía apuesta, 409 `ODDS_CHANGED` con `current_odds`. |
| `GET /api/bets/me` (y `/api/bets/:ticketCode`) | Sí | PostgreSQL + MySQL | Apuestas del usuario con el partido y los nombres del mercado. |
| `GET /api/wallet/me` | Sí | PostgreSQL | Saldo y últimos movimientos. |
| `GET /api/customer`, `/api/login_history` | Sí | SQL Server | Solo los datos del dueño de la sesión. |
| `GET /api/account`, `/api/balance_movement`, `/api/users/:id/balance` | Sí | PostgreSQL | Solo los datos del dueño de la sesión. |
| `GET /api/admin/matches` | Sí, rol **ADM** | MySQL + PostgreSQL | Partidos con sus apuestas abiertas. |
| `POST /api/admin/matches/:matchCode/finish` | Sí, rol **ADM** | MySQL + PostgreSQL + MongoDB | Cuerpo `{home_goals, away_goals}`. Marca FINISHED, liquida con `fn_liquidar_partido` y devuelve el resumen. 409 si ya estaba finalizado. |
| `GET /api/country`, `sport`, `league`, `stadium`, `matchday`, `match`, `odds` (y `/:id`) | No | MySQL | |
| `GET /api/team`, `player`, `team_stats`, `player_stats` (y `/:id`) | No | PostgreSQL | |
| `GET /api/game_rule`, `/api/markets` | No | MongoDB | `markets` trae cada mercado con sus resultados. |
| `GET /api/catalogs` y `/api/catalogs/:name` | No | Varios | Los catálogos de un motor caído salen en `unavailable`. |
| Cualquier otro `POST`, `PUT`, `PATCH` o `DELETE` | — | — | **403.** |

## Errores

400 validación, 401 sesión, 403 rol o acción deshabilitada, 404, 409 conflicto, 503 base caída (con `database` en la respuesta), 500 otro.

Las respuestas de error traen `error` (texto para la persona) y, cuando aplica, `code` (por ejemplo `INSUFFICIENT_FUNDS`, `ODDS_CHANGED` o `MATCH_STARTED`).
