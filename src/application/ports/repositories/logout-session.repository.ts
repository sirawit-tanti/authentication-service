import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface RevokeSessionByRefreshTokenInput extends AuditRequestContext {
  refreshTokenHash: string;
  revokedAt: Date;
  reason: string;
}

export type RevokeSessionByRefreshTokenResult = 'REVOKED' | 'ALREADY_REVOKED' | 'NOT_FOUND';

export interface LogoutSessionRepository {
  revokeByRefreshToken(
    input: RevokeSessionByRefreshTokenInput,
  ): Promise<RevokeSessionByRefreshTokenResult>;
}
