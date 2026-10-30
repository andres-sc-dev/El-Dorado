# El Dorado API

**Apuestas del Fútbol Colombiano**  
*Vuelve la época dorada*

API Express sin TypeScript para SQL Server. Las consultas de dominio usan una
lista blanca de tablas/columnas y parámetros `mssql`; nunca se concatenan datos
del cliente en los valores SQL.

## Puesta en marcha (orden de dependencias)

1. Crea la base de datos `el_dorado` en SQL Server y ejecuta el script de
   esquema y catálogos iniciales del proyecto.
2. Copia `.env.example` a `.env`, completa `DB_*` y define un `JWT_SECRET`
   largo. En producción usa HTTPS, `COOKIE_SECURE=true` y
   `COOKIE_SAMESITE=none` si el frontend está en otro sitio.
3. Desde `backend/`, instala dependencias con `npm ci`.
4. Inicia con `npm start` (o `npm run dev` durante desarrollo).
5. Verifica primero `GET /api/auth/health`, después login y finalmente las
   operaciones de tablas que dependan de sus claves foráneas.

Para iniciar el frontend y el backend en contenedores de desarrollo, copia
`backend/.env.example` a `backend/.env` y configura sus credenciales. Luego,
desde la raíz del proyecto, ejecuta `docker compose up`. SQL Server debe estar
disponible en el equipo anfitrión.

## Autenticación

`POST /api/auth/login` recibe `{ "username": "...", "password": "..." }` y
devuelve el usuario sin `password_hash`. La sesión se guarda únicamente en la
cookie `el_dorado_token` (`HttpOnly`). El navegador debe enviar
`credentials: "include"`. `GET /api/auth/me` valida la sesión y
`POST /api/auth/logout` la elimina.

El saldo real se calcula desde `balance_movement` asociado a la cuenta activa
del cliente. Los endpoints autenticados `POST /api/auth/balance/deposit` y
`POST /api/auth/balance/withdraw` reciben `{ "amount": 50000 }` y registran
cada operación en esa tabla; por eso el saldo se conserva al cerrar o
actualizar la página.

## Endpoints

- `GET /api/catalogs` devuelve todos los catálogos agrupados. También se puede
  consultar `GET /api/catalogs/:catalogo`. Son de solo lectura.
- Cada tabla de dominio tiene `GET /api/:tabla` y `POST /api/:tabla`, salvo
  `login_history`, que solo expone `GET`:
  `country`, `sport`, `stadium`, `company`, `game_rule`, `league`,
  `team`, `matchday`, `customer`, `player`, `team_stats`, `account`, `match`,
  `player_stats`, `odds`, `balance_movement` y `bet`.
- `GET /api/users` y `GET /api/users/:id` son consultas auxiliares de solo
  lectura para resolver la relación de `customer`; los usuarios se crean
  exclusivamente mediante `POST /api/auth/register`.
- También se puede consultar un registro por id con
  `GET /api/:tabla/:id`; `GET /api/users/:id/balance` calcula el saldo a
  partir de los movimientos registrados.
- `GET /api/bets` devuelve únicamente las apuestas de la sesión autenticada.
  `POST /api/bets` recibe `{ "stake": 1000, "selections": [{ "matchId": 1,
  "oddId": 1 }] }` y, en una transacción SQL Server, valida la cuota, inserta
  la apuesta y registra el débito correspondiente en `balance_movement`.
  El cliente nunca puede indicar `customer_id` ni reutilizar una cuenta ajena.

Ejemplos:

```bash
curl http://localhost:4000/api/catalogs
curl -X POST http://localhost:4000/api/sport \
  -H "Content-Type: application/json" \
  -H "Cookie: el_dorado_token=<sesion>" \
  -d '{"name":"Fútbol"}'
curl http://localhost:4000/api/league
```

### Carga inicial de tablas

Cada ejemplo requiere `Content-Type: application/json`. Los campos omitidos son
opcionales o tienen un valor por defecto en SQL Server.

| Tabla | POST | Body mínimo | Dependencias previas |
| --- | --- | --- | --- |
| `country` | `/api/country` | `{"name":"Colombia","code":"COL"}` | Ninguna |
| `sport` | `/api/sport` | `{"name":"Fútbol"}` | Ninguna |
| `stadium` | `/api/stadium` | `{"name":"El Campín","city":"Bogotá","capacity":36000}` | Ninguna |
| `company` | `/api/company` | `{"name":"El Dorado","tax_id":"900123456","license":"LIC-1","address":"Calle 1","phone":"3000000000","email":"admin@eldorado.example"}` | Ninguna |
| `game_rule` | `/api/game_rule` | `{"sport_id":1,"description":"Reglas de fútbol"}` | `sport` |
| `league` | `/api/league` | `{"country_id":1,"sport_id":1,"name":"Liga Colombia","season":"2026"}` | `country`, `sport` |
| `team` | `/api/team` | `{"league_id":1,"stadium_id":1,"name":"Equipo Dorado","crest_url":"https://example.test/crest.png"}` | `league`, `stadium` |
| `matchday` | `/api/matchday` | `{"league_id":1,"number":1,"date":"2026-09-01"}` | `league` |
| `customer` | `/api/customer` | `{"user_id":1,"full_name":"Ana Pérez","document_number":"100000001","birth_date":"1995-01-15","phone":"3000000000","address":"Calle 1"}` | Usuario creado por `/api/auth/register` |
| `player` | `/api/player` | `{"team_id":1,"name":"Luis Díaz","position":4,"jersey_number":7,"nationality_id":1,"birth_date":"1997-01-13"}` | `team`, `country` y `player_position` |
| `team_stats` | `/api/team_stats` | `{"team_id":1,"points":3,"matches_played":1,"wins":1,"draws":0,"losses":0,"goals_for":2,"goals_against":0}` | `team` |
| `account` | `/api/account` | `{"customer_id":1,"account_number":"ACC-0001","status":1}` | `customer` y `account_status` |
| `match` | `/api/match` | `{"league_id":1,"matchday_id":1,"home_team_id":1,"away_team_id":2,"stadium_id":1,"match_date":"2026-09-01T20:00:00Z","status":0,"home_goals":0,"away_goals":0}` | `league`, `matchday`, dos `team`, `stadium` y `match_status` |
| `player_stats` | `/api/player_stats` | `{"player_id":1,"goals":1,"assists":0,"yellow_cards":0,"red_cards":0,"matches_played":1}` | `player` |
| `odds` | `/api/odds` | `{"match_id":1,"player_id":1,"market":1,"outcome":1,"odd_value":1.85}` | `match`, opcionalmente `player`, `odds_market` y `odds_outcome` |
| `balance_movement` | `/api/balance_movement` | `{"account_id":1,"type":1,"amount":50000,"resulting_balance":50000}` | `account` y `movement_type` |
| `bet` | `/api/bet` | `{"customer_id":1,"match_id":1,"odd_id":1,"amount":1000,"odd_value_at_bet":1.85,"potential_payout":1850,"status":0}` | `customer`, `match`, `odds` y `bet_status` |

Después de cada POST, usa `GET /api/<tabla>` (o
`GET /api/<tabla>/<id>`) para confirmar el registro. `GET /api/login_history`
es únicamente de lectura y se llena automáticamente durante login; no existe
POST manual. Los ocho catálogos se consultan con
`GET /api/catalogs/<catalogo>` o todos juntos con `GET /api/catalogs`.

El orden recomendado desde una base vacía es: `country`, `sport`, `stadium`,
`company`, `game_rule`, `league`, `team`, `matchday`, registrar usuarios,
`customer`, `player`, `team_stats`, `account`, `match`, `player_stats`, `odds`,
`balance_movement` y finalmente `bet`.

Los campos obligatorios se validan antes de insertar. Las respuestas
identifican errores de clave foránea (`400`) y de unicidad (`409`) sin revelar
detalles internos. Las contraseñas se almacenan con bcrypt y nunca se envían
en respuestas.
