import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface AccessTokenRevocationRecord {
  jti: string;
  sessionId: string;
  expiresAt: Date;
}

export interface RevokeSessionByRefreshTokenInput extends AuditRequestContext {
  refreshTokenHash: string;
  revokedAt: Date;
  reason: string;
  accessToken?: AccessTokenRevocationRecord;
}

export type RevokeSessionByRefreshTokenResult = 'REVOKED' | 'ALREADY_REVOKED' | 'NOT_FOUND';

export interface LogoutSessionRepository {
  revokeByRefreshToken(
    input: RevokeSessionByRefreshTokenInput,
  ): Promise<RevokeSessionByRefreshTokenResult>;
}
