import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';

export interface VerifyEmailInput extends AuditRequestContext {
  tokenHash: string;
  verifiedAt: Date;
}

export interface VerifyEmailResult {
  userId: string;
  email: string;
  status: 'ACTIVE';
}

export interface EmailVerificationRepository {
  verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult>;
}
