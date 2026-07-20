import { InvalidCurrentPasswordError } from '../../../src/application/errors/invalid-current-password.error.js';
import { PasswordUnchangedError } from '../../../src/application/errors/password-unchanged.error.js';
import type { PasswordHasher } from '@/application/ports/authentication/password-hasher.js';
import type {
  ChangePasswordRepository,
  ChangePasswordUserRecord,
  FindUserForPasswordChangeInput,
  PersistPasswordChangeInput,
  PersistPasswordChangeResult,
} from '../../../src/application/ports/repositories/change-password.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import { ChangePasswordUseCase } from '../../../src/application/use-cases/authentication/change-password.use-case.js';

const FIXED_NOW = new Date('2026-07-17T00:00:00.000Z');

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const REQUEST_ID = 'change-password-request-id';

class FakeChangePasswordRepository implements ChangePasswordRepository {
  public user: ChangePasswordUserRecord | null = {
    userId: USER_ID,
    passwordHash: 'hash:OldPassword#2026',
    version: 4,
  };

  public findInput: FindUserForPasswordChangeInput | null = null;

  public persistInput: PersistPasswordChangeInput | null = null;

  public persistResult: PersistPasswordChangeResult = 'UPDATED';

  public findUser(input: FindUserForPasswordChangeInput): Promise<ChangePasswordUserRecord | null> {
    this.findInput = input;

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
  it('changes the password and passes the audit request context', async () => {
    const repository = new FakeChangePasswordRepository();

    const useCase = createUseCase(repository);

    await useCase.execute({
      userId: USER_ID,

      currentSessionId: SESSION_ID,

      currentPassword: 'OldPassword#2026',

      newPassword: 'NewPassword#2026',

      requestId: REQUEST_ID,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(repository.findInput).toEqual({
      userId: USER_ID,
    });

    expect(repository.persistInput).toEqual({
      userId: USER_ID,
      expectedVersion: 4,

      newPasswordHash: 'hash:NewPassword#2026',

      passwordChangedAt: FIXED_NOW,

      currentSessionId: SESSION_ID,

      revokeReason: 'Password changed by user',

      requestId: REQUEST_ID,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });
  });

  it('omits optional audit fields when they are not supplied', async () => {
    const repository = new FakeChangePasswordRepository();

    const useCase = createUseCase(repository);

    await useCase.execute({
      userId: USER_ID,

      currentSessionId: SESSION_ID,

      currentPassword: 'OldPassword#2026',

      newPassword: 'NewPassword#2026',
    });

    expect(repository.persistInput).not.toHaveProperty('requestId');

    expect(repository.persistInput).not.toHaveProperty('ipAddress');

    expect(repository.persistInput).not.toHaveProperty('userAgent');
  });

  it('rejects an invalid current password', async () => {
    const repository = new FakeChangePasswordRepository();

    const useCase = createUseCase(repository);

    await expect(
      useCase.execute({
        userId: USER_ID,

        currentSessionId: SESSION_ID,

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
        userId: USER_ID,

        currentSessionId: SESSION_ID,

        currentPassword: 'OldPassword#2026',

        newPassword: 'OldPassword#2026',
      }),
    ).rejects.toBeInstanceOf(PasswordUnchangedError);

    expect(repository.persistInput).toBeNull();
  });
});
