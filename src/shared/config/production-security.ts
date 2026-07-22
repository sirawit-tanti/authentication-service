export interface ProductionSecurityEnvironment {
  NODE_ENV: 'development' | 'test' | 'production';

  JWT_ACCESS_TOKEN_SECRET: string;

  EMAIL_VERIFICATION_BASE_URL: string;

  CORS_ALLOWED_ORIGINS: string;

  CORS_ALLOW_CREDENTIALS: boolean;
}

export interface ProductionSecurityIssue {
  field: keyof ProductionSecurityEnvironment;

  message: string;
}

const DEVELOPMENT_SECRET_FRAGMENTS = [
  'change-this',
  'development-only',
  'example-secret',
  'default-secret',
  'replace-me',
  'your-secret',
] as const;

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin): string => origin.trim())
    .filter((origin): boolean => origin.length > 0);
}

function isDevelopmentSecret(secret: string): boolean {
  const normalizedSecret = secret.toLowerCase();

  return DEVELOPMENT_SECRET_FRAGMENTS.some((fragment): boolean =>
    normalizedSecret.includes(fragment),
  );
}

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

function validateCorsConfiguration(
  environment: ProductionSecurityEnvironment,
  issues: ProductionSecurityIssue[],
): void {
  const origins = parseOrigins(environment.CORS_ALLOWED_ORIGINS);

  if (origins.length === 0) {
    issues.push({
      field: 'CORS_ALLOWED_ORIGINS',

      message: 'At least one CORS origin must be configured',
    });

    return;
  }

  if (environment.CORS_ALLOW_CREDENTIALS && origins.includes('*')) {
    issues.push({
      field: 'CORS_ALLOWED_ORIGINS',

      message: 'Wildcard CORS origin cannot be used when credentials are enabled',
    });
  }

  if (environment.NODE_ENV !== 'production') {
    return;
  }

  if (origins.includes('*')) {
    issues.push({
      field: 'CORS_ALLOWED_ORIGINS',

      message: 'Wildcard CORS origin is not allowed in production',
    });
  }

  for (const origin of origins) {
    if (origin === '*') {
      continue;
    }

    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      issues.push({
        field: 'CORS_ALLOWED_ORIGINS',

        message: `CORS origin "${origin}" is not a valid URL`,
      });

      continue;
    }

    if (parsedOrigin.origin !== origin) {
      issues.push({
        field: 'CORS_ALLOWED_ORIGINS',

        message: `CORS origin "${origin}" must not contain a path, query, or fragment`,
      });
    }

    if (parsedOrigin.protocol !== 'https:') {
      issues.push({
        field: 'CORS_ALLOWED_ORIGINS',

        message: `CORS origin "${origin}" must use HTTPS in production`,
      });
    }

    if (isLocalHostname(parsedOrigin.hostname)) {
      issues.push({
        field: 'CORS_ALLOWED_ORIGINS',

        message: `CORS origin "${origin}" must not use a local hostname in production`,
      });
    }
  }
}

function validateProductionJwtSecret(
  environment: ProductionSecurityEnvironment,
  issues: ProductionSecurityIssue[],
): void {
  if (environment.NODE_ENV !== 'production') {
    return;
  }

  if (isDevelopmentSecret(environment.JWT_ACCESS_TOKEN_SECRET)) {
    issues.push({
      field: 'JWT_ACCESS_TOKEN_SECRET',

      message: 'JWT access token secret must not use a development or example value in production',
    });
  }
}

function validateEmailVerificationUrl(
  environment: ProductionSecurityEnvironment,
  issues: ProductionSecurityIssue[],
): void {
  if (environment.NODE_ENV !== 'production') {
    return;
  }

  let verificationUrl: URL;

  try {
    verificationUrl = new URL(environment.EMAIL_VERIFICATION_BASE_URL);
  } catch {
    issues.push({
      field: 'EMAIL_VERIFICATION_BASE_URL',

      message: 'Email verification URL must be a valid URL',
    });

    return;
  }

  if (verificationUrl.protocol !== 'https:') {
    issues.push({
      field: 'EMAIL_VERIFICATION_BASE_URL',

      message: 'Email verification URL must use HTTPS in production',
    });
  }

  if (isLocalHostname(verificationUrl.hostname)) {
    issues.push({
      field: 'EMAIL_VERIFICATION_BASE_URL',

      message: 'Email verification URL must not use a local hostname in production',
    });
  }
}

export function collectProductionSecurityIssues(
  environment: ProductionSecurityEnvironment,
): ProductionSecurityIssue[] {
  const issues: ProductionSecurityIssue[] = [];

  validateCorsConfiguration(environment, issues);

  validateProductionJwtSecret(environment, issues);

  validateEmailVerificationUrl(environment, issues);

  return issues;
}
