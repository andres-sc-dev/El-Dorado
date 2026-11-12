# Plan de despliegue · El Dorado

**Estado al 12 de noviembre de 2026: no hay nada desplegado.** Este documento es el plan para hacerlo después. No se ejecutó ningún comando en la nube.

Objetivo: backend en Azure con los secretos en Key Vault, frontend en Cloudflare Pages y publicación automática desde GitHub Actions, sin pagar nada.

## Qué es gratis y qué consume crédito

| Pieza | Servicio | Costo |
|---|---|---|
| Cuenta | Azure for Students | Gratis, sin tarjeta, con correo institucional. Trae crédito de USD 100 por 12 meses, renovable mientras seas estudiante. |
| API | Azure Container Apps (plan de consumo) | Cada mes trae una cuota gratuita de vCPU, memoria y peticiones que cubre una API de clase. |
| Secretos | Azure Key Vault (Standard) | Cobra por operación (centavos al mes). Sale del crédito de estudiante, no de tu bolsillo. |
| SQL Server | Azure SQL Database, oferta gratuita (serverless) | Gratis dentro del límite mensual de la oferta. |
| PostgreSQL y MySQL | Azure Database for PostgreSQL / MySQL Flexible Server, B1ms | 750 horas al mes gratis durante 12 meses con Azure for Students. |
| MongoDB | MongoDB Atlas M0 (o Azure Cosmos DB for MongoDB, nivel gratuito) | Gratis. |
| Firestore y Firebase Auth | Firebase, plan Spark | Gratis (ya está en uso). |
| Imagen del backend | GitHub Container Registry (ghcr.io) | Gratis. Se evita Azure Container Registry, que sí cobra. |
| Frontend | Cloudflare Pages | Gratis. |
| Proxy `/api` | Cloudflare Pages Functions | Gratis hasta 100.000 peticiones al día. |
| CI/CD | GitHub Actions | Gratis en repos públicos; 2.000 minutos al mes en privados. |

Antes de cada paso, revisa en el portal que el recurso diga "gratis" o "incluido en la oferta". Configura una alerta de presupuesto de USD 1 en *Cost Management* para enterarte si algo empieza a cobrar.

## Paso 0 · Preparar el repositorio (en tu equipo)

1. Crear `backend/Dockerfile` de producción: `node:22-alpine`, `npm ci --omit=dev`, `CMD ["node", "server.js"]`. Hoy el backend corre en modo desarrollo con un volumen; eso no sirve en la nube.
2. Crear `frontend/functions/api/[[path]].js`, una Pages Function que reenvía `/api/*` a la URL del backend en Azure. Así el navegador ve un solo dominio y la cookie de sesión sigue siendo `SameSite=Lax`, sin depender de cookies de terceros (que Safari y Chrome bloquean cada vez más).
3. Confirmar que `.env` y los JSON de credenciales siguen fuera de Git (`git status` no debe mostrarlos).

## Paso 1 · Azure for Students

1. Entrar a https://azure.microsoft.com/free/students con el correo del Tecnológico de Antioquia.
2. Crear un grupo de recursos `rg-el-dorado` en una región cercana con oferta gratuita (por ejemplo, East US 2).
3. Crear la alerta de presupuesto de USD 1.

## Paso 2 · Bases de datos

1. **SQL Server:** crear Azure SQL Database con la oferta gratuita, base `el_dorado`. Ejecutar `database/sqlserver/01_schema.sql`, `02_app_login.sql` y `03_auth_provider.sql` desde Azure Data Studio o `sqlcmd`.
2. **PostgreSQL:** crear Flexible Server B1ms, base `el_dorado`. Ejecutar `database/postgres/01_schema.sql`, `02_seed.sql` y `03_bets.sql`.
3. **MySQL:** crear Flexible Server B1ms, base `el_dorado`. Ejecutar `database/mysql/01_schema.sql` y `02_seed.sql`.
4. **MongoDB:** crear un clúster M0 en MongoDB Atlas, base `el_dorado`. Ejecutar `database/mongo/01_init.js` con `mongosh`.
5. En cada base, permitir solo conexiones desde servicios de Azure (y tu IP mientras cargas los scripts). Quitar tu IP al terminar.
6. Cargar los datos de demo y de API-Football una sola vez desde tu equipo, apuntando a las bases de la nube: `npm run seed:demo` y `npm run seed:apifootball` (leen los JSON del repo; no llaman a la API).

## Paso 3 · Key Vault (variables encriptadas)

1. Crear un Key Vault `kv-el-dorado` con el modelo de permisos RBAC.
2. Crear un secreto por cada variable sensible de `.env.example`. Key Vault no admite guiones bajos, así que se usan guiones: `JWT-SECRET`, `SQLSERVER-PASSWORD`, `POSTGRES-PASSWORD`, `MYSQL-PASSWORD`, `MONGO-URI`, `WOMPI-PRIVATE-KEY`, `WOMPI-EVENTS-SECRET`, `WOMPI-INTEGRITY-SECRET`, `FIREBASE-PRIVATE-KEY`, `FIREBASE-CLIENT-EMAIL`, `ADMIN-PASSWORD`, `DEMO-PASSWORD`.
3. Key Vault guarda los secretos cifrados en reposo. Nadie los ve en el código, en GitHub ni en los registros.

## Paso 4 · Backend en Azure Container Apps

1. Crear un entorno de Container Apps y una app `el-dorado-api` con la imagen `ghcr.io/andres-sc-dev/el-dorado-backend:latest`, puerto 4000 e ingreso externo HTTPS.
2. Activar la **identidad administrada** de la app y darle el rol *Key Vault Secrets User* sobre `kv-el-dorado`.
3. En la app, crear secretos de tipo "referencia a Key Vault" para cada secreto del paso 3 y mapearlos a variables de entorno con el nombre original (`JWT_SECRET`, `POSTGRES_PASSWORD`, ...).
4. Variables no secretas directas: `NODE_ENV=production`, `PORT=4000`, hosts y puertos de cada base, `WOMPI_API_URL=https://sandbox.wompi.co/v1`, `WOMPI_MIN_COP=10000`, `WOMPI_MAX_COP=3000000`, `BET_MIN_COP`, `BET_MAX_COP`, `FIREBASE_PROJECT_ID`, `GDRIVE_CRESTS_FOLDER_ID`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `CORS_ORIGINS=https://<tu-proyecto>.pages.dev`.
5. `API_FOOTBALL_KEY` **no** se configura: la app nunca llama a API-Football.
6. Réplicas mínimas en 0 para no gastar cuando nadie la usa (la primera petición tarda unos segundos).
7. Probar `https://<app>.azurecontainerapps.io/api/health`.

## Paso 5 · Frontend en Cloudflare Pages

1. En Cloudflare, *Workers & Pages* -> *Create* -> *Pages* -> conectar el repositorio de GitHub.
2. Directorio raíz `frontend`, comando `npm run build`, salida `dist`.
3. Variables de compilación (todas públicas): `VITE_WOMPI_PUBLIC_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. `VITE_API_URL` se deja vacío porque `/api` lo atiende la Pages Function del paso 0.
4. Variable de la Function: `API_ORIGIN=https://<app>.azurecontainerapps.io`.
5. Agregar una regla SPA para que las rutas de React (`/wallet`, `/admin`) devuelvan `index.html`.

## Paso 6 · Servicios externos con la URL pública

1. **Firebase Authentication:** agregar `<tu-proyecto>.pages.dev` a los dominios autorizados.
2. **Wompi Sandbox:** en *Desarrolladores*, poner la URL de eventos `https://<tu-proyecto>.pages.dev/api/payments/webhook`. Con una URL pública ya se puede volver a usar `redirect-url` en el Widget (hoy no se usa porque `localhost` da 403).
3. **Google Drive:** la carpeta de escudos ya está compartida con la cuenta de servicio; no cambia.

## Paso 7 · GitHub Actions

1. En Azure, crear una *App registration* con credencial federada (OIDC) para el repositorio y la rama `main`, y darle el rol *Contributor* solo sobre `rg-el-dorado`. Con OIDC no se guarda ninguna contraseña en GitHub.
2. En GitHub, *Settings* -> *Secrets and variables* -> *Actions*: guardar `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` y `AZURE_SUBSCRIPTION_ID` (identificadores, no contraseñas).
3. Crear `.github/workflows/deploy.yml` con dos trabajos al hacer push a `main`:
   - **test:** `npm ci` y `npm test` en `backend`; `npm ci`, `npm test`, `npm run lint` y `npm run build` en `frontend`.
   - **deploy-api** (si `test` pasa): `docker build` de `backend`, `docker push` a ghcr.io con `GITHUB_TOKEN`, `azure/login` con OIDC y `az containerapp update --image ...`.
4. Cloudflare Pages se publica solo con cada push; no necesita un trabajo aparte.

## Paso 8 · Verificación

1. `GET /api/health` en la URL pública: las 4 bases en `ok`.
2. Registro, recarga con 4242 y con 4111, apuesta y finalización desde el admin, igual que en local.
3. Revisar en Container Apps -> *Log stream* las líneas `"scope":"payments"`: no deben aparecer llaves ni datos personales.
4. Actualizar las filas 14, 15 y 16 de `docs/CHECKLIST_PROFE.md` con la evidencia.
