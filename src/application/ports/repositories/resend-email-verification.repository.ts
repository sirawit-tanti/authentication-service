import type { CreateEmailOutboxMessageInput } from '@/application/outbox/outbox-message.js';

export interface CreateResentVerificationTokenInput {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface ResendEmailVerificationInput {
  normalizedEmail: string;
  requestedAt: Date;
  cooldownSeconds: number;
  verificationToken: CreateResentVerificationTokenInput;
  outboxMessage: CreateEmailOutboxMessageInput;
}

export type ResendEmailVerificationStatus = 'CREATED' | 'IGNORED' | 'COOLDOWN';

export interface ResendEmailVerificationRepository {
  createReplacementVerification(
    input: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationStatus>;
}
