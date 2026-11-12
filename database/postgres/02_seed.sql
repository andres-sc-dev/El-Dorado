-- El Dorado · PostgreSQL · catálogos y semilla pequeña de equipos. Idempotente.
-- Las cuentas y el saldo de prueba los crea el script de Node (backend/scripts/seed-demo.js),
-- porque dependen del usuario de SQL Server y de la contraseña del .env.

INSERT INTO account_status (id_status_account, code, name) VALUES
  (0, 'SUSPENDED', 'Suspendida'),
  (1, 'ACTIVE',    'Activa'),
  (2, 'CLOSED',    'Cerrada')
ON CONFLICT (id_status_account) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name;

INSERT INTO bet_status (id_status_bet, code, name) VALUES
  (0, 'PENDING',   'Pendiente'),
  (1, 'WON',       'Ganada'),
  (2, 'LOST',      'Perdida'),
  (3, 'CANCELLED', 'Anulada')
ON CONFLICT (id_status_bet) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name;

INSERT INTO movement_type (id_movement, code, name, direction) VALUES
  (1, 'DEPOSIT',    'Recarga',            1),
  (2, 'WITHDRAWAL', 'Retiro',            -1),
  (3, 'BET_PLACED', 'Apuesta realizada', -1),
  (4, 'BET_PAYOUT', 'Pago de apuesta',    1),
  (5, 'BET_REFUND', 'Devolución',         1)
ON CONFLICT (id_movement) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, direction = EXCLUDED.direction;

INSERT INTO player_position (id_position, code, name) VALUES
  (1, 'GK', 'Portero'),
  (2, 'DF', 'Defensa'),
  (3, 'MF', 'Mediocampista'),
  (4, 'FW', 'Delantero')
ON CONFLICT (id_position) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name;

-- Los team_code coinciden con los de MySQL (match.home_team_code / away_team_code).
INSERT INTO team (team_code, name, short_name, founded) VALUES
  ('MIL', 'Millonarios FC',                 'Millonarios', 1946),
  ('NAC', 'Atlético Nacional',              'Nacional',    1947),
  ('AME', 'América de Cali',                'América',     1927),
  ('JUN', 'Junior FC',                      'Junior',      1924),
  ('CAL', 'Deportivo Cali',                 'Cali',        1912),
  ('SFE', 'Independiente Santa Fe',         'Santa Fe',    1941),
  ('TOL', 'Deportes Tolima',                'Tolima',      1954),
  ('MED', 'Independiente Medellín',         'Medellín',    1913)
ON CONFLICT (team_code) DO NOTHING;

-- Jugadores de ejemplo (ficticios) para probar las consultas; el dataset real llega en la Fase 3.
INSERT INTO player (team_id, name, position_id, jersey_number, nationality_code)
SELECT t.id, v.name, v.position_id, v.jersey_number, 'COL'
FROM (VALUES
  ('MIL', 'Jugador Millonarios 1', 1, 1),
  ('MIL', 'Jugador Millonarios 9', 4, 9),
  ('NAC', 'Jugador Nacional 1',    1, 1),
  ('NAC', 'Jugador Nacional 10',   3, 10),
  ('AME', 'Jugador América 9',     4, 9),
  ('JUN', 'Jugador Junior 4',      2, 4),
  ('CAL', 'Jugador Cali 8',        3, 8),
  ('SFE', 'Jugador Santa Fe 11',   4, 11),
  ('TOL', 'Jugador Tolima 5',      2, 5),
  ('MED', 'Jugador Medellín 7',    4, 7)
) AS v (team_code, name, position_id, jersey_number)
JOIN team t ON t.team_code = v.team_code
ON CONFLICT (team_id, name) DO NOTHING;

INSERT INTO team_stats (team_id, season, matches_played, wins, draws, losses, goals_for, goals_against)
SELECT t.id, 2026, v.mp, v.w, v.d, v.l, v.gf, v.ga
FROM (VALUES
  ('MIL', 17, 9, 5, 3, 26, 15),
  ('NAC', 17, 10, 4, 3, 29, 14),
  ('AME', 17, 8, 5, 4, 22, 17),
  ('JUN', 17, 8, 4, 5, 24, 19),
  ('CAL', 17, 6, 6, 5, 19, 18),
  ('SFE', 17, 7, 5, 5, 20, 17),
  ('TOL', 17, 7, 6, 4, 21, 16),
  ('MED', 17, 6, 5, 6, 18, 20)
) AS v (team_code, mp, w, d, l, gf, ga)
JOIN team t ON t.team_code = v.team_code
ON CONFLICT (team_id, season) DO NOTHING;

INSERT INTO player_stats (player_id, season, matches_played, goals, assists, yellow_cards, red_cards)
SELECT p.id, 2026, 15, CASE p.position_id WHEN 4 THEN 8 WHEN 3 THEN 3 ELSE 0 END,
       CASE p.position_id WHEN 3 THEN 5 ELSE 1 END, 2, 0
FROM player p
ON CONFLICT (player_id, season) DO NOTHING;
