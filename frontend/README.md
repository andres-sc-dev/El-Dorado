# El Dorado — Apuestas del Fútbol Colombiano

**Vuelve la época dorada**

Frontend de El Dorado, construido con React, Vite, React Router y Tailwind CSS.

## Desarrollo local

1. Inicia el backend siguiendo las instrucciones de [`backend/README.md`](../backend/README.md).
2. Desde esta carpeta, instala dependencias con `npm ci`.
3. Ejecuta `npm run dev` para iniciar Vite.

El servidor de desarrollo reenvía las peticiones `/api` al backend en
`http://localhost:4000`. Para cambiar ese destino, define
`VITE_API_PROXY_TARGET`.

## Validación

- `npm run build`: genera la compilación de producción.
- `npm run lint`: ejecuta Oxlint.
