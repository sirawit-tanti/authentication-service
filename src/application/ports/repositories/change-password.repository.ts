export interface ChangePasswordUserRecord {
  userId: string;
  passwordHash: string;
  version: number;
}

export interface FindUserForPasswordChangeInput {
  userId: string;
}

export interface PersistPasswordChangeInput {
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
