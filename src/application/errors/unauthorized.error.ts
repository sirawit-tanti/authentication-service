export class UnauthorizedError extends Error {
  public constructor() {
    super('Authentication is required');

    this.name = 'UnauthorizedError';

    Error.captureStackTrace(this, new.target);
  }
}
