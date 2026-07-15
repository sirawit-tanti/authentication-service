import { EmailAlreadyExistsError } from '../../../src/application/errors/email-already-exists.error.js';
import type { PasswordHasher } from '../../../src/application/ports/crypto/password-hasher.js';
import type { SecureTokenService } from '../../../src/application/ports/crypto/secure-token-service.js';
import type {
  CreateUserRegistrationInput,
  UserRegistrationRepository,
} from '../../../src/application/ports/repositories/user-registration.repository.js';
import type { Clock } from '../../../src/application/ports/system/clock.js';
import type { IdGenerator } from '../../../src/application/ports/system/id-generator.js';
import { RegisterUserUseCase } from '../../../src/application/use-cases/authentication/register-user.use-case.js';
import { PasswordPolicy } from '../../../src/domain/authentication/services/password-policy.js';
import { DomainValidationError } from '@/shared/errors/domain-validation.error.js';

class FakeRegistrationRepository implements UserRegistrationRepository {
  public emailExists = false;

  public checkedNormalizedEmail: string | null = null;

  public createdRegistration: CreateUserRegistrationInput | null = null;

  public existsByNormalizedEmail(normalizedEmail: string): Promise<boolean> {
    this.checkedNormalizedEmail = normalizedEmail;

    return Promise.resolve(this.emailExists);
  }

  public createRegistration(input: CreateUserRegistrationInput): Promise<void> {
    this.createdRegistration = input;

    return Promise.resolve();
  }
}

class FakePasswordHasher implements PasswordHasher {
  public hash(plainTextPassword: string): Promise<string> {
    return Promise.resolve(`hashed:${plainTextPassword}`);
  }

  public verify(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${plainTextPassword}`);
  }

  public needsRehash(passwordHash: string): boolean {
    return !passwordHash.startsWith('hashed:');
  }
}

class FakeTokenService implements SecureTokenService {
  public generate(): string {
    return 'verification-token';
  }

  public hash(token: string): string {
    return `hashed:${token}`;
  }
}

class FixedClock implements Clock {
  public now(): Date {
    return new Date('2026-07-14T00:00:00.000Z');
  }
}

class SequentialIdGenerator implements IdGenerator {
  private currentId = 0;

  public generate(): string {
    this.currentId += 1;

    return `generated-id-${String(this.currentId)}`;
  }
}

describe('RegisterUserUseCase', () => {
  let repository: FakeRegistrationRepository;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    repository = new FakeRegistrationRepository();

    useCase = new RegisterUserUseCase({
      registrationRepository: repository,
      passwordHasher: new FakePasswordHasher(),
      passwordPolicy: new PasswordPolicy(),
      secureTokenService: new FakeTokenService(),
      idGenerator: new SequentialIdGenerator(),
      clock: new FixedClock(),
      verificationTokenTtlMinutes: 60,
    });
  });

  it('creates a pending user and verification token', async () => {
    const result = await useCase.execute({
      email: '  Sirawit@Example.com  ',
      password: 'SecurePassword#2026',
    });

    expect(result).toEqual({
      userId: 'generated-id-1',
      email: 'Sirawit@Example.com',
      status: 'PENDING_VERIFICATION',

      verification: {
        token: 'verification-token',
        expiresAt: new Date('2026-07-14T01:00:00.000Z'),
      },
    });

    const registration = repository.createdRegistration;

    expect(registration).not.toBeNull();

    expect(registration?.user.getEmail().normalizedValue).toBe('sirawit@example.com');

    expect(registration?.user.getPasswordHash()).toBe('hashed:SecurePassword#2026');

    expect(registration?.verificationToken).toEqual({
      id: 'generated-id-2',
      tokenHash: 'hashed:verification-token',
      expiresAt: new Date('2026-07-14T01:00:00.000Z'),
      createdAt: new Date('2026-07-14T00:00:00.000Z'),
    });
  });

  it('rejects a password that does not meet policy', async () => {
    await expect(
      useCase.execute({
        email: 'sirawit@example.com',
        password: 'weak',
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);

    expect(repository.createdRegistration).toBeNull();
  });

  it('rejects an email that already exists', async () => {
    repository.emailExists = true;

    await expect(
      useCase.execute({
        email: 'sirawit@example.com',
        password: 'SecurePassword#2026',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);

    expect(repository.createdRegistration).toBeNull();
  });

  it('rejects an invalid verification token TTL', () => {
    expect(
      () =>
        new RegisterUserUseCase({
          registrationRepository: repository,
          passwordHasher: new FakePasswordHasher(),
          passwordPolicy: new PasswordPolicy(),
          secureTokenService: new FakeTokenService(),
          idGenerator: new SequentialIdGenerator(),
          clock: new FixedClock(),
          verificationTokenTtlMinutes: 0,
        }),
    ).toThrow(RangeError);
  });
});
