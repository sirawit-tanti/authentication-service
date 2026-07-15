import type { SecureTokenService } from '../../../src/application/ports/crypto/secure-token-service.js';
import type {
  ResendEmailVerificationInput,
  ResendEmailVerificationRepository,
  ResendEmailVerificationStatus,
} from '../../../src/application/ports/repositories/resend-email-verification.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import type { IdGenerator } from '../../../src/application/ports/system/id-generator.js';
import { ResendEmailVerificationUseCase } from '../../../src/application/use-cases/authentication/resend-email-verification.use-case.js';

class FakeRepository implements ResendEmailVerificationRepository {
  public input: ResendEmailVerificationInput | null = null;

  public result: ResendEmailVerificationStatus = 'CREATED';

  public createReplacementVerification(
    input: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationStatus> {
    this.input = input;

    return Promise.resolve(this.result);
  }
}

class FakeTokenService implements SecureTokenService {
  public generate(): string {
    return 'resent-verification-token';
  }

  public hash(token: string): string {
    return `hashed:${token}`;
  }
}

class SequentialIdGenerator implements IdGenerator {
  private nextId = 0;

  public generate(): string {
    this.nextId += 1;

    return `generated-id-${String(this.nextId)}`;
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return new Date('2026-07-15T00:00:00.000Z');
  }
}

describe('ResendEmailVerificationUseCase', () => {
  it('creates a replacement verification request', async () => {
    const repository = new FakeRepository();

    const useCase = new ResendEmailVerificationUseCase({
      repository,
      secureTokenService: new FakeTokenService(),
      idGenerator: new SequentialIdGenerator(),
      clock: new FixedClock(),
      verificationTokenTtlMinutes: 60,
      cooldownSeconds: 60,
    });

    const result = await useCase.execute({
      email: '  Sirawit@Example.com  ',
    });

    expect(result).toEqual({
      accepted: true,
    });

    expect(repository.input).toMatchObject({
      normalizedEmail: 'sirawit@example.com',
      cooldownSeconds: 60,

      verificationToken: {
        id: 'generated-id-1',
        tokenHash: 'hashed:resent-verification-token',
        expiresAt: new Date('2026-07-15T01:00:00.000Z'),
      },

      outboxMessage: {
        id: 'generated-id-2',
        topic: 'EMAIL',
        eventType: 'send-email-verification',

        payload: {
          version: 1,
          email: 'Sirawit@Example.com',
          verificationToken: 'resent-verification-token',
          expiresAt: '2026-07-15T01:00:00.000Z',
        },
      },
    });
  });

  it.each(['CREATED', 'IGNORED', 'COOLDOWN'] as const)(
    'returns the same public result when repository returns %s',
    async (repositoryResult) => {
      const repository = new FakeRepository();
      repository.result = repositoryResult;

      const useCase = new ResendEmailVerificationUseCase({
        repository,
        secureTokenService: new FakeTokenService(),
        idGenerator: new SequentialIdGenerator(),
        clock: new FixedClock(),
        verificationTokenTtlMinutes: 60,
        cooldownSeconds: 60,
      });

      await expect(
        useCase.execute({
          email: 'sirawit@example.com',
        }),
      ).resolves.toEqual({
        accepted: true,
      });
    },
  );
});
