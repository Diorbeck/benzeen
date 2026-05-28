#!/usr/bin/env node
/**
 * Wait for PostgreSQL to accept connections on localhost:5433.
 * Used by db:setup so prisma db push runs after the DB is ready.
 */
const net = require('net');
const port = process.env.DB_PORT || 5433;
const host = process.env.DB_HOST || '127.0.0.1';
const maxAttempts = 30;
const delayMs = 1000;

function tryConnect(attempt) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, host, () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', () => {
      socket.destroy();
      if (attempt >= maxAttempts) reject(new Error(`Database not reachable after ${maxAttempts} attempts`));
      else setTimeout(() => tryConnect(attempt + 1).then(resolve, reject), delayMs);
    });
  });
}

tryConnect(0)
  .then(() => {
    console.log('Database is ready.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
