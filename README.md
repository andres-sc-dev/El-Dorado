# El Dorado

**Apuestas del Fútbol Colombiano** · *Vuelve la época dorada*

Plataforma web de apuestas deportivas enfocada en el fútbol colombiano (Liga BetPlay Dimayor). El nombre rinde homenaje a la Época de El Dorado (1949–1954), el periodo más brillante del fútbol profesional del país.

> **Proyecto en desarrollo.** Estoy mejorando constantemente la experiencia de usuario, el diseño y las funcionalidades. Habrá cambios frecuentes.

## Un cambio de nombre

Este proyecto se llamaba **TDEABET**. Por gusto personal decidí renombrarlo a **El Dorado**, con una identidad más propia y alineada con la historia del fútbol colombiano. Si ves referencias al nombre anterior en commits o issues antiguos, es el mismo proyecto.

## Tecnologías

**Frontend**
- React + Vite (JavaScript)
- TailwindCSS
- React Router
- Context API (autenticación y boleto de apuestas)

**Backend**
- Node.js + Express
- SQL Server (`mssql`)
- Autenticación con `bcrypt` y `jsonwebtoken`

## Estado y hoja de ruta

- [x] Diseño de la base de datos (26 tablas, normalizada)
- [x] Estructura del frontend con capa de servicios
- [x] Registro e inicio de sesión
- [ ] Conectar el frontend a la API real
- [ ] Visualización de partidos, apuestas y recargas
- [ ] Panel de administrador (finalizar partidos y registrar resultados)
- [ ] Dockerización y soporte multibase de datos
- [ ] Despliegue en la nube
- [ ] Mejoras de experiencia de usuario y diseño

## Cómo ejecutarlo

Próximamente. El proyecto está en proceso de dockerización y las instrucciones se agregarán cuando esté listo.

## Aviso

Proyecto con fines **académicos y de portafolio**. No maneja dinero real: los pagos se realizan únicamente en modo de pruebas (sandbox).

## Autor

**Andrés** · [@andres-sc-dev](https://github.com/andres-sc-dev)
Estudiante de Ingeniería de Software en el Tecnológico de Antioquia UI, Medellín, Colombia.