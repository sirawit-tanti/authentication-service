export class InvalidRefreshTokenError extends Error {
  public constructor() {
    super('Refresh token is invalid');

    this.name = 'InvalidRefreshTokenError';

    Error.captureStackTrace(this, new.target);
  }
}
