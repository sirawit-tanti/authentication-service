import { InvalidPasswordResetTokenError } from '../../../src/application/errors/invalid-password-reset-token.error.js';
import { PasswordResetConflictError } from '../../../src/application/errors/password-reset-conflict.error.js';
import { PasswordUnchangedError } from '../../../src/application/errors/password-unchanged.error.js';
import type { PasswordHasher } from '@/application/ports/authentication/password-hasher.js';
import type {
  GeneratedPasswordResetToken,
  PasswordResetTokenService,
} from '../../../src/application/ports/authentication/password-reset-token.service.js';
import type {
  ConsumePasswordResetInput,
  ConsumePasswordResetResult,
  FindPasswordResetRequestInput,
  PasswordResetRequestRecord,
  ResetPasswordRepository,
} from '../../../src/application/ports/repositories/reset-password.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { ResetPasswordUseCase } from '../../../src/application/use-cases/authentication/reset-password.use-case.js';

const FIXED_NOW = new Date('2026-07-17T00:00:00.000Z');

class FakeResetPasswordRepository implements ResetPasswordRepository {
  public request: PasswordResetRequestRecord | null = {
    tokenId: '8a7fd086-9458-4332-acab-c38375c8abbd',

    userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

    passwordHash: 'hash:OldPassword#2026',

    userVersion: 3,
  };

  public findInput: FindPasswordResetRequestInput | null = null;

  public consumeInput: ConsumePasswordResetInput | null = null;

  public consumeResult: ConsumePasswordResetResult = 'UPDATED';

  public findActiveRequest(
    input: FindPasswordResetRequestInput,
  ): Promise<PasswordResetRequestRecord | null> {
    this.findInput = input;

    return Promise.resolve(this.request);
  }

  public consume(input: ConsumePasswordResetInput): Promise<ConsumePasswordResetResult> {
    this.consumeInput = input;

    return Promise.resolve(this.consumeResult);
  }
}

class FakePasswordHasher implements PasswordHasher {
  public hash(password: string): Promise<string> {
    return Promise.resolve(`hash:${password}`);
  }

  public verify(password: string, passwordHash: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hash:${password}`);
  }

  public needsRehash(passwordHash: string): boolean {
    void passwordHash;

    return false;
  }
}

class FakePasswordResetTokenService implements PasswordResetTokenService {
  public generate(): GeneratedPasswordResetToken {
    return {
      rawToken: 'generated-reset-token',
      tokenHash: 'generated-token-hash',
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

function createUseCase(repository: FakeResetPasswordRepository): ResetPasswordUseCase {
  return new ResetPasswordUseCase({
    repository,

    passwordHasher: new FakePasswordHasher(),

    passwordResetTokenService: new FakePasswordResetTokenService(),

    clock: new FixedClock(),
  });
}

describe('ResetPasswordUseCase', () => {
  it('consumes the token and changes the password', async () => {
    const repository = new FakeResetPasswordRepository();

    const useCase = createUseCase(repository);

    await useCase.execute({
      token: ' raw-reset-token ',
      newPassword: 'NewPassword#2026',
    });

    expect(repository.findInput).toEqual({
      tokenHash: 'hashed:raw-reset-token',

      checkedAt: FIXED_NOW,
    });

    expect(repository.consumeInput).toEqual({
      tokenId: '8a7fd086-9458-4332-acab-c38375c8abbd',

      tokenHash: 'hashed:raw-reset-token',

      userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

      expectedUserVersion: 3,

      newPasswordHash: 'hash:NewPassword#2026',

      passwordChangedAt: FIXED_NOW,

      revokeReason: 'Password reset completed',
    });
  });

  it('rejects an invalid or expired token', async () => {
    const repository = new FakeResetPasswordRepository();

    repository.request = null;

    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({
        token: 'invalid-token',
        newPassword: 'NewPassword#2026',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);

    expect(repository.consumeInput).toBeNull();
  });

  it('rejects the current password as the new password', async () => {
    const repository = new FakeResetPasswordRepository();

    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({
        token: 'raw-reset-token',
        newPassword: 'OldPassword#2026',
      }),
    ).rejects.toBeInstanceOf(PasswordUnchangedError);

    expect(repository.consumeInput).toBeNull();
  });

  it('maps a consume conflict to a domain error', async () => {
    const repository = new FakeResetPasswordRepository();

    repository.consumeResult = 'CONFLICT';

    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({
        token: 'raw-reset-token',
        newPassword: 'NewPassword#2026',
      }),
    ).rejects.toBeInstanceOf(PasswordResetConflictError);
  });

  it('rejects a token consumed by another request', async () => {
    const repository = new FakeResetPasswordRepository();

    repository.consumeResult = 'INVALID_TOKEN';

    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({
        token: 'raw-reset-token',
        newPassword: 'NewPassword#2026',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });
});
