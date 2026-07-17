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

export interface RevokeUserSessionInput {
  userId: string;
  sessionId: string;
  revokedAt: Date;
  reason: string;
}

export type RevokeUserSessionResult = 'REVOKED' | 'ALREADY_REVOKED' | 'NOT_FOUND';

export interface UserSessionRepository {
  findByUserId(userId: string): Promise<UserSessionRecord[]>;

  revoke(input: RevokeUserSessionInput): Promise<RevokeUserSessionResult>;
}
