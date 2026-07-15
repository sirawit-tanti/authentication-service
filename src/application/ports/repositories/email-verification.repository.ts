export interface VerifyEmailInput {
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
