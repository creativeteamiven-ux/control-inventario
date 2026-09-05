import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { issueApprovalToken } from '../lib/approvalToken.js';
import {
  getWebAuthnConfig,
  parseTransports,
  saveChallenge,
  takeChallenge,
} from '../lib/webauthn.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
router.use(authenticate);

function validatePin(pin: unknown): string {
  const p = String(pin ?? '').trim();
  if (!/^\d{4,6}$/.test(p)) throw new AppError(400, 'El PIN debe tener entre 4 y 6 dígitos');
  return p;
}

/** Estado de seguridad del usuario actual */
router.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        authPinHash: true,
        _count: { select: { webauthnCredentials: true } },
      },
    });
    if (!user) throw new AppError(404, 'Usuario no encontrado');
    res.json({
      hasPin: !!user.authPinHash,
      webauthnCount: user._count.webauthnCredentials,
      canApproveMovements: !!user.authPinHash || user._count.webauthnCredentials > 0,
    });
  } catch (e) {
    next(e);
  }
});

/** Crear o cambiar PIN (requiere contraseña actual) */
router.post('/pin', async (req: AuthRequest, res, next) => {
  try {
    const pin = validatePin(req.body?.pin);
    const password = String(req.body?.password ?? '');
    if (!password) throw new AppError(400, 'Confirma tu contraseña actual');

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, password: true, authPinHash: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, 'Contraseña incorrecta');
    }

    const authPinHash = await bcrypt.hash(pin, 10);
    await prisma.user.update({ where: { id: user.id }, data: { authPinHash } });
    await writeAudit(req, 'User', user.id, 'UPDATE', { authPin: user.authPinHash ? 'changed' : 'set' });
    res.json({ ok: true, hasPin: true });
  } catch (e) {
    next(e);
  }
});

/** Quitar PIN (requiere contraseña) */
router.delete('/pin', async (req: AuthRequest, res, next) => {
  try {
    const password = String(req.body?.password ?? '');
    if (!password) throw new AppError(400, 'Confirma tu contraseña actual');
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, password: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, 'Contraseña incorrecta');
    }
    await prisma.user.update({ where: { id: user.id }, data: { authPinHash: null } });
    await writeAudit(req, 'User', user.id, 'UPDATE', { authPin: 'removed' });
    res.json({ ok: true, hasPin: false });
  } catch (e) {
    next(e);
  }
});

/** Verificar PIN → token corto para aprobar movimientos */
router.post('/pin/verify', async (req: AuthRequest, res, next) => {
  try {
    const pin = validatePin(req.body?.pin);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, authPinHash: true },
    });
    if (!user?.authPinHash) throw new AppError(400, 'Aún no tienes PIN. Configúralo en Seguridad.');
    if (!(await bcrypt.compare(pin, user.authPinHash))) {
      throw new AppError(401, 'PIN incorrecto');
    }
    const approvalToken = issueApprovalToken(user.id, 'pin');
    res.json({ ok: true, approvalToken, method: 'pin', expiresIn: 180 });
  } catch (e) {
    next(e);
  }
});

/** Opciones para registrar passkey / Face ID */
router.post('/webauthn/register/options', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        webauthnCredentials: { select: { id: true, transports: true } },
      },
    });
    if (!user) throw new AppError(404, 'Usuario no encontrado');
    const { rpID, rpName } = getWebAuthnConfig();

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: user.webauthnCredentials.map((c) => ({
        id: c.id,
        transports: parseTransports(c.transports),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    });

    saveChallenge(`reg:${user.id}`, options.challenge, user.id);
    res.json(options);
  } catch (e) {
    next(e);
  }
});

/** Verificar registro de passkey */
router.post('/webauthn/register/verify', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const expectedChallenge = takeChallenge(`reg:${userId}`, userId);
    if (!expectedChallenge) throw new AppError(400, 'Desafío expirado. Intenta de nuevo.');

    const { rpID, origin } = getWebAuthnConfig();
    const body = req.body as RegistrationResponseJSON;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new AppError(400, 'No se pudo registrar la biometría del dispositivo');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const id = credential.id;
    const publicKey = Buffer.from(credential.publicKey).toString('base64');

    await prisma.webAuthnCredential.upsert({
      where: { id },
      create: {
        id,
        userId,
        publicKey,
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ? JSON.stringify(credential.transports) : null,
      },
      update: {
        publicKey,
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ? JSON.stringify(credential.transports) : null,
      },
    });

    await writeAudit(req, 'User', userId, 'UPDATE', { webauthn: 'registered' });
    const count = await prisma.webAuthnCredential.count({ where: { userId } });
    res.json({ ok: true, webauthnCount: count });
  } catch (e) {
    next(e);
  }
});

/** Opciones para autenticar con passkey (autorizar movimiento) */
router.post('/webauthn/auth/options', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const creds = await prisma.webAuthnCredential.findMany({ where: { userId } });
    if (!creds.length) throw new AppError(400, 'No tienes biometría registrada. Configúrala en Seguridad.');

    const { rpID } = getWebAuthnConfig();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: creds.map((c) => ({
        id: c.id,
        transports: parseTransports(c.transports),
      })),
    });

    saveChallenge(`auth:${userId}`, options.challenge, userId);
    res.json(options);
  } catch (e) {
    next(e);
  }
});

/** Verificar biometría → token de aprobación */
router.post('/webauthn/auth/verify', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const expectedChallenge = takeChallenge(`auth:${userId}`, userId);
    if (!expectedChallenge) throw new AppError(400, 'Desafío expirado. Intenta de nuevo.');

    const body = req.body as AuthenticationResponseJSON;
    const cred = await prisma.webAuthnCredential.findFirst({
      where: { id: body.id, userId },
    });
    if (!cred) throw new AppError(400, 'Credencial no encontrada');

    const { rpID, origin } = getWebAuthnConfig();
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64')),
        counter: Number(cred.counter),
        transports: parseTransports(cred.transports),
      },
    });

    if (!verification.verified) throw new AppError(401, 'Biometría no verificada');

    await prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    const approvalToken = issueApprovalToken(userId, 'webauthn');
    res.json({ ok: true, approvalToken, method: 'webauthn', expiresIn: 180 });
  } catch (e) {
    next(e);
  }
});

/** Eliminar todas las passkeys del usuario */
router.delete('/webauthn', async (req: AuthRequest, res, next) => {
  try {
    const password = String(req.body?.password ?? '');
    if (!password) throw new AppError(400, 'Confirma tu contraseña actual');
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, password: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, 'Contraseña incorrecta');
    }
    await prisma.webAuthnCredential.deleteMany({ where: { userId: user.id } });
    await writeAudit(req, 'User', user.id, 'UPDATE', { webauthn: 'cleared' });
    res.json({ ok: true, webauthnCount: 0 });
  } catch (e) {
    next(e);
  }
});

export default router;
