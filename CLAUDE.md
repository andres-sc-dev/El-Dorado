# El Dorado: reglas permanentes

## Proyecto
- Proyecto "El Dorado": académico, con dinero de prueba.
- Carpetas `frontend` (React + Vite) y `backend` (Node + Express). Esquemas de base en `database/`.
- JavaScript, sin TypeScript.
- Todo debe ser GRATIS: ninguna herramienta ni servicio de pago.

## Backend
- Por capas: `config`, `routes`, `controllers`, `services`, `repositories`, `middleware`, `utils`.
- Los controllers solo leen `req` y escriben `res`. La lógica va en services y el SQL en repositories.
- Consultas siempre parametrizadas.
- Usuario y rol salen del JWT (cookie HttpOnly), nunca del cliente.

## Datos
- Identificadores en inglés, comentarios en español.
- VARCHAR solo si es estrictamente necesario, con un comentario que lo justifique.
- Catálogos como tablas.
- La tabla de clientes se sigue llamando `customer`.
- La base de datos se llama `el_dorado` en todos los motores.

## Reparto por motor
- SQL Server = identidad: users, customer, login_history, user_status, role, document_type.
- MySQL = country, sport, league, stadium, matchday, match, match_status, odds.
- PostgreSQL = account, bet, bet_leg, balance_movement, catálogos de cuenta, apuesta y movimiento, y el dataset de equipos: team, player, player_position, team_stats, player_stats.
- MongoDB = game_rule, odds_market, odds_outcome y audit_log.
- Firestore = pagos Wompi. Firebase Auth = Google.

## Entre motores
- Sin FOREIGN KEY entre motores.
- Referencias por claves naturales (username, match_code, market_code, team_code), nunca por IDs autoincrementales.
- La API valida las referencias y combina los datos en JavaScript.

## Dinero
- Apostar, recargar y liquidar viven en funciones PL/pgSQL transaccionales con `SELECT ... FOR UPDATE`. Node solo las llama.
- Solo apuestas simples.
- Recarga Wompi: mínimo 10.000 y máximo 3.000.000 COP, por variables de entorno.

## Datos personales
- Cédulas: solo formato con puntos de miles, sin enmascarar.
- Las cédulas nunca van a los logs.

## Errores HTTP
- 400 validación, 401 sesión, 403 rol, 404 no existe, 409 conflicto, 503 dependencia caída, 500 otro.

## Secretos
- Solo por variables de entorno.
- `.env` y los JSON de credenciales jamás entran en Git.

## Al cerrar una tarea
- Ejecutar build, lint y pruebas, y reportar los resultados reales.
- Actualizar `docs/DECISIONES.md`: qué se decidió y por qué, en lenguaje simple.
- Pedir confirmación antes de comandos destructivos o que creen recursos en la nube.
