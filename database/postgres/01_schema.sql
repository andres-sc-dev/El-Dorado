-- El Dorado · PostgreSQL · dinero (cuentas, apuestas, movimientos) y dataset de equipos.
-- Script idempotente. Docker lo ejecuta sobre la base el_dorado la primera vez que se crea el volumen.
-- En PostgreSQL usamos TEXT + CHECK en lugar de VARCHAR: es el tipo recomendado por la
-- documentación oficial y el CHECK deja explícito el límite.
-- Referencias a otros motores por clave natural y sin FOREIGN KEY:
--   account.username             -> SQL Server users.username
--   bet_leg.match_code           -> MySQL match.match_code
--   bet_leg.market_code/outcome  -> MongoDB odds_market / odds_outcome
-- Las funciones PL/pgSQL de dinero se crean en la Fase 2.

-- ---------- Catálogos ----------

CREATE TABLE IF NOT EXISTS account_status (
  id_status_account SMALLINT PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z_]{2,20}$'),
  name              TEXT NOT NULL CHECK (char_length(name) <= 50)
);

CREATE TABLE IF NOT EXISTS bet_status (
  id_status_bet SMALLINT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z_]{2,20}$'),
  name          TEXT NOT NULL CHECK (char_length(name) <= 50)
);

CREATE TABLE IF NOT EXISTS movement_type (
  id_movement SMALLINT PRIMARY KEY,
  code        TEXT     NOT NULL UNIQUE CHECK (code ~ '^[A-Z_]{2,20}$'),
  name        TEXT     NOT NULL CHECK (char_length(name) <= 50),
  -- +1 suma al saldo, -1 resta. Así el signo no queda escondido en el código de Node.
  direction   SMALLINT NOT NULL CHECK (direction IN (-1, 1))
);

CREATE TABLE IF NOT EXISTS player_position (
  id_position SMALLINT PRIMARY KEY,
  code        CHAR(2) NOT NULL UNIQUE,  -- GK, DF, MF, FW
  name        TEXT    NOT NULL CHECK (char_length(name) <= 50)
);

-- ---------- Cuentas y movimientos ----------

CREATE TABLE IF NOT EXISTS account (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_number TEXT          NOT NULL UNIQUE CHECK (account_number ~ '^ED-[0-9A-Z]{4,20}$'),
  -- Clave natural del usuario en SQL Server. Una cuenta por usuario.
  username       TEXT          NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 50),
  status         SMALLINT      NOT NULL DEFAULT 1 REFERENCES account_status (id_status_account),
  currency       CHAR(3)       NOT NULL DEFAULT 'COP',
  balance        NUMERIC(14,2) NOT NULL DEFAULT 0 CONSTRAINT ck_account_balance CHECK (balance >= 0),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------- Apuestas ----------

-- bet = el tiquete. bet_leg = la selección. Solo se permiten apuestas simples (una selección).
CREATE TABLE IF NOT EXISTS bet (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_code      UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  account_id       INTEGER       NOT NULL REFERENCES account (id),
  stake            NUMERIC(14,2) NOT NULL CONSTRAINT ck_bet_stake CHECK (stake > 0),
  total_odds       NUMERIC(8,2)  NOT NULL CONSTRAINT ck_bet_odds CHECK (total_odds > 1),
  potential_payout NUMERIC(16,2) NOT NULL CHECK (potential_payout > stake),
  status           SMALLINT      NOT NULL DEFAULT 0 REFERENCES bet_status (id_status_bet),
  -- La envía el cliente en el header Idempotency-Key; evita apostar dos veces por un doble clic.
  idempotency_key  UUID          NULL UNIQUE,
  placed_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  settled_at       TIMESTAMPTZ   NULL
);

CREATE INDEX IF NOT EXISTS ix_bet_account_placed ON bet (account_id, placed_at DESC);

CREATE TABLE IF NOT EXISTS bet_leg (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- UNIQUE en bet_id: un tiquete tiene exactamente una selección (solo apuestas simples).
  -- Si algún día se permiten combinadas, basta con quitar esta restricción.
  bet_id       BIGINT       NOT NULL CONSTRAINT uq_bet_leg_simple_only UNIQUE REFERENCES bet (id) ON DELETE CASCADE,
  match_code   CHAR(8)      NOT NULL CHECK (match_code ~ '^[A-Z]{2}[0-9]{6}$'),
  market_code  TEXT         NOT NULL CHECK (market_code ~ '^[A-Z0-9_]{2,20}$'),
  outcome_code TEXT         NOT NULL CHECK (char_length(outcome_code) BETWEEN 1 AND 10),
  line         NUMERIC(4,1) NOT NULL DEFAULT 0,
  odd_value    NUMERIC(6,2) NOT NULL CONSTRAINT ck_bet_leg_odds CHECK (odd_value > 1),
  status       SMALLINT     NOT NULL DEFAULT 0 REFERENCES bet_status (id_status_bet)
);

-- La liquidación de un partido busca todas las selecciones de ese partido.
CREATE INDEX IF NOT EXISTS ix_bet_leg_match ON bet_leg (match_code, status);

CREATE TABLE IF NOT EXISTS balance_movement (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id        INTEGER       NOT NULL REFERENCES account (id),
  movement_type     SMALLINT      NOT NULL REFERENCES movement_type (id_movement),
  amount            NUMERIC(14,2) NOT NULL CONSTRAINT ck_movement_amount CHECK (amount > 0),
  resulting_balance NUMERIC(14,2) NOT NULL CHECK (resulting_balance >= 0),
  -- Referencia única del origen (WOMPI:<id>, BET:<ticket>, SEED:<usuario>).
  -- Si el mismo evento llega dos veces, el segundo INSERT falla y el saldo no se duplica.
  reference         TEXT          NOT NULL CONSTRAINT uq_movement_reference UNIQUE
                    CHECK (char_length(reference) BETWEEN 3 AND 120),
  bet_id            BIGINT        NULL REFERENCES bet (id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_movement_account_created ON balance_movement (account_id, created_at DESC);

-- ---------- Dataset de equipos (API-Football en la Fase 3) ----------

CREATE TABLE IF NOT EXISTS team (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Clave natural de 3 letras que usa MySQL en match.home_team_code / away_team_code.
  team_code       CHAR(3)  NOT NULL UNIQUE CHECK (team_code ~ '^[A-Z]{3}$'),
  api_football_id INTEGER  NULL UNIQUE,
  name            TEXT     NOT NULL UNIQUE CHECK (char_length(name) <= 150),
  short_name      TEXT     NOT NULL CHECK (char_length(short_name) <= 30),
  country_code    CHAR(3)  NOT NULL DEFAULT 'COL',
  founded         SMALLINT NULL CHECK (founded BETWEEN 1850 AND 2100),
  crest_url       TEXT     NULL CHECK (char_length(crest_url) <= 500)
);

CREATE TABLE IF NOT EXISTS player (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  api_football_id  INTEGER  NULL UNIQUE,
  team_id          INTEGER  NOT NULL REFERENCES team (id),
  name             TEXT     NOT NULL CHECK (char_length(name) <= 150),
  position_id      SMALLINT NULL REFERENCES player_position (id_position),
  jersey_number    SMALLINT NULL CHECK (jersey_number BETWEEN 1 AND 99),
  nationality_code CHAR(3)  NULL,
  birth_date       DATE     NULL,
  CONSTRAINT uq_player_team_name UNIQUE (team_id, name)
);

CREATE TABLE IF NOT EXISTS team_stats (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id        INTEGER  NOT NULL REFERENCES team (id),
  season         SMALLINT NOT NULL,
  matches_played SMALLINT NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  wins           SMALLINT NOT NULL DEFAULT 0 CHECK (wins >= 0),
  draws          SMALLINT NOT NULL DEFAULT 0 CHECK (draws >= 0),
  losses         SMALLINT NOT NULL DEFAULT 0 CHECK (losses >= 0),
  goals_for      SMALLINT NOT NULL DEFAULT 0 CHECK (goals_for >= 0),
  goals_against  SMALLINT NOT NULL DEFAULT 0 CHECK (goals_against >= 0),
  -- Los puntos se calculan: así nunca quedan desalineados con victorias y empates.
  points         SMALLINT GENERATED ALWAYS AS (wins * 3 + draws) STORED,
  CONSTRAINT uq_team_stats UNIQUE (team_id, season),
  CONSTRAINT ck_team_stats_total CHECK (wins + draws + losses = matches_played)
);

CREATE TABLE IF NOT EXISTS player_stats (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id      INTEGER  NOT NULL REFERENCES player (id),
  season         SMALLINT NOT NULL,
  matches_played SMALLINT NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  goals          SMALLINT NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists        SMALLINT NOT NULL DEFAULT 0 CHECK (assists >= 0),
  yellow_cards   SMALLINT NOT NULL DEFAULT 0 CHECK (yellow_cards >= 0),
  red_cards      SMALLINT NOT NULL DEFAULT 0 CHECK (red_cards >= 0),
  CONSTRAINT uq_player_stats UNIQUE (player_id, season)
);
