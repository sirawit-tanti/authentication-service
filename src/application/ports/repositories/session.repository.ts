export interface CreateSessionInput {
  sessionId: string;
  userId: string;
  refreshTokenId: string;
  refreshTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface StoredRefreshToken {
  id: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  userStatuis: string;
  userEmailVerified: boolean;
  tokenHash: string;
  tokenExpiresAt: Date;
  tokenUsedAt: Date | null;
  tokenRevokedAt: Date | null;
  replacedByTokenId: string | null;
  sessionExpiresAt: Date;
  sessionRevokedAt: Date | null;
}

export interface RotateRefreshTokenInput {
  currentTokenId: string;
  newTokenId: string;
  newTokenHash: string;
  rotatedAt: Date;
  newExpiresAt: Date;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<void>;

  findRefreshTokenByHash(tokenHash: string): Promise<StoredRefreshToken | null>;

  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<boolean>;

  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;

  revokeAllUserSessions(userId: string, revokedAt: Date): Promise<void>;
}
