export class InvalidCredentialsError extends Error {
  public constructor() {
    super('Email or password is incorrect');

    this.name = 'InvalidCredentailsError';

    Error.captureStackTrace(this, new.target);
  }
}
