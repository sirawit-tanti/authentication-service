import type { PasswordHasher } from '@/application/ports/crypto/password-hasher.js';
import type {
  ChangePasswordRepository,
  ChangePasswordUserRecord,
  FindUserForPasswordChangeInput,
  PersistPasswordChangeInput,
  PersistPasswordChangeResult,
} from '../../../src/application/ports/repositories/change-password.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { InvalidCurrentPasswordError } from '../../../src/application/errors/invalid-current-password.error.js';
import { PasswordUnchangedError } from '../../../src/application/errors/password-unchanged.error.js';
import { ChangePasswordUseCase } from '../../../src/application/use-cases/authentication/change-password.use-case.js';

const FIXED_NOW = new Date('2026-07-17T00:00:00.000Z');

class FakeChangePasswordRepository implements ChangePasswordRepository {
  public user: ChangePasswordUserRecord | null = {
    userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

    passwordHash: 'hash:OldPassword#2026',
    version: 4,
  };

  public persistInput: PersistPasswordChangeInput | null = null;

  public persistResult: PersistPasswordChangeResult = 'UPDATED';

  public findUser(input: FindUserForPasswordChangeInput): Promise<ChangePasswordUserRecord | null> {
    void input;

    return Promise.resolve(this.user);
  }

  public persist(input: PersistPasswordChangeInput): Promise<PersistPasswordChangeResult> {
    this.persistInput = input;

    return Promise.resolve(this.persistResult);
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

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

function createUseCase(repository: FakeChangePasswordRepository): ChangePasswordUseCase {
  return new ChangePasswordUseCase({
    repository,
    passwordHasher: new FakePasswordHasher(),

    clock: new FixedClock(),
  });
}

describe('ChangePasswordUseCase', () => {
  it('changes the password and preserves the current session', async () => {
    const repository = new FakeChangePasswordRepository();

    const useCase = createUseCase(repository);

    await useCase.execute({
      userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

      currentSessionId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',

      currentPassword: 'OldPassword#2026',

      newPassword: 'NewPassword#2026',
    });

    expect(repository.persistInput).toEqual({
      userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

      expectedVersion: 4,

      newPasswordHash: 'hash:NewPassword#2026',

      passwordChangedAt: FIXED_NOW,

      currentSessionId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',

      revokeReason: 'Password changed by user',
    });
  });

  it('rejects an invalid current password', async () => {
    const repository = new FakeChangePasswordRepository();

    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({
        userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

        currentSessionId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',

        currentPassword: 'IncorrectPassword#2026',

        newPassword: 'NewPassword#2026',
      }),
    ).rejects.toBeInstanceOf(InvalidCurrentPasswordError);

    expect(repository.persistInput).toBeNull();
  });

  it('rejects the existing password as the new password', async () => {
    const repository = new FakeChangePasswordRepository();

    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({
        userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',

        currentSessionId: 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8',

        currentPassword: 'OldPassword#2026',

        newPassword: 'OldPassword#2026',
      }),
    ).rejects.toBeInstanceOf(PasswordUnchangedError);

    expect(repository.persistInput).toBeNull();
  });
});
