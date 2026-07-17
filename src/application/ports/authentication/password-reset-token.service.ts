export interface GeneratedPasswordResetToken {
  rawToken: string;
  tokenHash: string;
}

export interface PasswordResetTokenService {
  generate(): GeneratedPasswordResetToken;

  hash(rawToken: string): string;
}
