import { InvalidCredentialsError } from '../../../src/application/errors/invalid-credentials.error.js';
import type { AuthenticationTokenPair } from '../../../src/application/models/authentication-token-pair.js';
import type {
  AccessTokenService,
  CreateAccessTokenInput,
  VerifyAccessTokenInput,
  VerifyAccessTokenResult,
} from '../../../src/application/ports/authentication/access-token-service.js';
import type {
  GeneratedRefreshToken,
  RefreshTokenService,
} from '../../../src/application/ports/authentication/refresh-token-service.js';
import type { PasswordHasher } from '../../../src/application/ports/crypto/password-hasher.js';
import type {
  CreateLoginSessionInput,
  LoginSessionRepository,
} from '../../../src/application/ports/repositories/login-session.repository.js';
import type { UserRepository } from '../../../src/application/ports/repositories/user.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import type { IdGenerator } from '../../../src/application/ports/system/id-generator.js';
import { LoginUserUseCase } from '../../../src/application/use-cases/authentication/login-user.use-case.js';
import { EmailAddress } from '../../../src/domain/authentication/value-objects/email-address.js';
import { User } from '../../../src/domain/users/entities/user.entity.js';

const USER_ID = 'f7ee2402-e515-47fa-b79f-c700e82b4451';

const APPLICATION_ID = 'd797d3eb-41ce-40cf-9d79-30b15fe49042';

const SESSION_ID = 'be4c57d3-b4c9-4eb5-a975-92adb74f69c8';

const REFRESH_TOKEN_ID = '401a82b5-dbf1-4e76-b084-dce1da232008';

const REFRESH_TOKEN_FAMILY_ID = '9fc49e86-a0e7-4825-b916-c9a60e9a170b';

const REFRESH_TOKEN_JTI = '91399467-9823-47d1-b483-786630fcf0fa';

const VALID_TEST_PASSWORD = 'UnitTestOnly#2026';

const VALID_TEST_PASSWORD_HASH = 'hashed:UnitTestOnly#2026';

const DUMMY_PASSWORD_HASH = 'hashed:DummyTestOnly#2026';

const FIXED_NOW = new Date('2026-07-16T00:00:00.000Z');

const EXPECTED_REFRESH_TOKEN_EXPIRES_AT = new Date('2026-08-15T00:00:00.000Z');

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

class FakeLoginSessionRepository implements LoginSessionRepository {
  public input: CreateLoginSessionInput | null = null;

  public create(input: CreateLoginSessionInput): Promise<void> {
    this.input = input;

    return Promise.resolve();
  }
}

class FakePasswordHasher implements PasswordHasher {
  public verifyCalls: {
    plainTextPassword: string;
    passwordHash: string;
  }[] = [];

  public hash(plainTextPassword: string): Promise<string> {
    return Promise.resolve(`hashed:${plainTextPassword}`);
  }

  public verify(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    this.verifyCalls.push({
      plainTextPassword,
      passwordHash,
    });

    return Promise.resolve(passwordHash === `hashed:${plainTextPassword}`);
  }

  public needsRehash(passwordHash: string): boolean {
    return !passwordHash.startsWith('hashed:');
  }
}

class FakeAccessTokenService implements AccessTokenService {
  public createInput: CreateAccessTokenInput | null = null;

  public create(input: CreateAccessTokenInput): Promise<string> {
    this.createInput = input;

    return Promise.resolve('test-access-token');
  }

  public verify(input: VerifyAccessTokenInput): Promise<VerifyAccessTokenResult> {
    void input;

    return Promise.resolve({
      userId: USER_ID,
      sessionId: SESSION_ID,
      applicationId: APPLICATION_ID,
      email: 'sirawit@example.com',
      issuedAt: FIXED_NOW,

      expiresAt: new Date('2026-07-16T00:15:00.000Z'),
    });
  }
}

class FakeRefreshTokenService implements RefreshTokenService {
  public generate(): GeneratedRefreshToken {
    return {
      rawToken: 'test-refresh-token',
      tokenHash: 'test-refresh-token-hash',
      jti: REFRESH_TOKEN_JTI,
    };
  }

  public hash(rawToken: string): string {
    return `hashed:${rawToken}`;
  }
}

class SequentialIdGenerator implements IdGenerator {
  private readonly ids = [SESSION_ID, REFRESH_TOKEN_ID, REFRESH_TOKEN_FAMILY_ID];

  private currentIndex = 0;

  public generate(): string {
    const generatedId = this.ids[this.currentIndex];

    if (generatedId === undefined) {
      throw new Error('No more test IDs are available');
    }

    this.currentIndex += 1;

    return generatedId;
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return FIXED_NOW;
  }
}

function createActiveUser(): User {
  const createdAt = new Date('2026-07-15T00:00:00.000Z');

  const user = User.createPending({
    id: USER_ID,

    email: EmailAddress.create('sirawit@example.com'),

    passwordHash: VALID_TEST_PASSWORD_HASH,
    now: createdAt,
  });

  user.verifyEmail(createdAt);

  return user;
}

interface TestContext {
  userRepository: FakeUserRepository;
  loginSessionRepository: FakeLoginSessionRepository;
  passwordHasher: FakePasswordHasher;
  accessTokenService: FakeAccessTokenService;
  useCase: LoginUserUseCase;
}

function createTestContext(): TestContext {
  const userRepository = new FakeUserRepository();

  const loginSessionRepository = new FakeLoginSessionRepository();

  const passwordHasher = new FakePasswordHasher();

  const accessTokenService = new FakeAccessTokenService();

  const useCase = new LoginUserUseCase({
    userRepository,
    loginSessionRepository,
    passwordHasher,
    accessTokenService,

    refreshTokenService: new FakeRefreshTokenService(),

    idGenerator: new SequentialIdGenerator(),

    clock: new FixedClock(),

    dummyPasswordHash: DUMMY_PASSWORD_HASH,

    maximumFailedAttempts: 3,
    lockDurationMinutes: 15,
    accessTokenTtlMinutes: 15,
    refreshTokenTtlDays: 30,
  });

  return {
    userRepository,
    loginSessionRepository,
    passwordHasher,
    accessTokenService,
    useCase,
  };
}

describe('LoginUserUseCase', () => {
  it('authenticates a verified active user and creates a session', async () => {
    const context = createTestContext();

    context.userRepository.user = createActiveUser();

    const result = await context.useCase.execute({
      applicationId: APPLICATION_ID,
      email: '  Sirawit@Example.com  ',
      password: VALID_TEST_PASSWORD,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    const expectedTokens: AuthenticationTokenPair = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      tokenType: 'Bearer',
      accessTokenExpiresInSeconds: 900,

      refreshTokenExpiresAt: EXPECTED_REFRESH_TOKEN_EXPIRES_AT,
    };

    expect(result).toEqual({
      user: {
        userId: USER_ID,
        email: 'sirawit@example.com',
        status: 'ACTIVE',
      },

      sessionId: SESSION_ID,
      tokens: expectedTokens,
    });

    expect(context.accessTokenService.createInput).toEqual({
      claims: {
        userId: USER_ID,
        sessionId: SESSION_ID,
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',
      },

      issuedAt: FIXED_NOW,
    });

    expect(context.loginSessionRepository.input).toMatchObject({
      expectedUserVersion: 2,
      sessionId: SESSION_ID,
      applicationId: APPLICATION_ID,

      refreshTokenId: REFRESH_TOKEN_ID,

      refreshTokenFamilyId: REFRESH_TOKEN_FAMILY_ID,

      refreshTokenJti: REFRESH_TOKEN_JTI,

      refreshTokenHash: 'test-refresh-token-hash',

      createdAt: FIXED_NOW,

      sessionExpiresAt: EXPECTED_REFRESH_TOKEN_EXPIRES_AT,

      refreshTokenExpiresAt: EXPECTED_REFRESH_TOKEN_EXPIRES_AT,

      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(context.loginSessionRepository.input?.user).toBe(context.userRepository.user);

    expect(context.loginSessionRepository.input?.user.getLastLoginAt()).toEqual(FIXED_NOW);

    expect(context.loginSessionRepository.input?.user.getFailedLoginAttempts()).toBe(0);
  });

  it('uses the dummy password hash when the user does not exist', async () => {
    const context = createTestContext();

    context.userRepository.user = null;

    await expect(
      context.useCase.execute({
        applicationId: APPLICATION_ID,
        email: 'missing@example.com',
        password: VALID_TEST_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(context.passwordHasher.verifyCalls).toContainEqual({
      plainTextPassword: VALID_TEST_PASSWORD,

      passwordHash: DUMMY_PASSWORD_HASH,
    });

    expect(context.loginSessionRepository.input).toBeNull();
  });

  it('rejects an invalid email without revealing account existence', async () => {
    const context = createTestContext();

    await expect(
      context.useCase.execute({
        applicationId: APPLICATION_ID,
        email: 'invalid-email',
        password: VALID_TEST_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(context.passwordHasher.verifyCalls).toContainEqual({
      plainTextPassword: VALID_TEST_PASSWORD,

      passwordHash: DUMMY_PASSWORD_HASH,
    });

    expect(context.loginSessionRepository.input).toBeNull();
  });

  it('records a failed login when the password is incorrect', async () => {
    const context = createTestContext();

    context.userRepository.user = createActiveUser();

    await expect(
      context.useCase.execute({
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',
        password: 'IncorrectTestOnly#2026',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(context.userRepository.updatedUser?.getFailedLoginAttempts()).toBe(1);

    expect(context.userRepository.expectedVersion).toBe(2);

    expect(context.loginSessionRepository.input).toBeNull();
  });

  it('locks the user after reaching the maximum failed attempts', async () => {
    const context = createTestContext();
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

    context.userRepository.user = user;

    await expect(
      context.useCase.execute({
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',
        password: 'IncorrectTestOnly#2026',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(context.userRepository.updatedUser?.isLocked(FIXED_NOW)).toBe(true);

    expect(context.loginSessionRepository.input).toBeNull();
  });

  it('rejects a user whose email is not verified', async () => {
    const context = createTestContext();

    context.userRepository.user = User.createPending({
      id: USER_ID,

      email: EmailAddress.create('sirawit@example.com'),

      passwordHash: VALID_TEST_PASSWORD_HASH,

      now: new Date('2026-07-15T00:00:00.000Z'),
    });

    await expect(
      context.useCase.execute({
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',
        password: VALID_TEST_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(context.loginSessionRepository.input).toBeNull();
  });

  it('rejects an active lock even when the password is correct', async () => {
    const context = createTestContext();
    const user = createActiveUser();

    user.recordFailedLogin({
      maximumAttempts: 1,

      lockDurationMilliseconds: 15 * 60 * 1_000,

      now: new Date('2026-07-15T23:59:00.000Z'),
    });

    context.userRepository.user = user;

    await expect(
      context.useCase.execute({
        applicationId: APPLICATION_ID,
        email: 'sirawit@example.com',
        password: VALID_TEST_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(context.loginSessionRepository.input).toBeNull();
  });
});
