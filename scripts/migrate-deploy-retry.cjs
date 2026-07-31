#!/usr/bin/env node
/**
 * Runs `prisma migrate deploy` with retries so a transient DB blip during a
 * Vercel build doesn't fail the whole deployment.
 *
 * Neon serverless auto-suspends; a cold start can lose the race with the
 * build's connect and throw P1001 ("Can't reach database server"). Retrying a
 * few times gives the compute time to wake. Used by the `vercel-build` script.
 */
const { execSync } = require('node:child_process');

const MAX_ATTEMPTS = 5;
const DELAY_MS = 5000;

function sleep(ms) {
  // Synchronous sleep so the build waits without extra async plumbing.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit', env: process.env });
    process.exit(0);
  } catch {
    if (attempt >= MAX_ATTEMPTS) {
      console.error(`[migrate-deploy] failed after ${MAX_ATTEMPTS} attempts`);
      process.exit(1);
    }
    console.warn(
      `[migrate-deploy] attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${DELAY_MS / 1000}s…`,
    );
    sleep(DELAY_MS);
  }
}
