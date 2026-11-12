-- El Dorado · MySQL · competición: países, ligas, partidos y cuotas.
-- Script idempotente. Docker lo ejecuta solo la primera vez que se crea el volumen.
-- Las referencias a otros motores van por clave natural y sin FOREIGN KEY:
--   match.home_team_code / away_team_code -> PostgreSQL team.team_code
--   odds.market_code / outcome_code       -> MongoDB odds_market / odds_outcome

CREATE DATABASE IF NOT EXISTS el_dorado CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE el_dorado;

-- Catálogo de estados del partido.
CREATE TABLE IF NOT EXISTS match_status (
  id_status_match TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  code            CHAR(9)          NOT NULL UNIQUE,  -- MySQL recorta los espacios de CHAR al leer.
  -- VARCHAR: nombre legible de longitud variable.
  name            VARCHAR(30)      NOT NULL
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS country (
  id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code CHAR(3)           NOT NULL UNIQUE,            -- ISO 3166 alfa-3: clave natural.
  -- VARCHAR: los nombres de país tienen longitud variable y se indexan.
  name VARCHAR(100)      NOT NULL UNIQUE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sport (
  id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code CHAR(3)          NOT NULL UNIQUE,             -- FUT: clave natural que usa MongoDB.
  -- VARCHAR: nombre legible de longitud variable.
  name VARCHAR(50)      NOT NULL UNIQUE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS league (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code        CHAR(2)           NOT NULL,            -- BP = Liga BetPlay. Forma parte de match_code.
  country_id  SMALLINT UNSIGNED NOT NULL,
  sport_id    TINYINT UNSIGNED  NOT NULL,
  -- VARCHAR: nombre oficial de longitud variable.
  name        VARCHAR(150)      NOT NULL,
  season_year SMALLINT UNSIGNED NOT NULL,
  season_half TINYINT UNSIGNED  NOT NULL,            -- 1 = Apertura, 2 = Finalización.
  CONSTRAINT uq_league_season UNIQUE (code, season_year, season_half),
  CONSTRAINT ck_league_half CHECK (season_half IN (1, 2)),
  CONSTRAINT fk_league_country FOREIGN KEY (country_id) REFERENCES country (id),
  CONSTRAINT fk_league_sport   FOREIGN KEY (sport_id)   REFERENCES sport (id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS stadium (
  id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  country_id SMALLINT UNSIGNED NOT NULL,
  -- VARCHAR: nombres de estadio y ciudad de longitud variable.
  name       VARCHAR(150)      NOT NULL UNIQUE,
  city       VARCHAR(100)      NOT NULL,
  capacity   MEDIUMINT UNSIGNED NULL,
  CONSTRAINT ck_stadium_capacity CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT fk_stadium_country FOREIGN KEY (country_id) REFERENCES country (id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS matchday (
  id         INT UNSIGNED      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  league_id  SMALLINT UNSIGNED NOT NULL,
  number     TINYINT UNSIGNED  NOT NULL,
  start_date DATE              NULL,
  CONSTRAINT uq_matchday UNIQUE (league_id, number),
  CONSTRAINT ck_matchday_number CHECK (number > 0),
  CONSTRAINT fk_matchday_league FOREIGN KEY (league_id) REFERENCES league (id)
) ENGINE = InnoDB;

-- `match` es palabra reservada en MySQL: siempre va entre comillas invertidas.
CREATE TABLE IF NOT EXISTS `match` (
  id             INT UNSIGNED      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  -- Clave natural de 8 caracteres: liga (2) + año (2) + jornada (2) + número (2). Ej.: BP261801.
  match_code     CHAR(8)           NOT NULL UNIQUE,
  league_id      SMALLINT UNSIGNED NOT NULL,
  matchday_id    INT UNSIGNED      NOT NULL,
  stadium_id     SMALLINT UNSIGNED NOT NULL,
  home_team_code CHAR(3)           NOT NULL,         -- PostgreSQL team.team_code (sin FK).
  away_team_code CHAR(3)           NOT NULL,         -- PostgreSQL team.team_code (sin FK).
  match_date     DATETIME          NOT NULL,         -- Siempre en UTC.
  status         TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  home_goals     TINYINT UNSIGNED  NULL,
  away_goals     TINYINT UNSIGNED  NULL,
  CONSTRAINT ck_match_teams CHECK (home_team_code <> away_team_code),
  CONSTRAINT ck_match_code CHECK (match_code REGEXP '^[A-Z]{2}[0-9]{6}$'),
  -- Un partido finalizado debe tener marcador; uno sin finalizar no.
  CONSTRAINT ck_match_score CHECK (
    (status = 2 AND home_goals IS NOT NULL AND away_goals IS NOT NULL)
    OR (status <> 2 AND home_goals IS NULL AND away_goals IS NULL)
    OR status = 1
  ),
  CONSTRAINT fk_match_league   FOREIGN KEY (league_id)   REFERENCES league (id),
  CONSTRAINT fk_match_matchday FOREIGN KEY (matchday_id) REFERENCES matchday (id),
  CONSTRAINT fk_match_stadium  FOREIGN KEY (stadium_id)  REFERENCES stadium (id),
  CONSTRAINT fk_match_status   FOREIGN KEY (status)      REFERENCES match_status (id_status_match),
  INDEX ix_match_date (match_date),
  INDEX ix_match_status_date (status, match_date)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS odds (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  match_id     INT UNSIGNED NOT NULL,
  -- VARCHAR: los códigos de mercado de MongoDB tienen longitud variable (1X2, TOTAL_GOALS...).
  market_code  VARCHAR(20)  NOT NULL,
  -- VARCHAR: los códigos de resultado varían (HOME, OVER, 2-1...).
  outcome_code VARCHAR(10)  NOT NULL,
  -- Línea del mercado (2.5 goles, hándicap -1). 0 cuando el mercado no usa línea.
  -- El hándicap se expresa siempre desde el equipo local.
  line         DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  odd_value    DECIMAL(6,2) NOT NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_odds UNIQUE (match_id, market_code, outcome_code, line),
  CONSTRAINT ck_odds_value CHECK (odd_value > 1),
  CONSTRAINT fk_odds_match FOREIGN KEY (match_id) REFERENCES `match` (id)
) ENGINE = InnoDB;
