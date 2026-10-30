require('dotenv').config();

const cors = require('cors');
const express = require('express');
const authRoutes = require('./src/routes/authRoutes');
const domainRoutes = require('./src/routes/domainRoutes');
const catalogRoutes = require('./src/routes/catalogRoutes');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();
const port = Number(process.env.PORT || 4000);

// Solo permitimos al frontend de Vite realizar peticiones desde el navegador.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api', domainRoutes);
app.use(errorHandler);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`El Dorado backend escuchando en http://localhost:${port}`);
  });
}

module.exports = app;
