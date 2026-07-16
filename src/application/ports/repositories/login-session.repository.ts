import type { User } from '@/domain/users/entities/user.entity.js';

export interface CreateLoginSessionInput {
  user: User;
  expectedUserVersion: number;

  sessionId: string;
  applicationId: string;

  refreshTokenId: string;
  refreshTokenFamilyId: string;
  refreshTokenJti: string;
  refreshTokenHash: string;

  createdAt: Date;
  sessionExpiresAt: Date;
  refreshTokenExpiresAt: Date;

  ipAddress?: string;
  userAgent?: string;
}

export interface LoginSessionRepository {
  create(input: CreateLoginSessionInput): Promise<void>;
}
