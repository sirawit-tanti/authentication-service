export class PasswordUnchangedError extends Error {
  public constructor() {
    super('New password must be different from the current password');

    this.name = 'PasswordUnchangedError';

    Error.captureStackTrace(this, new.target);
  }
}
