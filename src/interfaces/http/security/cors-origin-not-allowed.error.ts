export class CorsOriginNotAllowedError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'CORS_ORIGIN_NOT_ALLOWED';

  public constructor() {
    super('Request origin is not allowed');

    this.name = 'CorsOriginNotAllowedError';

    Error.captureStackTrace(this, new.target);
  }
}
