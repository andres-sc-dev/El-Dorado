# El Dorado

**Apuestas del Fútbol Colombiano** · *Vuelve la época dorada*

El Dorado es una plataforma web de apuestas deportivas sobre la Liga BetPlay Dimayor. El nombre rinde homenaje a la Época de El Dorado (1949-1954) del fútbol colombiano.

> **Proyecto académico** (Bases de Datos II). Dinero de prueba, sin valor real. Solo para mayores de 18 años.

## Qué hace

- Registro e inicio de sesión con usuario y contraseña, o con Google (Firebase Authentication).
- Partidos de la Liga BetPlay con datos reales de la temporada 2024 (API-Football, descargados una sola vez) y cuotas calculadas por un modelo.
- Apuestas simples (una selección por tiquete) entre 1.000 y 500.000 COP.
- Recargas con Wompi Sandbox entre 10.000 y 3.000.000 COP. Cada recarga queda en Firestore.
- Panel de administración: el administrador finaliza los partidos y las apuestas se liquidan solas.

## Arquitectura

Frontend en React + Vite y una API en Node.js + Express que reparte los datos en cinco motores, sin claves foráneas entre ellos. Se referencian por claves naturales (`username`, `match_code`, `team_code`, `market_code`) y la API combina los datos.

| Motor | Datos |
|---|---|
| SQL Server 2022 | Identidad: usuarios, clientes, roles, estados, tipos de documento, historial de acceso |
| MySQL 8 | Competición: países, deportes, ligas, estadios, jornadas, partidos, estados y cuotas |
| PostgreSQL 16 | Dinero (cuentas, apuestas, movimientos, funciones PL/pgSQL) y dataset de equipos y jugadores |
| MongoDB 7 | Mercados de apuesta, resultados posibles, reglas de juego y auditoría |
| Firestore | Registro de cada recarga de Wompi (colección `payments`) |

Los esquemas y semillas están en [`database/`](database/). Las decisiones de diseño están en [`docs/DECISIONES.md`](docs/DECISIONES.md), el estado frente a los requisitos en [`docs/CHECKLIST_PROFE.md`](docs/CHECKLIST_PROFE.md) y el plan de despliegue en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Prerrequisitos

- Docker Desktop (gratis para uso personal y educativo) con al menos 6 GB de RAM asignados.
- Equipo amd64: la imagen de SQL Server no corre en ARM.
- Git. Node.js 22 solo si quieres correr las pruebas fuera de Docker.

## Cómo levantar todo

```bash
# 1. Variables de entorno: copia la plantilla y llena los valores.
cp .env.example .env

# 2. Levanta las bases, la API y el frontend (la primera vez descarga unos 3 GB de imágenes).
docker compose up -d --build

# 3. Comprueba que todo esté healthy y que las 4 bases respondan.
docker compose ps
curl http://localhost:4000/api/health
```

Abre http://localhost:5173.

Reglas para el `.env`:
- `MSSQL_SA_PASSWORD` y `SQLSERVER_PASSWORD`: mínimo 8 caracteres con mayúsculas, minúsculas, números y símbolos (política de SQL Server). Sin comillas.
- `MONGO_INITDB_ROOT_PASSWORD`: solo letras y números (va dentro de una URL).
- Wompi: solo llaves de Sandbox (`pub_test_...`, `prv_test_...`, `test_events_...`, `test_integrity_...`).
- Firebase: los tres valores de la cuenta de servicio van en `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`. El JSON de la cuenta de servicio nunca va a Git.

## Usuarios de prueba

Los crea la semilla `npm run seed:demo` cada vez que arranca el backend. Las contraseñas no están en el repositorio: se definen en tu `.env`.

| Usuario | Rol | Dónde se define |
|---|---|---|
| Demo | `USR` (apuesta y recarga) | `DEMO_USERNAME` y `DEMO_PASSWORD`; saldo inicial en `DEMO_BALANCE` |
| Administrador | `ADM` (finaliza partidos) | `ADMIN_USERNAME` y `ADMIN_PASSWORD` (mínimo 12 caracteres) |

El registro público siempre crea usuarios `USR`. El único administrador sale del `.env`.

## Cómo probar una recarga

1. Inicia sesión con el usuario demo (o uno nuevo) y entra a **Billetera**.
2. Escribe un monto entre 10.000 y 3.000.000 COP. Fuera de ese rango la interfaz y la API lo rechazan con un aviso.
3. Pulsa **Recargar** y paga en el Widget de Wompi Sandbox:
   - Aprobada: `4242 4242 4242 4242`
   - Declinada: `4111 1111 1111 1111`
   - Cualquier fecha futura y cualquier CVC de 3 dígitos.
4. La pantalla termina en "Pago aprobado", "Pago rechazado" o, si Wompi no confirma a tiempo, "Todavía no recibimos la confirmación de Wompi" con el botón "Verificar de nuevo".

Para seguir el flujo en el servidor: `docker compose logs -f backend | grep '"scope":"payments"'`. Cada paso deja una línea JSON con la referencia y el estado, sin llaves ni datos personales.

El webhook se prueba sin URL pública: `docker compose exec backend node scripts/simulate-wompi-webhook.js <reference> APPROVED --amount=<pesos>`.

## Cómo ejecutar las pruebas

```bash
# Backend, sin bases (seguridad, liquidación, pagos, contraseñas, registro de pagos)
cd backend && npm test

# Backend contra las bases reales (necesita docker compose up)
docker compose exec backend npm run test:integration

# Frontend: componentes (cupón, recarga, Google), lint y build
cd frontend && npm test && npm run lint && npm run build
```

El detalle de cada caso está en [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

## Servicios

| Servicio | Puerto en tu equipo | Para qué |
|---|---|---|
| frontend | 5173 | Interfaz web |
| backend | 4000 | API |
| sqlserver | 127.0.0.1:14333 | SQL Server |
| mysql | 127.0.0.1:13306 | MySQL |
| postgres | 127.0.0.1:15432 | PostgreSQL |
| mongo | 127.0.0.1:27027 | MongoDB |
| db-init | (ninguno) | Corre una vez y termina: crea el esquema de SQL Server |

Los puertos se cambian en el `.env` (`*_HOST_PORT`). Las bases solo escuchan en `127.0.0.1`.

## Comandos útiles

```bash
docker compose logs -f backend        # ver la API
docker compose exec backend npm run seed:demo   # recrear demo y admin
docker compose stop postgres          # simular una base caída: solo sus rutas responden 503
docker compose start postgres
docker compose down                   # detener todo y conservar los datos
```

## Reiniciar con bases limpias

```bash
docker compose down -v   # Atención: borra los datos de las 4 bases
docker compose up -d --build
```

MySQL, PostgreSQL y MongoDB solo ejecutan sus scripts de `database/` cuando el volumen está vacío. SQL Server los ejecuta en cada arranque (con `db-init`) y, como son idempotentes, no duplica nada.

## Estado

Fase 6 (cierre) en la rama `feat/fase-6-final`. Funciona en local con Docker. El despliegue en Azure y Cloudflare **no está hecho**: el plan gratuito está en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md). Los retiros siguen deshabilitados.

## Autor

**Andrés** · [@andres-sc-dev](https://github.com/andres-sc-dev)
Estudiante de Ingeniería de Software en el Tecnológico de Antioquia IU, Medellín, Colombia.
