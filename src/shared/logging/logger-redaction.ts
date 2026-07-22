export interface LoggerRedactionConfiguration {
  paths: string[];
  censor: string;
}

const SENSITIVE_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'request.headers.authorization',
  'request.headers.cookie',

  'req.body.password',
  'request.body.password',

  'req.body.currentPassword',
  'request.body.currentPassword',

  'req.body.newPassword',
  'request.body.newPassword',

  'req.body.refreshToken',
  'request.body.refreshToken',

  'req.body.token',
  'request.body.token',

  'req.body.verificationToken',
  'request.body.verificationToken',

  'req.body.resetToken',
  'request.body.resetToken',

  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',

  'token',
  'tokenHash',

  'verificationToken',
  'resetToken',

  'accessToken',
  'refreshToken',

  'clientSecret',
  'clientSecretHash',

  'apiKey',
  'keyHash',
] as const;

export function createLoggerRedactionConfiguration(): LoggerRedactionConfiguration {
  return {
    paths: [...SENSITIVE_LOG_PATHS],
    censor: '[REDACTED]',
  };
}
