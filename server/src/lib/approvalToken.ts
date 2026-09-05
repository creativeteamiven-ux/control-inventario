import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler.js';

const JWT_SECRET = process.env.JWT_SECRET || 'soundvault-secret-change-in-production';
const PURPOSE = 'movement_approve';

export type ApprovalMethod = 'pin' | 'webauthn';

export function issueApprovalToken(userId: string, method: ApprovalMethod): string {
  return jwt.sign({ userId, purpose: PURPOSE, method }, JWT_SECRET, { expiresIn: '3m' });
}

export function assertApprovalToken(token: unknown, expectedUserId: string): ApprovalMethod {
  if (!token || typeof token !== 'string') {
    throw new AppError(401, 'Debes confirmar con PIN o biometría antes de autorizar');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
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
