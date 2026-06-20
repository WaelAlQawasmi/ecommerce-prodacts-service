import jwt from 'jsonwebtoken';
import { testPrivateKey } from '../setup';

export interface TestTokenOptions {
  id?: number;
  email?: string;
  name?: string;
  role?: string[];
  expired?: boolean;
}

export function createTestToken(options: TestTokenOptions = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: '019ee22d-a876-7000-840d-264ec27292e1',
    jti: 'test-jti',
    iat: now,
    nbf: now,
    exp: options.expired ? now - 3600 : now + 86400,
    sub: String(options.id ?? 1),
    scopes: [],
    id: options.id ?? 1,
    name: options.name ?? 'Test User',
    email: options.email ?? 'test@example.com',
    role: options.role ?? ['customer'],
  };

  return jwt.sign(payload, testPrivateKey, { algorithm: 'RS256' });
}

export function createAdminToken(): string {
  return createTestToken({ id: 99, email: 'admin@example.com', role: ['admin'] });
}
