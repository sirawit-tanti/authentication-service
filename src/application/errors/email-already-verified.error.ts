export class EmailAlreadyVerifiedError extends Error {
  public constructor() {
    super('Email address has already been verified');

    this.name = 'EmailAlreadyVerifiedError';

    Error.captureStackTrace(this, new.target);
  }
}
