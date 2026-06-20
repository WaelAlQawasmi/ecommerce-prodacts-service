import { JwtVerifier } from '../../../src/infrastructure/auth/JwtVerifier';
import { testPublicKey } from '../../setup';
import { createTestToken, createAdminToken } from '../../helpers/tokens';
import { UnauthorizedError } from '../../../src/domain/shared/DomainError';

describe('JwtVerifier', () => {
  const verifier = new JwtVerifier(testPublicKey);

  it('should verify a valid RS256 token and extract user claims', () => {
    const token = createTestToken({ id: 10, email: 'jane@example.com', role: ['customer'] });
    const user = verifier.verify(token);

    expect(user.id).toBe(10);
    expect(user.email).toBe('jane@example.com');
    expect(user.roles).toEqual(['customer']);
  });

  it('should reject expired tokens', () => {
    const token = createTestToken({ expired: true });
    expect(() => verifier.verify(token)).toThrow(UnauthorizedError);
  });

  it('should reject tokens with invalid signature', () => {
    const token = createTestToken().slice(0, -5) + 'xxxxx';
    expect(() => verifier.verify(token)).toThrow(UnauthorizedError);
  });

  it('should extract admin role from token', () => {
    const token = createAdminToken();
    const user = verifier.verify(token);
    expect(user.roles).toContain('admin');
  });
});
