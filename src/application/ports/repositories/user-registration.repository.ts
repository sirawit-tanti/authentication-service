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
}

export interface UserRegistrationRepository {
  existsByNormalizedEmail(normalizedEmail: string): Promise<boolean>;

  createRegistration(input: CreateUserRegistrationInput): Promise<void>;
}
