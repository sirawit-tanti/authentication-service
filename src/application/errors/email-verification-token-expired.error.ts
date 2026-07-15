export class EmailVerificationTokenExpiredError extends Error {
  public constructor() {
    super('Email verification token has expired');

    this.name = 'EmailVerificationTokenExpiredError';

    Error.captureStackTrace(this, new.target);
  }
}
