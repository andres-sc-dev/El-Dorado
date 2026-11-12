# Checklist de requisitos · El Dorado

Auditoría hecha el 12 de noviembre de 2026 sobre la rama `feat/fase-6-final`, con los contenedores levantados (`docker compose up -d --build`). Cada fila dice qué se comprobó de verdad hoy.

Estados: **Cumple**, **Parcial**, **No cumple**.

## Resumen

| # | Requisito | Estado | Evidencia | Pendiente |
|---|---|---|---|---|
| 1 | Dockerizado | Cumple | `docker-compose.yml` (4 bases, `db-init`, backend y frontend). `docker compose up -d --build` terminó con código 0; `docker compose ps`: las 4 bases y el backend `healthy`, `db-init` `Exited (0)`. `GET /api/health`: las 4 bases `ok`. | Backend y frontend corren en modo desarrollo (`node:22-alpine` + volumen). Para Azure hace falta un Dockerfile de producción (ver `docs/DESPLIEGUE.md`). |
| 2 | Bases en Firebase, MongoDB, MySQL, PostgreSQL y SQL Server, con tablas repartidas y justificadas | Cumple | Reparto en `CLAUDE.md` y justificación en `docs/DECISIONES.md` (Fase 1). Esquemas en `database/sqlserver`, `database/mysql`, `database/postgres`, `database/mongo`. Firestore: colección `payments` (`backend/src/services/wompiFirebaseService.js`). Sin FOREIGN KEY entre motores; claves naturales. | Ninguno. |
| 3 | Apuestas registradas dentro de la base (funciones PL/pgSQL) | Cumple | `database/postgres/03_bets.sql`: `fn_crear_apuesta`, `fn_liquidar_apuesta`, `fn_liquidar_partido`, `fn_recargar`, `fn_anular_apuesta`, todas con `SELECT ... FOR UPDATE`. Node solo las llama (`backend/src/repositories/postgres/betRepository.js`). Prueba de integración "CONCURRENCIA: dos apuestas simultáneas de 20.000 con 30.000 de saldo, solo una pasa": pasa. | Ninguno. |
| 4 | Ruta de Wompi | Cumple | `backend/src/routes/paymentRoutes.js`: `GET /api/payments/config`, `POST /api/payments/prepare` (solo USR), `GET /api/payments/:reference`, `GET /api/payments/transactions/:id`; `POST /api/payments/webhook` en `server.js` con checksum. Recorrido real contra Wompi Sandbox hoy: tarjeta 4242 quedó `CREDITED`, tarjeta 4111 quedó `DECLINED`. | El webhook real necesita una URL pública (llega con el despliegue). Hoy el estado se confirma consultando a Wompi y con `scripts/simulate-wompi-webhook.js`. |
| 5 | Recarga registrada en Firestore (`wompiFirebaseService.js`) | Cumple | `backend/src/services/wompiFirebaseService.js`: documento por `reference` con estados `CREATED`, `APPROVED`, `CREDITED`, `DECLINED`. En el recorrido de hoy la consulta `GET /api/payments/ELD-8222d151-...` leyó de Firestore el estado `CREDITED`. | Ninguno. |
| 6 | Google Sign-In | Cumple | `POST /api/auth/google` y `/api/auth/google/complete`; `frontend/src/components/forms/GoogleSignInButton.jsx`; `auth_provider` en `database/sqlserver/03_auth_provider.sql`. 19 pruebas en `backend/test/integration/google.test.js` (con `verifyIdToken` falso) y pruebas del botón en el frontend: pasan. | Hoy no se probó la ventana real de Google en el navegador: está en los pasos manuales. |
| 7 | Escudos desde Drive | Cumple | `GET /api/teams/AME/crest` respondió `200`, `image/png` y la cabecera `X-Crest-Source: drive`. Código: `backend/src/repositories/drive/crestDriveRepository.js`. Si Drive falla, usa `backend/data/crests` (20 archivos). | Ninguno. |
| 8 | Datos de API-Football quemados, con equipos en Postgres | Cumple | Respuestas crudas versionadas en `backend/data/apifootball/2024/` (equipos, partidos, plantillas, estadísticas). `npm run seed:apifootball` las carga sin llamar a la API; `API_FOOTBALL_KEY` no se pasa al contenedor. `GET /api/teams`: 20 equipos; `GET /api/players`: jugadores con `team_code`. | Ninguno. |
| 9 | Cédulas con puntos | Cumple | `frontend/src/components/forms/DocumentInput.jsx` y `formatDocument` en `frontend/src/utils/format.js` (formato de miles, sin enmascarar). El registro de hoy envió la cédula con puntos y respondió `201`. Las cédulas no van a los registros: la búsqueda en `docker compose logs backend` no las encontró. | Ninguno. |
| 10 | Barra y letrero de contraseña | Cumple | `frontend/src/components/forms/PasswordStrengthBar.jsx` (barra con niveles y letrero "Débil" a "Fuerte", `aria-live`). La misma política en `backend/src/utils/passwordPolicy.js`; `backend/test/passwordPolicy.test.js` pasa. | Ninguno. |
| 11 | Validación y aviso de límites al recargar (máximo 3.000.000) | Cumple | Letrero "Mínimo $10.000 · Máximo $3.000.000 por recarga" en `RechargePanel.jsx`. Recorrido de hoy: `POST /api/payments/prepare` con 3.000.001 respondió `400` "El monto máximo es $3.000.000". Límites en `WOMPI_MIN_COP` y `WOMPI_MAX_COP`. | Ninguno. |
| 12 | Partidos finalizados solo desde el admin | Cumple | `router.use(authenticate, requireRole('ADM'))` en `backend/src/routes/adminRoutes.js`. Recorrido de hoy: un USR recibió `403` al finalizar; el ADM finalizó 2-0 con `200` y la apuesta pasó a `WON` con pago de 24.800. `POST /api/match` sin sesión: `403` (`blockWrites`). | Ninguno. |
| 13 | Pruebas de valores de apuesta | Cumple | `backend/test/betValues.test.js` (14 casos: texto, NaN, cero, negativo, 999, 500.001, 3 decimales y válidos). Integración: monto igual al saldo, mayor al saldo, cuota cambiada (409), doble clic, concurrencia. Todas pasan. | Ninguno. |
| 14 | Variables de entorno encriptadas en Azure | No cumple | No se ha desplegado nada en Azure. Hoy los secretos viven solo en el `.env` local, que Git ignora. | Seguir `docs/DESPLIEGUE.md` (Azure for Students + Key Vault). |
| 15 | Frontend en Cloudflare | No cumple | No se ha publicado en Cloudflare Pages. | Seguir `docs/DESPLIEGUE.md`. |
| 16 | GitHub conectado | Parcial | `git remote -v`: `origin` es `github.com/andres-sc-dev/El-Dorado`. `origin/main` está 8 commits detrás de esta rama (las fases 3 a 6 no se han subido). No hay GitHub Actions (`.github/` no existe). | Subir `main` cuando lo confirmes y crear el flujo de GitHub Actions del plan de despliegue. |

## Resultados de las pruebas (12 de noviembre de 2026)

| Comando | Resultado |
|---|---|
| `cd backend && npm test` | 162 de 162 pasan |
| `docker compose exec backend npm run test:integration` | 91 de 91 pasan |
| `cd frontend && npm test` | 18 de 18 pasan |
| `cd frontend && npm run lint` | 0 errores, 3 advertencias (ya existían; no bloquean) |
| `cd frontend && npm run build` | Build correcto |

Los números finales están en el mensaje de cierre de la Fase 6 y en `docs/DECISIONES.md`.

## Recorrido de punta a punta (por API, contra Docker y Wompi Sandbox)

| Paso | Resultado |
|---|---|
| 1. Registro de un usuario nuevo con cédula con puntos | `201` |
| 2. Inicio de sesión | `200`, saldo 0 |
| 3. Recarga de 3.000.001 | `400` con el aviso del máximo |
| 4. Recarga de 50.000 con tarjeta 4242 | `CREDITED`, saldo 50.000 |
| 5. Recarga de 20.000 con tarjeta 4111 | `DECLINED`, saldo sin cambios |
| 6. Apuesta de 10.000 a "Local" con cuota 2,48 | `201`, saldo 40.000 |
| 7. Apuesta con una cuota vieja | `409 ODDS_CHANGED` |
| 8. El USR intenta finalizar el partido | `403` |
| 9. El ADM finaliza el partido 2-0 | `200` |
| 10. La apuesta queda liquidada | `WON`, pago 24.800, saldo final 64.800 |

El recorrido en el navegador (Widget de Wompi, ventana de Google, barra móvil del cupón) queda en los pasos manuales.

## Hallazgos de la auditoría

### Secretos

- **Historial de Git:** nunca se ha commiteado un `.env` ni un JSON de credenciales. Se buscaron llaves de Wompi (`prv_`, `test_events_`, `test_integrity_`, `pub_prod_`), llaves privadas PEM y llaves de Google (`AIza...`). Solo aparecen valores falsos de las pruebas (`prv_test_llaveprivadadeprueba`, una PEM `ABC`).
- **Valores reales del `.env` en el historial:** ninguna contraseña ni llave. Solo coinciden los nombres de usuario de las bases (`SQLSERVER_USER`, `MYSQL_USER`, `POSTGRES_USER`), que aparecen en la documentación. No son secretos, pero conviene que no sean adivinables en producción.
- **`backend/.env`:** archivo local viejo (nombres de la época anterior del proyecto). Git lo ignora y la app no lo usa con Docker. Conviene borrarlo a mano.
- Los registros nuevos de pagos pasan por una lista de campos permitidos (`backend/src/utils/paymentLog.js`); `backend/test/paymentLog.test.js` comprueba que usuario, correo, cédula, firma y llaves no pasan. En los registros de hoy no aparecieron usuarios, correos ni llaves.

### Rutas sin autenticación o sin rol

Se probaron sin sesión: `GET /api/admin/matches` 401, `POST /api/admin/matches/:code/finish` 401, `GET /api/users/1/balance` 401, `GET /api/wallet/me` 401, `POST /api/bets` 401, `POST /api/payments/prepare` 401, `POST /api/match` 403.

Rutas públicas a propósito: `/api/health`, login, registro, Google, `/api/matches`, `/api/catalogs`, los escudos y las lecturas de solo lectura de MySQL, PostgreSQL (equipos y jugadores) y MongoDB (mercados y reglas). Ninguna devuelve datos de usuarios ni de dinero. Toda escritura que no está declarada responde 403.

### Datos de prueba en pantallas reales

- **Promociones:** la página y la sección de la portada usaban datos inventados (`frontend/src/data/promotions.js`) y un botón "Canjear bono" que no hacía nada en la base. **Se eliminaron** (página, ruta, menú, servicio y la carpeta `frontend/src/data/`).
- Se eliminó `frontend/test/run_tests.mjs`, que probaba esos datos inventados y ya no corría.
- Los partidos "demo" de la temporada 2026-II existen para poder apostar, y la interfaz los muestra como "Liga BetPlay · demo (réplica de 2024-II)". No se presentan como partidos reales.
- La imagen de fondo de la portada es decorativa (Unsplash).
