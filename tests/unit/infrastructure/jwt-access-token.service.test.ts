import { describe, expect, it } from 'vitest';

import {
  InvalidAccessTokenError,
  JwtAccessTokenService,
} from '../../../src/infrastructure/authentication/jwt-access-token.service.js';

const TEST_JWT_SECRET = 'unit-test-only-jwt-secret-with-more-than-32-characters';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const ISSUED_AT = new Date('2026-07-16T00:00:00.000Z');

const VERIFIED_AT = new Date('2026-07-16T00:05:00.000Z');

function createService(
  options: {
    secret?: string;
    issuer?: string;
    audience?: string;
  } = {},
): JwtAccessTokenService {
  return new JwtAccessTokenService({
    secret: options.secret ?? TEST_JWT_SECRET,
    issuer: options.issuer ?? 'authentication-service-test',
    audience: options.audience ?? 'test-applications',
    timeToLiveMinutes: 15,
  });
}

async function createToken(service: JwtAccessTokenService): Promise<string> {
  return service.create({
    claims: {
      userId: USER_ID,
      sessionId: SESSION_ID,
      applicationId: APPLICATION_ID,
      email: 'sirawit@example.com',
    },
    issuedAt: ISSUED_AT,
  });
}

describe('JwtAccessTokenService', () => {
  it('creates and verifies an access token', async () => {
    const service = createService();
    const token = await createToken(service);

    const result = await service.verify({
      token,
      verifiedAt: VERIFIED_AT,
    });

    expect(result).toEqual({
      userId: USER_ID,
      sessionId: SESSION_ID,
      applicationId: APPLICATION_ID,
      email: 'sirawit@example.com',
      issuedAt: ISSUED_AT,
      expiresAt: new Date('2026-07-16T00:15:00.000Z'),
    });
  });

  it('rejects an expired access token', async () => {
    const service = createService();
    const token = await createToken(service);

    await expect(
      service.verify({
        token,
        verifiedAt: new Date('2026-07-16T00:16:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects a token signed with another secret', async () => {
    const issuerService = createService({
      secret: 'another-unit-test-secret-with-at-least-32-characters',
    });

    const verifierService = createService();
    const token = await createToken(issuerService);

    await expect(
      verifierService.verify({
        token,
        verifiedAt: VERIFIED_AT,
      }),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects a token with another audience', async () => {
    const issuerService = createService({
      audience: 'application-a',
    });

    const verifierService = createService({
      audience: 'application-b',
    });

    const token = await createToken(issuerService);

    await expect(
      verifierService.verify({
        token,
        verifiedAt: VERIFIED_AT,
      }),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
