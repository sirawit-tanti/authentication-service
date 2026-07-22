import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface RotateSessionRefreshTokenInput extends AuditRequestContext {
  currentTokenHash: string;
  newTokenId: string;
  newTokenJti: string;
  newTokenHash: string;
  rotatedAt: Date;
  requestedTokenExpiresAt: Date;
}

export interface RotatedSessionRefreshToken {
  status: 'ROTATED';
  userId: string;
  userEmail: string;
  applicationId: string;
  sessionId: string;
  refreshTokenExpiresAt: Date;
}

export interface InvalidSessionRefreshToken {
  status: 'INVALID';
}

export interface ReusedSessionRefreshToken {
  status: 'REUSE_DETECTED';
}

export type RotateSessionRefreshTokenResult =
  RotatedSessionRefreshToken | InvalidSessionRefreshToken | ReusedSessionRefreshToken;

export interface RefreshSessionRepository {
  rotate(input: RotateSessionRefreshTokenInput): Promise<RotateSessionRefreshTokenResult>;
}
