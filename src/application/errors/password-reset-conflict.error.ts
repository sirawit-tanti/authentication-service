export class PasswordResetConflictError extends Error {
  public constructor() {
    super('Password reset could not be completed because the account changed');

    this.name = 'PasswordResetConflictError';

    Error.captureStackTrace(this, new.target);
  }
}
