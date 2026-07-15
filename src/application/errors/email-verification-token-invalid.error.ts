export class EmailVerificationTokenInvalidError extends Error {
  public constructor() {
    super('Email verification token is invalid');

    this.name = 'EmailVerificationTokenInvalidError';

    Error.captureStackTrace(this, new.target);
  }
}
