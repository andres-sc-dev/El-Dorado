-- El Dorado · MySQL · semilla pequeña e idempotente.
-- Las fechas de los partidos se calculan desde el momento de la carga, así siempre
-- hay partidos futuros jugables. INSERT IGNORE evita duplicados al repetir el script.
USE el_dorado;

INSERT IGNORE INTO match_status (id_status_match, code, name) VALUES
  (0, 'SCHEDULED', 'Programado'),
  (1, 'LIVE',      'En juego'),
  (2, 'FINISHED',  'Finalizado'),
  (3, 'CANCELLED', 'Cancelado');

INSERT IGNORE INTO country (code, name) VALUES ('COL', 'Colombia');
INSERT IGNORE INTO sport (code, name) VALUES ('FUT', 'Fútbol');

INSERT IGNORE INTO league (code, country_id, sport_id, name, season_year, season_half)
SELECT 'BP', c.id, s.id, 'Liga BetPlay Dimayor', 2026, 2
FROM country c JOIN sport s ON s.code = 'FUT'
WHERE c.code = 'COL';

INSERT IGNORE INTO stadium (country_id, name, city, capacity)
SELECT c.id, v.name, v.city, v.capacity
FROM country c
JOIN (
  SELECT 'Estadio El Campín' AS name, 'Bogotá' AS city, 36343 AS capacity
  UNION ALL SELECT 'Estadio Atanasio Girardot', 'Medellín', 44739
  UNION ALL SELECT 'Estadio Pascual Guerrero', 'Cali', 33130
  UNION ALL SELECT 'Estadio Metropolitano Roberto Meléndez', 'Barranquilla', 46692
  UNION ALL SELECT 'Estadio Deportivo Cali', 'Palmira', 44000
  UNION ALL SELECT 'Estadio Manuel Murillo Toro', 'Ibagué', 28100
) v
WHERE c.code = 'COL';

INSERT IGNORE INTO matchday (league_id, number, start_date)
SELECT l.id, v.number, DATE(UTC_TIMESTAMP() + INTERVAL v.offset_days DAY)
FROM league l
JOIN (SELECT 17 AS number, -5 AS offset_days UNION ALL SELECT 18, 2 UNION ALL SELECT 19, 9) v
WHERE l.code = 'BP' AND l.season_year = 2026 AND l.season_half = 2;

-- Partidos: uno ya jugado (para la liquidación de la Fase 2) y seis futuros.
INSERT IGNORE INTO `match`
  (match_code, league_id, matchday_id, stadium_id, home_team_code, away_team_code,
   match_date, status, home_goals, away_goals)
SELECT v.match_code, l.id, md.id, st.id, v.home, v.away,
       TIMESTAMP(DATE(UTC_TIMESTAMP() + INTERVAL v.offset_days DAY), v.kickoff),
       v.status, v.home_goals, v.away_goals
FROM league l
JOIN (
  SELECT 'BP261701' AS match_code, 17 AS md, 'MED' AS home, 'CAL' AS away, 'Estadio Atanasio Girardot' AS stadium,
         -5 AS offset_days, '00:30:00' AS kickoff, 2 AS status, 2 AS home_goals, 1 AS away_goals
  UNION ALL SELECT 'BP261801', 18, 'MIL', 'NAC', 'Estadio El Campín',                       2, '01:00:00', 0, NULL, NULL
  UNION ALL SELECT 'BP261802', 18, 'AME', 'JUN', 'Estadio Pascual Guerrero',                2, '23:00:00', 0, NULL, NULL
  UNION ALL SELECT 'BP261803', 18, 'CAL', 'SFE', 'Estadio Deportivo Cali',                  3, '21:00:00', 0, NULL, NULL
  UNION ALL SELECT 'BP261804', 18, 'TOL', 'MED', 'Estadio Manuel Murillo Toro',             3, '23:10:00', 0, NULL, NULL
  UNION ALL SELECT 'BP261901', 19, 'NAC', 'AME', 'Estadio Atanasio Girardot',               9, '01:00:00', 0, NULL, NULL
  UNION ALL SELECT 'BP261902', 19, 'JUN', 'MIL', 'Estadio Metropolitano Roberto Meléndez',  9, '23:00:00', 0, NULL, NULL
) v
JOIN matchday md ON md.league_id = l.id AND md.number = v.md
JOIN stadium st ON st.name = v.stadium
WHERE l.code = 'BP' AND l.season_year = 2026 AND l.season_half = 2;

-- Cuotas 1X2 propias de cada partido abierto.
INSERT IGNORE INTO odds (match_id, market_code, outcome_code, line, odd_value)
SELECT m.id, '1X2', v.outcome, 0.0, v.odd_value
FROM `match` m
JOIN (
  SELECT 'BP261801' AS code, 'HOME' AS outcome, 2.10 AS odd_value
  UNION ALL SELECT 'BP261801', 'DRAW', 3.20 UNION ALL SELECT 'BP261801', 'AWAY', 3.40
  UNION ALL SELECT 'BP261802', 'HOME', 1.95 UNION ALL SELECT 'BP261802', 'DRAW', 3.25 UNION ALL SELECT 'BP261802', 'AWAY', 3.90
  UNION ALL SELECT 'BP261803', 'HOME', 2.30 UNION ALL SELECT 'BP261803', 'DRAW', 3.10 UNION ALL SELECT 'BP261803', 'AWAY', 3.05
  UNION ALL SELECT 'BP261804', 'HOME', 2.05 UNION ALL SELECT 'BP261804', 'DRAW', 3.15 UNION ALL SELECT 'BP261804', 'AWAY', 3.60
  UNION ALL SELECT 'BP261901', 'HOME', 1.80 UNION ALL SELECT 'BP261901', 'DRAW', 3.40 UNION ALL SELECT 'BP261901', 'AWAY', 4.40
  UNION ALL SELECT 'BP261902', 'HOME', 2.60 UNION ALL SELECT 'BP261902', 'DRAW', 3.00 UNION ALL SELECT 'BP261902', 'AWAY', 2.75
) v ON v.code = m.match_code;

-- Resto de mercados: misma plantilla para todos los partidos abiertos.
INSERT IGNORE INTO odds (match_id, market_code, outcome_code, line, odd_value)
SELECT m.id, t.market_code, t.outcome_code, t.line, t.odd_value
FROM `match` m
CROSS JOIN (
  SELECT 'TOTAL_GOALS' AS market_code, 'OVER' AS outcome_code, 2.5 AS line, 2.15 AS odd_value
  UNION ALL SELECT 'TOTAL_GOALS', 'UNDER', 2.5, 1.70
  UNION ALL SELECT 'BTTS', 'YES', 0.0, 1.95
  UNION ALL SELECT 'BTTS', 'NO', 0.0, 1.80
  UNION ALL SELECT 'HANDICAP', 'HOME', -1.0, 3.50
  UNION ALL SELECT 'HANDICAP', 'AWAY', -1.0, 1.30
  UNION ALL SELECT 'EXACT_SCORE', '0-0', 0.0, 8.50
  UNION ALL SELECT 'EXACT_SCORE', '1-0', 0.0, 6.50
  UNION ALL SELECT 'EXACT_SCORE', '1-1', 0.0, 6.00
  UNION ALL SELECT 'EXACT_SCORE', '2-1', 0.0, 8.00
  UNION ALL SELECT 'EXACT_SCORE', '0-1', 0.0, 9.00
) t
WHERE m.status = 0;
