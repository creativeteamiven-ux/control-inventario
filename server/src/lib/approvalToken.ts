import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler.js';
import { APPROVAL_SECRET, JWT_ALGORITHMS } from './secrets.js';

const PURPOSE = 'movement_approve';

export type ApprovalMethod = 'pin' | 'webauthn';

export function issueApprovalToken(userId: string, method: ApprovalMethod): string {
  return jwt.sign({ userId, purpose: PURPOSE, method }, APPROVAL_SECRET, {
    expiresIn: '3m',
    algorithm: 'HS256',
  });
}

/** Igual que assertApprovalToken pero devuelve null en lugar de lanzar. */
export function readApprovalToken(token: unknown, expectedUserId: string): ApprovalMethod | null {
  try {
    return assertApprovalToken(token, expectedUserId);
  } catch {
    return null;
  }
}

export function assertApprovalToken(token: unknown, expectedUserId: string): ApprovalMethod {
  if (!token || typeof token !== 'string') {
    throw new AppError(401, 'Debes confirmar con PIN o biometría antes de autorizar');
  }
  try {
    const decoded = jwt.verify(token, APPROVAL_SECRET, {
      algorithms: [...JWT_ALGORITHMS],
    }) as {
      userId?: string;
      purpose?: string;
      method?: ApprovalMethod;
    };
    if (decoded.purpose !== PURPOSE || decoded.userId !== expectedUserId) {
      throw new AppError(401, 'Token de autorización inválido');
    }
    return decoded.method === 'webauthn' ? 'webauthn' : 'pin';
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(401, 'La confirmación expiró. Vuelve a autenticarte con PIN o biometría.');
  }
}
