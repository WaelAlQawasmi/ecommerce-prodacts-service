const fs = require('fs');

const PLACEHOLDER = 'YOUR_RSA_PUBLIC_KEY_HERE';

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'ELASTICSEARCH_NODE',
  'PASSPORT_PUBLIC_KEY',
];

if (!fs.existsSync('.env')) {
  console.error('Missing .env — copy .env.example and set production values.');
  process.exit(1);
}

const env = fs.readFileSync('.env', 'utf8');
const vars = {};

for (const line of env.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  vars[key] = value;
}

let failed = false;

for (const key of required) {
  const value = vars[key];
  if (!value) {
    console.error(`Missing required variable: ${key}`);
    failed = true;
    continue;
  }
  if (key === 'PASSPORT_PUBLIC_KEY' && value.includes(PLACEHOLDER)) {
    console.error('PASSPORT_PUBLIC_KEY still contains the placeholder — set your Auth Service RSA public key.');
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

if (vars.NODE_ENV !== 'production') {
  console.warn('Warning: NODE_ENV is not "production" in .env — the start script will export NODE_ENV=production.');
}

console.log('Production environment check passed.');
