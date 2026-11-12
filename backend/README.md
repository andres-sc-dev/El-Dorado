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
npm run seed:demo   # crea el usuario de demostración (lee DEMO_USERNAME y DEMO_PASSWORD)
npm test            # pruebas del parche de seguridad (no necesitan bases)
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
| `POST /api/auth/balance/deposit` y `/withdraw` | Sí | — | **Deshabilitados (403).** |
| `GET /api/customer`, `/api/login_history` | Sí | SQL Server | Solo los datos del dueño de la sesión. |
| `GET /api/account`, `/api/balance_movement`, `/api/bets`, `/api/bets/:id`, `/api/users/:id/balance` | Sí | PostgreSQL | Solo los datos del dueño de la sesión. |
| `POST /api/bets` | Sí | — | **503 hasta la Fase 2** (funciones PL/pgSQL). |
| `GET /api/country`, `sport`, `league`, `stadium`, `matchday`, `match`, `odds` (y `/:id`) | No | MySQL | |
| `GET /api/team`, `player`, `team_stats`, `player_stats` (y `/:id`) | No | PostgreSQL | |
| `GET /api/game_rule`, `/api/markets` | No | MongoDB | `markets` trae cada mercado con sus resultados. |
| `GET /api/catalogs` y `/api/catalogs/:name` | No | Varios | Los catálogos de un motor caído salen en `unavailable`. |
| Cualquier otro `POST`, `PUT`, `PATCH` o `DELETE` | — | — | **403** hasta que existan los roles (Fase 2). |

## Errores

400 validación, 401 sesión, 403 rol o acción deshabilitada, 404, 409 conflicto, 503 base caída (con `database` en la respuesta), 500 otro.
