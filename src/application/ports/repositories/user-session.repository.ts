import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface UserSessionRecord {
  sessionId: string;
  applicationId: string;
  deviceId: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  createdAt: Date;
}

export interface RevokeUserSessionInput extends AuditRequestContext {
  userId: string;
  applicationId: string;
  sessionId: string;
  revokedAt: Date;
  reason: string;
}

export interface RevokeOtherUserSessionsInput extends AuditRequestContext {
  userId: string;
  applicationId: string;
  currentSessionId: string;
  revokedAt: Date;
  reason: string;
}

export interface RevokeOtherUserSessionsResult {
  revokedCount: number;
}

export type RevokeUserSessionResult = 'REVOKED' | 'ALREADY_REVOKED' | 'NOT_FOUND';

export interface UserSessionRepository {
  findByUserId(userId: string): Promise<UserSessionRecord[]>;

  revoke(input: RevokeUserSessionInput): Promise<RevokeUserSessionResult>;

  revokeOthers(input: RevokeOtherUserSessionsInput): Promise<RevokeOtherUserSessionsResult>;
}
