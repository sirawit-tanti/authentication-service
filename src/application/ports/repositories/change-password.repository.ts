import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface ChangePasswordUserRecord {
  userId: string;
  passwordHash: string;
  version: number;
}

export interface FindUserForPasswordChangeInput {
  userId: string;
}

export interface PersistPasswordChangeInput extends AuditRequestContext {
  userId: string;
  expectedVersion: number;
  newPasswordHash: string;
  passwordChangedAt: Date;
  currentSessionId: string;
  revokeReason: string;
}

export type PersistPasswordChangeResult = 'UPDATED' | 'CONFLICT' | 'NOT_FOUND';

export interface ChangePasswordRepository {
  findUser(input: FindUserForPasswordChangeInput): Promise<ChangePasswordUserRecord | null>;

  persist(input: PersistPasswordChangeInput): Promise<PersistPasswordChangeResult>;
}
