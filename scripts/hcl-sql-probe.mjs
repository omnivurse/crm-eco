#!/usr/bin/env node
/**
 * Ops-only Health Cost Labs SQL probe.
 * Never imported by Next apps. Read-only: SELECT name FROM sys.databases.
 * Does not scan tblTiC_directory or walk 13k tables.
 *
 * Usage (from repo root, with .env.local loaded):
 *   node --env-file=.env.local scripts/hcl-sql-probe.mjs
 */
import net from 'node:net';
import { createRequire } from 'node:module';

const host = process.env.HCL_SQL_SERVER || '';
const port = Number(process.env.HCL_SQL_PORT || '1433');
const user = process.env.HCL_SQL_USER || '';
const password = process.env.HCL_SQL_PASSWORD || '';
const encrypt = (process.env.HCL_SQL_ENCRYPT || 'true').toLowerCase() !== 'false';

function mask(value) {
  if (!value) return '(empty)';
  return `${value.slice(0, 2)}…(${value.length} chars)`;
}

function tcpOpen(hostname, tcpPort, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: hostname, port: tcpPort });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function main() {
  if (!host) {
    console.error('HCL_SQL_SERVER is not set. This script is ops-only.');
    process.exit(1);
  }

  console.log('HCL SQL probe (read-only)');
  console.log(`  host=${host} port=${port} user=${mask(user)} encrypt=${encrypt}`);
  console.log('  password: not printed');

  const open = await tcpOpen(host, port);
  console.log(`  tcp ${host}:${port} ${open ? 'open' : 'closed'}`);
  if (!open) process.exit(2);

  if (!user || !password) {
    console.log('  login skipped — HCL_SQL_USER / HCL_SQL_PASSWORD missing');
    process.exit(0);
  }

  let sql;
  try {
    const require = createRequire(import.meta.url);
    sql = require('mssql');
  } catch {
    console.log('  login skipped — install mssql to run SELECT name FROM sys.databases');
    console.log('  npm install --no-save mssql');
    process.exit(0);
  }

  const pool = await sql.connect({
    server: host,
    port,
    user,
    password,
    options: {
      encrypt,
      trustServerCertificate: true,
      connectTimeout: 10_000,
    },
  });

  try {
    const result = await pool.request().query('SELECT name FROM sys.databases ORDER BY name');
    const names = result.recordset.map((row) => row.name);
    const expected = ['prod2', 'prod3', 'prod4', 'prod6', 'prod7', 'prod8', 'prod9'];
    console.log(`  databases (${names.length}): ${names.join(', ')}`);
    for (const name of expected) {
      console.log(`  ${name}: ${names.includes(name) ? 'present' : 'missing'}`);
    }
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('  probe failed:', err instanceof Error ? err.message : 'unknown error');
  process.exit(1);
});
