import { generateKeyPairSync } from 'crypto';

process.env.NODE_ENV = 'test';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

process.env.PASSPORT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';

export const testPrivateKey = privateKey;
export const testPublicKey = publicKey;
