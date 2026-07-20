import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface FindPasswordResetRequestInput {
  tokenHash: string;
  checkedAt: Date;
}

export interface PasswordResetRequestRecord {
  tokenId: string;
  userId: string;
  passwordHash: string;
  userVersion: number;
}

export interface ConsumePasswordResetInput extends AuditRequestContext {
  tokenId: string;
  tokenHash: string;
  userId: string;
  expectedUserVersion: number;
  newPasswordHash: string;
  passwordChangedAt: Date;
  revokeReason: string;
}

export type ConsumePasswordResetResult = 'UPDATED' | 'INVALID_TOKEN' | 'CONFLICT';

export interface ResetPasswordRepository {
  findActiveRequest(
    input: FindPasswordResetRequestInput,
  ): Promise<PasswordResetRequestRecord | null>;

  consume(input: ConsumePasswordResetInput): Promise<ConsumePasswordResetResult>;
}
