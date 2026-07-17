export class PasswordChangeConflictError extends Error {
  public constructor() {
    super('Password was changed by another request');

    this.name = 'PasswordChangeConflictError';

    Error.captureStackTrace(this, new.target);
  }
}
