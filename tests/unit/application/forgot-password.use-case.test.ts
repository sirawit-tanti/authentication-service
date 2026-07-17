import type {
  GeneratedPasswordResetToken,
  PasswordResetTokenService,
} from '../../../src/application/ports/authentication/password-reset-token.service.js';
import type {
  CreatePasswordResetRequestInput,
  ForgotPasswordRepository,
  ForgotPasswordUserRecord,
} from '../../../src/application/ports/repositories/forgot-password.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { ForgotPasswordUseCase } from '../../../src/application/use-cases/authentication/forgot-password.use-case.js';

const FIXED_NOW = new Date('2026-07-17T00:00:00.000Z');

class FakeForgotPasswordRepository implements ForgotPasswordRepository {
  public user: ForgotPasswordUserRecord | null = {
    userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

    email: 'sirawit@example.com',
  };

  public searchedEmail: string | null = null;

  public createInput: CreatePasswordResetRequestInput | null = null;

  public findActiveUserByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<ForgotPasswordUserRecord | null> {
    this.searchedEmail = normalizedEmail;

    return Promise.resolve(this.user);
  }

  public createPasswordResetRequest(input: CreatePasswordResetRequestInput): Promise<void> {
    this.createInput = input;

    return Promise.resolve();
  }
}

class FakePasswordResetTokenService implements PasswordResetTokenService {
  public generate(): GeneratedPasswordResetToken {
    return {
      rawToken: 'raw-reset-token',
      tokenHash: 'hashed-reset-token',
    };
  }

  public hash(rawToken: string): string {
    return `hashed:${rawToken}`;
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

function createUseCase(repository: FakeForgotPasswordRepository): ForgotPasswordUseCase {
  return new ForgotPasswordUseCase({
    repository,

    passwordResetTokenService: new FakePasswordResetTokenService(),

    clock: new FixedClock(),
  });
}

describe('ForgotPasswordUseCase', () => {
  it('creates a password reset request for an active user', async () => {
    const repository = new FakeForgotPasswordRepository();

    const useCase = createUseCase(repository);

    await useCase.execute({
      email: ' Sirawit@Example.com ',
    });

    expect(repository.searchedEmail).toBe('sirawit@example.com');

    expect(repository.createInput).toMatchObject({
      userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

      resetToken: {
        tokenHash: 'hashed-reset-token',

        expiresAt: new Date('2026-07-17T00:30:00.000Z'),

        createdAt: FIXED_NOW,
      },

      outboxMessage: {
        topic: 'EMAIL',
        eventType: 'send-password-reset',

        aggregateId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

        payload: {
          version: 1,

          userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

          email: 'sirawit@example.com',

          resetToken: 'raw-reset-token',

          expiresAt: '2026-07-17T00:30:00.000Z',
        },

        availableAt: FIXED_NOW,
        createdAt: FIXED_NOW,
      },

      invalidatedAt: FIXED_NOW,
    });

    expect(repository.createInput?.resetToken.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );

    expect(repository.createInput?.outboxMessage.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it('does not reveal that an email does not exist', async () => {
    const repository = new FakeForgotPasswordRepository();

    repository.user = null;

    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({
        email: 'missing@example.com',
      }),
    ).resolves.toBeUndefined();

    expect(repository.createInput).toBeNull();
  });
});
