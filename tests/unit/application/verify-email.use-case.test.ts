import type { SecureTokenService } from '../../../src/application/ports/crypto/secure-token-service.js';
import type {
  EmailVerificationRepository,
  VerifyEmailInput,
  VerifyEmailResult,
} from '../../../src/application/ports/repositories/email-verification.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { VerifyEmailUseCase } from '../../../src/application/use-cases/authentication/verify-email.use-case.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const FIXED_NOW = new Date('2026-07-20T00:00:00.000Z');

const REQUEST_ID = 'verify-email-request-id';

class FakeEmailVerificationRepository implements EmailVerificationRepository {
  public input: VerifyEmailInput | null = null;

  public result: VerifyEmailResult = {
    userId: USER_ID,

    email: 'sirawit@example.com',

    status: 'ACTIVE',
  };

  public verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

class FakeSecureTokenService implements SecureTokenService {
  public generate(): string {
    return 'generated-verification-token';
  }

  public hash(token: string): string {
    return `hashed:${token}`;
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

interface TestContext {
  repository: FakeEmailVerificationRepository;

  useCase: VerifyEmailUseCase;
}

function createTestContext(): TestContext {
  const repository = new FakeEmailVerificationRepository();

  const useCase = new VerifyEmailUseCase({
    emailVerificationRepository: repository,

    secureTokenService: new FakeSecureTokenService(),

    clock: new FixedClock(),
  });

  return {
    repository,
    useCase,
  };
}

describe('VerifyEmailUseCase', () => {
  it('hashes the token and verifies the email with audit request context', async () => {
    const context = createTestContext();

    const result = await context.useCase.execute({
      token: ' raw-verification-token ',

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: 'Vitest',
    });

    expect(result).toEqual({
      userId: USER_ID,

      email: 'sirawit@example.com',

      status: 'ACTIVE',
    });

    expect(context.repository.input).toEqual({
      tokenHash: 'hashed:raw-verification-token',

      verifiedAt: FIXED_NOW,

      requestId: REQUEST_ID,

      ipAddress: '127.0.0.1',

      userAgent: 'Vitest',
    });
  });

  it('omits optional audit context when it is not supplied', async () => {
    const context = createTestContext();

    await context.useCase.execute({
      token: 'raw-verification-token',
    });

    expect(context.repository.input).toEqual({
      tokenHash: 'hashed:raw-verification-token',

      verifiedAt: FIXED_NOW,
    });

    expect(context.repository.input).not.toHaveProperty('requestId');

    expect(context.repository.input).not.toHaveProperty('ipAddress');

    expect(context.repository.input).not.toHaveProperty('userAgent');
  });

  it('rejects an empty verification token without calling the repository', async () => {
    const context = createTestContext();

    await expect(
      context.useCase.execute({
        token: '   ',

        requestId: REQUEST_ID,
      }),
    ).rejects.toThrow('Verification token is required');

    expect(context.repository.input).toBeNull();
  });
});
