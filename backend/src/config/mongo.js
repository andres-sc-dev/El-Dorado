const { MongoClient } = require('mongodb');

// Cliente propio de MongoDB (mercados, reglas y auditoría). Se conecta al primer uso.
let clientPromise;

function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      maxPoolSize: 10,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClient();
  return client.db(process.env.MONGO_DB || 'el_dorado');
}


// Marca el error con el motor para que el manejador de errores responda 503 con su nombre.
function tagEngine(error) {
  if (error && typeof error === 'object' && !error.engine) error.engine = 'mongo';
  throw error;
}

// Ejecuta fn(db) y marca cualquier error como de MongoDB.
async function withDb(fn) {
  try {
    return await fn(await getDb());
  } catch (error) {
    return tagEngine(error);
  }
}

async function ping() {
  const db = await getDb();
  await db.command({ ping: 1 });
}

async function close() {
  if (!clientPromise) return;
  const pending = clientPromise;
  clientPromise = undefined;
  try { await (await pending).close(); } catch { /* ya estaba cerrado */ }
}

module.exports = { getDb, withDb, ping, close };
