import type { CreateEmailOutboxMessageInput } from '@/application/outbox/outbox-message.js';

export interface ForgotPasswordUserRecord {
  userId: string;
  email: string;
}

export interface CreatePasswordResetRequestInput {
  userId: string;
  resetToken: {
    id: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  };
  outboxMessage: CreateEmailOutboxMessageInput<'send-password-reset'>;
  invalidatedAt: Date;
}

export interface ForgotPasswordRepository {
  findActiveUserByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<ForgotPasswordUserRecord | null>;

  createPasswordResetRequest(input: CreatePasswordResetRequestInput): Promise<void>;
}
