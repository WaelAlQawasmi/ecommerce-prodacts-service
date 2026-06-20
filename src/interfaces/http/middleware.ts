import { Request, Response, NextFunction } from 'express';
import { DomainError, UnauthorizedError, ForbiddenError, ValidationError } from '../../domain/shared/DomainError';
import { JwtVerifier, AuthenticatedUser } from '../../infrastructure/auth/JwtVerifier';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function createAuthMiddleware(jwtVerifier: JwtVerifier, optional = false) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      if (optional) {
        next();
        return;
      }
      next(new UnauthorizedError('Missing or invalid Authorization header'));
      return;
    }

    try {
      const token = header.slice(7);
      req.user = jwtVerifier.verify(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.roles.includes('admin')) {
    next(new ForbiddenError('Admin role required'));
    return;
  }
  next();
}

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof DomainError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  console.error('Unhandled error:', error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20));
  return { page, limit };
}

export function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export function parseIdParam(value: string | string[]): number {
  const raw = paramId(value);
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('Invalid id parameter');
  }
  return id;
}
