export class EmailAlreadyExistsError extends Error {
  public constructor() {
    super('A user with this email address already exists');

    this.name = 'EmailAlreadyExistsError';

    Error.captureStackTrace(this, new.target);
  }
}
