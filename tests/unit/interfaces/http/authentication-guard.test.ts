import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import type {
  AccessTokenService,
  CreateAccessTokenInput,
  VerifyAccessTokenInput,
  VerifyAccessTokenResult,
} from '@/application/ports/authentication/access-token-service.js';
import type {
  AccessSessionRepository,
  ValidateAccessSessionInput,
  ValidAccessSession,
} from '@/application/ports/repositories/access-session.repository.js';
import type {
  AccessTokenBlacklistRepository,
  BlacklistAccessTokenInput,
  CheckAccessTokenBlacklistInput,
} from '@/application/ports/repositories/access-token-blacklist.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import { createAuthenticationGuard } from '@/interfaces/http/authentication/authentication-guard.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const JTI = '91399467-9823-47d1-b483-786630fcf0fa';

const CHECKED_AT = new Date('2026-07-22T08:00:00.000Z');

class FakeAccessTokenService implements AccessTokenService {
  public verifyInput: VerifyAccessTokenInput | null = null;

  public result: VerifyAccessTokenResult = {
    jti: JTI,
    userId: USER_ID,
    sessionId: SESSION_ID,
    applicationId: APPLICATION_ID,
    email: 'sirawit@example.com',
    issuedAt: new Date('2026-07-22T07:55:00.000Z'),
    expiresAt: new Date('2026-07-22T08:10:00.000Z'),
  };

  public create(input: CreateAccessTokenInput): Promise<string> {
    void input;

    return Promise.reject(new Error('Not implemented in this test'));
  }

  public verify(input: VerifyAccessTokenInput): Promise<VerifyAccessTokenResult> {
    this.verifyInput = input;

    return Promise.resolve(this.result);
  }
}

class FakeAccessSessionRepository implements AccessSessionRepository {
  public input: ValidateAccessSessionInput | null = null;

  public result: ValidAccessSession | null = {
    userId: USER_ID,
    email: 'sirawit@example.com',
    applicationId: APPLICATION_ID,
    sessionId: SESSION_ID,
  };

  public findActive(input: ValidateAccessSessionInput): Promise<ValidAccessSession | null> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

class FakeAccessTokenBlacklistRepository implements AccessTokenBlacklistRepository {
  public checkInput: CheckAccessTokenBlacklistInput | null = null;

  public blacklisted = false;

  public isBlacklisted(input: CheckAccessTokenBlacklistInput): Promise<boolean> {
    this.checkInput = input;

    return Promise.resolve(this.blacklisted);
  }

  public blacklist(input: BlacklistAccessTokenInput): Promise<void> {
    void input;

    return Promise.resolve();
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return CHECKED_AT;
  }
}

function createRequest(): FastifyRequest {
  return {
    headers: {
      authorization: 'Bearer access-token',
    },

    authenticatedPrincipal: null,
  } as unknown as FastifyRequest;
}

function createReply(): {
  reply: FastifyReply;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn().mockResolvedValue(undefined);

  const status = vi.fn().mockReturnValue({
    send,
  });

  return {
    reply: {
      status,
    } as unknown as FastifyReply,

    status,
    send,
  };
}

describe('createAuthenticationGuard', () => {
  it('authenticates an active non-blacklisted access token', async () => {
    const accessTokenService = new FakeAccessTokenService();

    const accessSessionRepository = new FakeAccessSessionRepository();

    const accessTokenBlacklistRepository = new FakeAccessTokenBlacklistRepository();

    const guard = createAuthenticationGuard({
      accessTokenService,
      accessSessionRepository,
      accessTokenBlacklistRepository,
      clock: new FixedClock(),
    });

    const request = createRequest();

    const replyContext = createReply();

    await guard(request, replyContext.reply);

    expect(accessTokenBlacklistRepository.checkInput).toEqual({
      jti: JTI,
      checkedAt: CHECKED_AT,
    });

    expect(accessSessionRepository.input).toEqual({
      sessionId: SESSION_ID,
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      checkedAt: CHECKED_AT,
    });

    expect(request.authenticatedPrincipal).toEqual({
      userId: USER_ID,
      email: 'sirawit@example.com',
      applicationId: APPLICATION_ID,
      sessionId: SESSION_ID,
    });

    expect(replyContext.status).not.toHaveBeenCalled();
  });

  it('rejects a blacklisted access token before checking the session', async () => {
    const accessSessionRepository = new FakeAccessSessionRepository();

    const accessTokenBlacklistRepository = new FakeAccessTokenBlacklistRepository();

    accessTokenBlacklistRepository.blacklisted = true;

    const guard = createAuthenticationGuard({
      accessTokenService: new FakeAccessTokenService(),
      accessSessionRepository,
      accessTokenBlacklistRepository,
      clock: new FixedClock(),
    });

    const request = createRequest();

    const replyContext = createReply();

    await guard(request, replyContext.reply);

    expect(replyContext.status).toHaveBeenCalledWith(401);

    expect(replyContext.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required',
      },
    });

    expect(accessSessionRepository.input).toBeNull();

    expect(request.authenticatedPrincipal).toBeNull();
  });

  it('rejects a token whose session is no longer active', async () => {
    const accessSessionRepository = new FakeAccessSessionRepository();

    accessSessionRepository.result = null;

    const guard = createAuthenticationGuard({
      accessTokenService: new FakeAccessTokenService(),
      accessSessionRepository,
      accessTokenBlacklistRepository: new FakeAccessTokenBlacklistRepository(),
      clock: new FixedClock(),
    });

    const request = createRequest();

    const replyContext = createReply();

    await guard(request, replyContext.reply);

    expect(replyContext.status).toHaveBeenCalledWith(401);

    expect(request.authenticatedPrincipal).toBeNull();
  });
});
