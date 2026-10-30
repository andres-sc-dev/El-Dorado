/* Datos de ejemplo idempotentes para el_dorado.
   Ejecutar después del esquema y los catálogos iniciales. */
USE el_dorado;
GO

DECLARE @country_id INT, @sport_id INT, @stadium1_id INT, @stadium2_id INT;
DECLARE @user_id INT, @league_id INT, @team1_id INT, @team2_id INT;
DECLARE @matchday_id INT, @customer_id INT, @player_id INT, @account_id INT;
DECLARE @match_id INT, @odd_match_id INT, @odd_player_id INT;

IF NOT EXISTS (SELECT 1 FROM country WHERE name = N'Colombia')
  INSERT INTO country (name, code) VALUES (N'Colombia', 'COL');
SELECT @country_id = id FROM country WHERE name = N'Colombia';

IF NOT EXISTS (SELECT 1 FROM sport WHERE name = N'Fútbol')
  INSERT INTO sport (name) VALUES (N'Fútbol');
SELECT @sport_id = id FROM sport WHERE name = N'Fútbol';

IF NOT EXISTS (SELECT 1 FROM stadium WHERE name = N'Estadio El Campín')
  INSERT INTO stadium (name, city, capacity) VALUES (N'Estadio El Campín', N'Bogotá', 36343);
SELECT @stadium1_id = id FROM stadium WHERE name = N'Estadio El Campín';

IF NOT EXISTS (SELECT 1 FROM stadium WHERE name = N'Estadio Atanasio Girardot')
  INSERT INTO stadium (name, city, capacity) VALUES (N'Estadio Atanasio Girardot', N'Medellín', 44739);
SELECT @stadium2_id = id FROM stadium WHERE name = N'Estadio Atanasio Girardot';

IF NOT EXISTS (SELECT 1 FROM company WHERE tax_id = '900123456-7')
  INSERT INTO company (name, tax_id, license, address, phone, email)
  VALUES (N'EL DORADO S.A.S.', '900123456-7', 'RES-APUESTAS-COL-2024-001',
          N'Calle 100 # 15-20, Bogotá', '+57 601 555 0000', 'contacto@eldorado.example');

IF EXISTS (SELECT 1 FROM users WHERE username = 'andres10')
  SELECT @user_id = id FROM users WHERE username = 'andres10';
ELSE
BEGIN
  -- Este hash de respaldo no corresponde a credenciales de acceso utilizables.
  INSERT INTO users (username, email, password_hash, status)
  VALUES ('andres10', 'andres.salazar@example.com',
          '$2b$10$KqZ9X8y7wYVn3sHkYtQeUeH1z4rJd0m9F6cA8pL2xN5vB7tR1sWCu', 1);
  SET @user_id = SCOPE_IDENTITY();
END

IF NOT EXISTS (SELECT 1 FROM game_rule WHERE sport_id = @sport_id)
  INSERT INTO game_rule (sport_id, description)
  VALUES (@sport_id, N'Un partido se juega en dos tiempos de 45 minutos. Gana el equipo que anote más goles al finalizar el tiempo reglamentario.');

IF NOT EXISTS (SELECT 1 FROM league WHERE name = N'Liga BetPlay Dimayor' AND season = '2026-II')
  INSERT INTO league (country_id, sport_id, name, season)
  VALUES (@country_id, @sport_id, N'Liga BetPlay Dimayor', '2026-II');
SELECT @league_id = id FROM league WHERE name = N'Liga BetPlay Dimayor' AND season = '2026-II';

IF NOT EXISTS (SELECT 1 FROM team WHERE name = N'Millonarios FC' AND league_id = @league_id)
  INSERT INTO team (league_id, stadium_id, name, crest_url)
  VALUES (@league_id, @stadium1_id, N'Millonarios FC', 'https://eldorado.example/crests/millonarios.png');
SELECT @team1_id = id FROM team WHERE name = N'Millonarios FC' AND league_id = @league_id;

IF NOT EXISTS (SELECT 1 FROM team WHERE name = N'Atlético Nacional' AND league_id = @league_id)
  INSERT INTO team (league_id, stadium_id, name, crest_url)
  VALUES (@league_id, @stadium2_id, N'Atlético Nacional', 'https://eldorado.example/crests/nacional.png');
SELECT @team2_id = id FROM team WHERE name = N'Atlético Nacional' AND league_id = @league_id;

IF NOT EXISTS (SELECT 1 FROM matchday WHERE league_id = @league_id AND number = 5)
  INSERT INTO matchday (league_id, number, date) VALUES (@league_id, 5, '2026-09-20');
SELECT @matchday_id = id FROM matchday WHERE league_id = @league_id AND number = 5;

IF NOT EXISTS (SELECT 1 FROM customer WHERE user_id = @user_id)
  INSERT INTO customer (user_id, full_name, document_number, birth_date, phone, address)
  VALUES (@user_id, N'Andrés Salazar Castrillón', '1017234567', '1998-03-22',
          '+57 300 456 7890', N'Carrera 45 # 22-10, Medellín');
SELECT @customer_id = id FROM customer WHERE user_id = @user_id;

IF NOT EXISTS (SELECT 1 FROM login_history WHERE user_id = @user_id AND ip_address = '190.85.32.147')
  INSERT INTO login_history (user_id, ip_address, successful)
  VALUES (@user_id, '190.85.32.147', 1);

IF NOT EXISTS (SELECT 1 FROM player WHERE name = N'Daniel Ruiz' AND team_id = @team1_id)
  INSERT INTO player (team_id, name, position, jersey_number, nationality_id, birth_date)
  VALUES (@team1_id, N'Daniel Ruiz', 3, 20, @country_id, '2000-01-15');
SELECT @player_id = id FROM player WHERE name = N'Daniel Ruiz' AND team_id = @team1_id;

IF NOT EXISTS (SELECT 1 FROM team_stats WHERE team_id = @team1_id)
  INSERT INTO team_stats (team_id, points, matches_played, wins, draws, losses, goals_for, goals_against)
  VALUES (@team1_id, 24, 12, 7, 3, 2, 22, 12);

IF NOT EXISTS (SELECT 1 FROM player_stats WHERE player_id = @player_id)
  INSERT INTO player_stats (player_id, goals, assists, yellow_cards, red_cards, matches_played)
  VALUES (@player_id, 5, 4, 2, 0, 12);

IF NOT EXISTS (SELECT 1 FROM account WHERE customer_id = @customer_id)
  INSERT INTO account (customer_id, account_number, status)
  VALUES (@customer_id, 'TDB-0001-2026', 1);
SELECT @account_id = id FROM account WHERE customer_id = @customer_id;

IF NOT EXISTS (SELECT 1 FROM balance_movement WHERE account_id = @account_id AND type = 1 AND amount = 100000.00)
  INSERT INTO balance_movement (account_id, type, amount, resulting_balance)
  VALUES (@account_id, 1, 100000.00, 100000.00);

IF NOT EXISTS (
  SELECT 1 FROM [match]
  WHERE league_id = @league_id AND matchday_id = @matchday_id
    AND home_team_id = @team1_id AND away_team_id = @team2_id
)
  INSERT INTO [match] (league_id, matchday_id, home_team_id, away_team_id, stadium_id, match_date, status)
  VALUES (@league_id, @matchday_id, @team1_id, @team2_id, @stadium1_id, '2026-09-20T20:00:00', 0);
SELECT @match_id = id FROM [match]
WHERE league_id = @league_id AND matchday_id = @matchday_id
  AND home_team_id = @team1_id AND away_team_id = @team2_id;

IF NOT EXISTS (SELECT 1 FROM odds WHERE match_id = @match_id AND market = 1 AND outcome = 1 AND player_id IS NULL)
  INSERT INTO odds (match_id, player_id, market, outcome, odd_value)
  VALUES (@match_id, NULL, 1, 1, 2.10);
SELECT @odd_match_id = id FROM odds
WHERE match_id = @match_id AND market = 1 AND outcome = 1 AND player_id IS NULL;

IF NOT EXISTS (SELECT 1 FROM odds WHERE match_id = @match_id AND market = 2 AND outcome = 4 AND player_id = @player_id)
  INSERT INTO odds (match_id, player_id, market, outcome, odd_value)
  VALUES (@match_id, @player_id, 2, 4, 3.50);
SELECT @odd_player_id = id FROM odds
WHERE match_id = @match_id AND market = 2 AND outcome = 4 AND player_id = @player_id;

IF NOT EXISTS (SELECT 1 FROM bet WHERE customer_id = @customer_id AND match_id = @match_id AND odd_id = @odd_match_id)
  INSERT INTO bet (customer_id, match_id, odd_id, amount, odd_value_at_bet, potential_payout, status)
  VALUES (@customer_id, @match_id, @odd_match_id, 20000.00, 2.10, 42000.00, 0);

IF NOT EXISTS (SELECT 1 FROM balance_movement WHERE account_id = @account_id AND type = 3 AND amount = 20000.00)
  INSERT INTO balance_movement (account_id, type, amount, resulting_balance)
  VALUES (@account_id, 3, 20000.00, 80000.00);

SELECT 'example-data completed' AS result, @match_id AS match_id, @odd_match_id AS odd_id;
GO
