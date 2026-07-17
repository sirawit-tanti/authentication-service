export class InvalidPasswordResetTokenError extends Error {
  public constructor() {
    super('Password reset token is invalid or has expired');

    this.name = 'InvalidPasswordResetTokenError';

    Error.captureStackTrace(this, new.target);
  }
}
