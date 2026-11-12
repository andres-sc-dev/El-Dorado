require('dotenv').config();

const cors = require('cors');
const express = require('express');
const authRoutes = require('./src/routes/authRoutes');
const domainRoutes = require('./src/routes/domainRoutes');
const catalogRoutes = require('./src/routes/catalogRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const { health } = require('./src/controllers/healthController');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const databases = require('./src/config/databases');

const app = express();
const port = Number(process.env.PORT || 4000);

// Solo permitimos al frontend de Vite realizar peticiones desde el navegador.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Idempotency-Key'],
}));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', health);
app.use('/api/auth', authRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', domainRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  // Arranque tolerante: el servidor escucha aunque alguna base esté caída.
  // Solo se informa el estado inicial de cada motor.
  app.listen(port, async () => {
    console.log(`El Dorado backend escuchando en http://localhost:${port}`);
    const status = await databases.checkAll({ fresh: true });
    for (const [name, result] of Object.entries(status)) {
      console.log(`  ${name.padEnd(9)} ${result.status}${result.error ? ` (${result.error})` : ''}`);
    }
  });
}

module.exports = app;
