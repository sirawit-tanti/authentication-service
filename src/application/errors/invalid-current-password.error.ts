export class InvalidCurrentPasswordError extends Error {
  public constructor() {
    super('Current password is incorrect');

    this.name = 'InvalidCurrentPasswordError';

    Error.captureStackTrace(this, new.target);
  }
}
