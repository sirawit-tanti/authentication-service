import { InvalidCredentialsError } from '@/application/errors/invalid-credentials.error.js';
import type { PasswordHasher } from '@/application/ports/crypto/password-hasher.js';
import type { UserRepository } from '@/application/ports/repositories/user.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import { LoginUserUseCase } from '@/application/use-cases/authentication/login-user.use-case.js';
import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { User } from '@/domain/users/entities/user.entity.js';

const VALID_TEST_PASSWORD = 'UnitTestOnly#2026';

const VALID_TEST_PASSWORD_HASH = 'hashed:UnitTestOnly#2026';

class FakeUserRepository implements UserRepository {
  public user: User | null = null;

  public updatedUser: User | null = null;

  public expectedVersion: number | null = null;

  public findById(userId: string): Promise<User | null> {
    void userId;
    return Promise.resolve(this.user);
  }

  public findByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    void normalizedEmail;
    return Promise.resolve(this.user);
  }

  public existsByNormalizedEmail(normalizedEmail: string): Promise<boolean> {
    void normalizedEmail;
    return Promise.resolve(this.user !== null);
  }

  public create(user: User): Promise<void> {
    this.user = user;

    return Promise.resolve();
  }

  public update(user: User, expectedVersion: number): Promise<void> {
    this.updatedUser = user;
    this.expectedVersion = expectedVersion;

    return Promise.resolve();
  }
}

class FakePasswordHasher implements PasswordHasher {
  public verifyCalls: {
    password: string;
    hash: string;
  }[] = [];

  public hash(plainTextPassword: string): Promise<string> {
    return Promise.resolve(`hashed:${plainTextPassword}`);
  }

  public verify(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    this.verifyCalls.push({
      password: plainTextPassword,
      hash: passwordHash,
    });

    return Promise.resolve(passwordHash === `hashed:${plainTextPassword}`);
  }

  public needsRehash(passwordHash: string): boolean {
    return !passwordHash.startsWith('hashed:');
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return new Date('2026-07-16T00:00:00.000Z');
  }
}

function createActiveUser(): User {
  const createdAt = new Date('2026-07-15T00:00:00.000Z');

  const user = User.createPending({
    id: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
    email: EmailAddress.create('sirawit@example.com'),
    passwordHash: VALID_TEST_PASSWORD_HASH,
    now: createdAt,
  });

  user.verifyEmail(createdAt);

  return user;
}

describe('LoginUserUseCase', () => {
  let repository: FakeUserRepository;
  let passwordHasher: FakePasswordHasher;
  let useCase: LoginUserUseCase;

  beforeEach(() => {
    repository = new FakeUserRepository();
    passwordHasher = new FakePasswordHasher();

    useCase = new LoginUserUseCase({
      userRepository: repository,
      passwordHasher,
      clock: new FixedClock(),
      dummyPasswordHash: 'hashed:DummyTestValue#2026',
      maximumFailedAttempts: 3,
      lockDurationMinutes: 15,
    });
  });

  it('authenticates an active verified user', async () => {
    repository.user = createActiveUser();

    const result = await useCase.execute({
      email: '  Sirawit@Example.com  ',
      password: VALID_TEST_PASSWORD,
    });

    expect(result).toEqual({
      userId: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
      email: 'sirawit@example.com',
      status: 'ACTIVE',
    });

    expect(repository.updatedUser?.getLastLoginAt()).toEqual(new Date('2026-07-16T00:00:00.000Z'));

    expect(repository.updatedUser?.getFailedLoginAttempts()).toBe(0);
  });

  it('uses the dummy hash when the email does not exist', async () => {
    repository.user = null;

    await expect(
      useCase.execute({
        email: 'missing@example.com',
        password: VALID_TEST_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(passwordHasher.verifyCalls).toContainEqual({
      password: VALID_TEST_PASSWORD,
      hash: 'hashed:DummyTestValue#2026',
    });
  });

  it('increments failed attempts when password is incorrect', async () => {
    repository.user = createActiveUser();

    await expect(
      useCase.execute({
        email: 'sirawit@example.com',
        password: 'IncorrectTestOnly#2026',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(repository.updatedUser?.getFailedLoginAttempts()).toBe(1);
  });

  it('locks the user after reaching the maximum attempts', async () => {
    const user = createActiveUser();

    user.recordFailedLogin({
      maximumAttempts: 3,
      lockDurationMilliseconds: 15 * 60 * 1_000,
      now: new Date('2026-07-15T23:58:00.000Z'),
    });

    user.recordFailedLogin({
      maximumAttempts: 3,
      lockDurationMilliseconds: 15 * 60 * 1_000,
      now: new Date('2026-07-15T23:59:00.000Z'),
    });

    repository.user = user;

    await expect(
      useCase.execute({
        email: 'sirawit@example.com',
        password: 'IncorrectTestOnly#2026',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(repository.updatedUser?.isLocked(new Date('2026-07-16T00:00:00.000Z'))).toBe(true);
  });

  it('rejects an unverified user', async () => {
    repository.user = User.createPending({
      id: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
      email: EmailAddress.create('sirawit@example.com'),
      passwordHash: VALID_TEST_PASSWORD_HASH,
      now: new Date('2026-07-15T00:00:00.000Z'),
    });

    await expect(
      useCase.execute({
        email: 'sirawit@example.com',
        password: VALID_TEST_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
