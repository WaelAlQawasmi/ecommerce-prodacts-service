const fs = require('fs');

if (!fs.existsSync('.env')) {
  console.error('Missing .env — run: make env');
  process.exit(1);
}

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/^PASSPORT_PUBLIC_KEY=(.*)$/m);
const value = match?.[1]?.replace(/^["']|["']$/g, '') ?? '';

if (!value || value.includes('YOUR_RSA_PUBLIC_KEY_HERE')) {
  console.error('Set PASSPORT_PUBLIC_KEY in .env before starting Docker.');
  console.error('Obtain the RSA public key from your Auth Service team.');
  process.exit(1);
}
