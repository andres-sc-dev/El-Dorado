# El Dorado

**Apuestas del Fútbol Colombiano** · *Vuelve la época dorada*

Plataforma web de apuestas deportivas sobre la Liga BetPlay Dimayor. El nombre rinde homenaje a la Época de El Dorado (1949–1954) del fútbol colombiano.

> **Proyecto académico** (Bases de Datos II). No maneja dinero real: todo el saldo es de prueba. Solo para mayores de 18 años.

## Arquitectura

Frontend en React + Vite y una API en Node.js + Express que reparte los datos en cuatro motores, sin claves foráneas entre ellos (se referencian por claves naturales como `username`, `match_code`, `team_code` y `market_code`):

| Motor | Datos |
|---|---|
| SQL Server 2022 | Identidad: usuarios, clientes, roles, tipos de documento, historial de acceso |
| MySQL 8 | Competición: países, ligas, estadios, jornadas, partidos y cuotas |
| PostgreSQL 16 | Dinero (cuentas, apuestas, movimientos) y dataset de equipos y jugadores |
| MongoDB 7 | Mercados de apuesta, resultados posibles, reglas de juego y auditoría |

Los esquemas y semillas están en [`database/`](database/), uno por motor. Las decisiones de diseño están en [`docs/DECISIONES.md`](docs/DECISIONES.md).

## Prerrequisitos

- Docker Desktop (gratis para uso personal y educativo) con **al menos 6 GB de RAM** asignados. SQL Server solo necesita unos 2 GB.
- Equipo amd64: la imagen de SQL Server no corre en ARM.
- Git. Node.js 22 solo si quieres correr las pruebas o el backend fuera de Docker.

## Puesta en marcha

```bash
# 1. Variables de entorno: copia la plantilla y llena todos los valores obligatorios.
cp .env.example .env

# 2. Levanta todo (la primera vez descarga unos 3 GB de imágenes).
docker compose up -d --build

# 3. Comprueba que todo esté healthy y que las 4 bases respondan.
docker compose ps
curl http://localhost:4000/api/health
```

Abre http://localhost:5173 e inicia sesión con `DEMO_USERNAME` y `DEMO_PASSWORD` de tu `.env`. El usuario de demostración se crea solo al arrancar el backend, con 500.000 COP de saldo de prueba.

Para entrar como administrador usa `ADMIN_USERNAME` y `ADMIN_PASSWORD` de tu `.env`. La semilla lo crea con el rol `ADM` y, al iniciar sesión, te lleva al panel `/admin`, donde se finalizan los partidos y se liquidan las apuestas.

Reglas para el `.env`:
- `MSSQL_SA_PASSWORD` y `SQLSERVER_PASSWORD`: mínimo 8 caracteres con mayúsculas, minúsculas, números y símbolos (política de SQL Server). Sin comillas.
- `MONGO_INITDB_ROOT_PASSWORD`: solo letras y números (va dentro de una URL).

## Servicios

| Servicio | Puerto en tu equipo | Para qué |
|---|---|---|
| frontend | 5173 | Interfaz web |
| backend | 4000 | API |
| sqlserver | 127.0.0.1:14333 | SQL Server |
| mysql | 127.0.0.1:13306 | MySQL |
| postgres | 127.0.0.1:15432 | PostgreSQL |
| mongo | 127.0.0.1:27027 | MongoDB |
| db-init | — | Corre una vez y termina: crea el esquema de SQL Server |

Los puertos se cambian en el `.env` (`*_HOST_PORT`). Las bases solo escuchan en `127.0.0.1`, así que no quedan expuestas a tu red.

## Comandos útiles

```bash
docker compose logs -f backend        # ver la API
docker compose exec backend npm test  # pruebas sin bases (seguridad y liquidación)
docker compose exec backend npm run test:integration   # pruebas contra las 4 bases (ver docs/PRUEBAS.md)
docker compose exec backend npm run seed:demo   # recrear demo y admin, y sincronizar los límites de apuesta
docker compose stop postgres          # simular una base caída: solo sus rutas responden 503
docker compose start postgres
docker compose down                   # detener todo y conservar los datos
```

## Reiniciar con bases limpias

Los datos viven en volúmenes de Docker. Para borrarlos y empezar de cero:

```bash
docker compose down -v   # ⚠️ borra los datos de las 4 bases
docker compose up -d --build
```

MySQL, PostgreSQL y MongoDB solo ejecutan sus scripts de `database/` cuando el volumen está vacío. SQL Server los ejecuta en cada arranque (con `db-init`), y como son idempotentes no duplica nada.

## Estado

Fase 3 (recargas con Wompi Sandbox) en la rama `feat/fase-3-wompi`, sobre la Fase 2 (apuestas):
- Se apuesta desde http://localhost:5173. Solo apuestas simples, entre 1.000 y 500.000 COP.
- **Recargas con Wompi Sandbox** desde la billetera, entre 10.000 y 3.000.000 COP (`WOMPI_MIN_COP` y `WOMPI_MAX_COP`). Cada pago queda en Firestore (`payments`) y el saldo se acredita con `fn_recargar` en PostgreSQL. **Solo se aceptan llaves de Sandbox** (`pub_test_...`).
- El webhook se prueba sin URL pública: `docker compose exec backend node scripts/simulate-wompi-webhook.js <reference> APPROVED --amount=<pesos>`.
- Política de contraseñas con barra de fortaleza, cédula con puntos y auditoría en MongoDB.
- Pendiente: retiros, login con Google, URL pública para el webhook real y despliegue.

## Autor

**Andrés** · [@andres-sc-dev](https://github.com/andres-sc-dev)
Estudiante de Ingeniería de Software en el Tecnológico de Antioquia IU, Medellín, Colombia.
