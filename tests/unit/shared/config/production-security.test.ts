import {
  collectProductionSecurityIssues,
  type ProductionSecurityEnvironment,
} from '@/shared/config/production-security.js';

const SECURE_PRODUCTION_SECRET = '1ea0af16e9894e31b22eb8a09aa4b855c13e8e5e738f44caa2e38bbf36ac5304';

function createSecureProductionEnvironment(
  overrides: Partial<ProductionSecurityEnvironment> = {},
): ProductionSecurityEnvironment {
  return {
    NODE_ENV: 'production',

    JWT_ACCESS_TOKEN_SECRET: SECURE_PRODUCTION_SECRET,

    EMAIL_VERIFICATION_BASE_URL: 'https://auth.example.com/verify-email',

    CORS_ALLOWED_ORIGINS: 'https://app.example.com',

    CORS_ALLOW_CREDENTIALS: false,

    ...overrides,
  };
}

describe('collectProductionSecurityIssues', () => {
  it('accepts a secure production configuration', () => {
    const issues = collectProductionSecurityIssues(createSecureProductionEnvironment());

    expect(issues).toEqual([]);
  });

  it('rejects a development JWT secret in production', () => {
    const issues = collectProductionSecurityIssues(
      createSecureProductionEnvironment({
        JWT_ACCESS_TOKEN_SECRET: 'development-only-change-this-secret',
      }),
    );

    expect(issues).toContainEqual({
      field: 'JWT_ACCESS_TOKEN_SECRET',

      message: 'JWT access token secret must not use a development or example value in production',
    });
  });

  it('rejects a localhost email verification URL in production', () => {
    const issues = collectProductionSecurityIssues(
      createSecureProductionEnvironment({
        EMAIL_VERIFICATION_BASE_URL: 'http://localhost:3000/verify-email',
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        {
          field: 'EMAIL_VERIFICATION_BASE_URL',

          message: 'Email verification URL must use HTTPS in production',
        },

        {
          field: 'EMAIL_VERIFICATION_BASE_URL',

          message: 'Email verification URL must not use a local hostname in production',
        },
      ]),
    );
  });

  it('rejects an HTTP email verification URL in production', () => {
    const issues = collectProductionSecurityIssues(
      createSecureProductionEnvironment({
        EMAIL_VERIFICATION_BASE_URL: 'http://auth.example.com/verify-email',
      }),
    );

    expect(issues).toContainEqual({
      field: 'EMAIL_VERIFICATION_BASE_URL',

      message: 'Email verification URL must use HTTPS in production',
    });
  });

  it('rejects wildcard CORS in production', () => {
    const issues = collectProductionSecurityIssues(
      createSecureProductionEnvironment({
        CORS_ALLOWED_ORIGINS: '*',
      }),
    );

    expect(issues).toContainEqual({
      field: 'CORS_ALLOWED_ORIGINS',

      message: 'Wildcard CORS origin is not allowed in production',
    });
  });

  it('rejects wildcard CORS when credentials are enabled', () => {
    const issues = collectProductionSecurityIssues({
      NODE_ENV: 'development',

      JWT_ACCESS_TOKEN_SECRET: 'development-only-change-this-secret',

      EMAIL_VERIFICATION_BASE_URL: 'http://localhost:3000/verify-email',

      CORS_ALLOWED_ORIGINS: '*',

      CORS_ALLOW_CREDENTIALS: true,
    });

    expect(issues).toContainEqual({
      field: 'CORS_ALLOWED_ORIGINS',

      message: 'Wildcard CORS origin cannot be used when credentials are enabled',
    });
  });

  it('rejects an HTTP CORS origin in production', () => {
    const issues = collectProductionSecurityIssues(
      createSecureProductionEnvironment({
        CORS_ALLOWED_ORIGINS: 'http://app.example.com',
      }),
    );

    expect(issues).toContainEqual({
      field: 'CORS_ALLOWED_ORIGINS',

      message: 'CORS origin "http://app.example.com" must use HTTPS in production',
    });
  });

  it('rejects CORS origins containing paths', () => {
    const issues = collectProductionSecurityIssues(
      createSecureProductionEnvironment({
        CORS_ALLOWED_ORIGINS: 'https://app.example.com/dashboard',
      }),
    );

    expect(issues).toContainEqual({
      field: 'CORS_ALLOWED_ORIGINS',

      message:
        'CORS origin "https://app.example.com/dashboard" must not contain a path, query, or fragment',
    });
  });

  it('accepts multiple secure production origins', () => {
    const issues = collectProductionSecurityIssues(
      createSecureProductionEnvironment({
        CORS_ALLOWED_ORIGINS: 'https://app.example.com, https://admin.example.com',
      }),
    );

    expect(issues).toEqual([]);
  });

  it('allows local HTTP URLs during development', () => {
    const issues = collectProductionSecurityIssues({
      NODE_ENV: 'development',

      JWT_ACCESS_TOKEN_SECRET: 'development-only-change-this-secret',

      EMAIL_VERIFICATION_BASE_URL: 'http://localhost:3000/verify-email',

      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',

      CORS_ALLOW_CREDENTIALS: false,
    });

    expect(issues).toEqual([]);
  });
});
