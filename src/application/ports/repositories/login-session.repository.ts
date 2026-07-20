import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import type { User } from '@/domain/users/entities/user.entity.js';

export interface CreateLoginSessionInput extends AuditRequestContext {
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
}

export interface LoginSessionRepository {
  create(input: CreateLoginSessionInput): Promise<void>;
}
