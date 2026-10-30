# El Dorado — catálogos e identificadores

**Apuestas del Fútbol Colombiano · Vuelve la época dorada**

Tabla diseñada para identificar los id's de cada tabla de la base de datos.

user_status:
    (0, 'Inactive'),
    (1, 'Active'),
    (2, 'Blocked');

account_status
    (0, 'Suspended'),
    (1, 'Active'),
    (2, 'Closed');

match_status
    (0, 'Scheduled'),
    (1, 'Live'),
    (2, 'Finished'),
    (3, 'Cancelled');

bet_status
    (0, 'Pending'),
    (1, 'Won'),
    (2, 'Lost'),
    (3, 'Cancelled');

player_position
    (1, 'Goalkeeper'),
    (2, 'Defender'),
    (3, 'Midfielder'),
    (4, 'Forward');

odds_market
    (1, 'Match Result (1x2)'),
    (2, 'Player Goal'),
    (3, 'Player Card'),
    (4, 'Player Assist');

odds_outcome
    (1, 'Home'),
    (2, 'Draw'),
    (3, 'Away'),
    (4, 'Yes'),
    (5, 'No');

movement_type
    (1, 'Deposit'),
    (2, 'Withdrawal'),
    (3, 'Bet Placed'),
    (4, 'Bet Payout');