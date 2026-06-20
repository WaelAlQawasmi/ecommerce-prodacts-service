import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../domain/shared/DomainError';

export interface JwtPayload {
  aud?: string;
  jti?: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  sub?: string;
  scopes?: string[];
  id: number;
  name?: string;
  email?: string;
  role: string[];
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name?: string;
  roles: string[];
  jti?: string;
}

export class JwtVerifier {
  constructor(private readonly publicKey: string) {}

  verify(token: string): AuthenticatedUser {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as JwtPayload;

      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp !== undefined && decoded.exp <= now) {
        throw new UnauthorizedError('Token expired');
      }
      if (decoded.nbf !== undefined && decoded.nbf > now) {
        throw new UnauthorizedError('Token not yet active');
      }

      if (!decoded.id || !decoded.email) {
        throw new UnauthorizedError('Invalid token payload');
      }

      return {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        roles: Array.isArray(decoded.role) ? decoded.role : [],
        jti: decoded.jti,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}

export function hasRole(user: AuthenticatedUser, role: string): boolean {
  return user.roles.includes(role);
}

export function requireAdmin(user: AuthenticatedUser): void {
  if (!hasRole(user, 'admin')) {
    throw new UnauthorizedError('Admin role required');
  }
}
