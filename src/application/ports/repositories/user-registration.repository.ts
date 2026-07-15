import type { CreateEmailOutboxMessageInput } from '@/application/outbox/outbox-message.js';
import type { User } from '@/domain/users/entities/user.entity.js';

export interface EmailVerificationTokenData {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateUserRegistrationInput {
  user: User;
  verificationToken: EmailVerificationTokenData;
  outboxMessage: CreateEmailOutboxMessageInput;
}

export interface UserRegistrationRepository {
  existsByNormalizedEmail(normalizedEmail: string): Promise<boolean>;

  createRegistration(input: CreateUserRegistrationInput): Promise<void>;
}
