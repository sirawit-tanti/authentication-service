import { InvalidCredentialsError } from '@/application/errors/invalid-credentials.error.js';
import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import type { PasswordHasher } from '@/application/ports/crypto/password-hasher.js';
import type { UserRepository } from '@/application/ports/repositories/user.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { DomainValidationError } from '@/shared/errors/domain-validation.error.js';
import type { User } from '@/domain/users/entities/user.entity.js';

export interface LoginUserCommand {
  email: string;
  password: string;
}

export interface LoginUserResult {
  userId: string;
  email: string;
  status: 'ACTIVE';
}

export interface LoginUserUseCaseDependencies {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  clock: Clock;
  dummyPasswordHash: string;
  maximumFailedAttempts: number;
  lockDurationMinutes: number;
}

export class LoginUserUseCase {
  private readonly userRepository: UserRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly clock: Clock;
  private readonly dummyPasswordHash: string;
  private readonly maximumFailedAttempts: number;
  private readonly lockDurationMinutes: number;

  public constructor(dependencies: LoginUserUseCaseDependencies) {
    if (
      !Number.isInteger(dependencies.maximumFailedAttempts) ||
      dependencies.maximumFailedAttempts <= 0
    ) {
      throw new RangeError('Maximum failed login attempts must be a positive integer');
    }

    if (
      !Number.isInteger(dependencies.lockDurationMinutes) ||
      dependencies.lockDurationMinutes <= 0
    ) {
      throw new RangeError('Login lock duration must be a positive integer');
    }

    if (dependencies.dummyPasswordHash.trim().length === 0) {
      throw new RangeError('Dummy password hash must not be empty');
    }

    this.userRepository = dependencies.userRepository;
    this.passwordHasher = dependencies.passwordHasher;
    this.clock = dependencies.clock;
    this.dummyPasswordHash = dependencies.dummyPasswordHash;
    this.maximumFailedAttempts = dependencies.maximumFailedAttempts;
    this.lockDurationMinutes = dependencies.lockDurationMinutes * 60 * 1_000;
  }

  public async execute(command: LoginUserCommand): Promise<LoginUserResult> {
    const email = await this.parseEmailOrReject(command.email, command.password);

    const user = await this.userRepository.findByNormalizedEmail(email.normalizedValue);

    const passwordHash = user?.getPasswordHash() ?? this.dummyPasswordHash;

    const passwordMatches = await this.passwordHasher.verify(command.password, passwordHash);

    if (user === null) {
      throw new InvalidCredentialsError();
    }

    const now = this.clock.now();

    if (user.isLocked(now)) {
      throw new InvalidCredentialsError();
    }

    if (!passwordMatches) {
      await this.recordFailedLogin(user, now);

      throw new InvalidCredentialsError();
    }

    if (!user.canAuthenticate(now)) {
      throw new InvalidCredentialsError();
    }

    const expectedVersion = user.getVersion();

    user.recordSuccessfulLogin(now);

    await this.userRepository.update(user, expectedVersion);

    return {
      userId: user.getId(),
      email: user.getEmail().value,
      status: 'ACTIVE',
    };
  }

  private async parseEmailOrReject(rawEmail: string, password: string): Promise<EmailAddress> {
    try {
      return EmailAddress.create(rawEmail);
    } catch (error: unknown) {
      if (!(error instanceof DomainValidationError)) {
        throw error;
      }

      await this.passwordHasher.verify(password, this.dummyPasswordHash);

      throw new InvalidCredentialsError();
    }
  }

  private async recordFailedLogin(user: User, now: Date): Promise<void> {
    if (user.getStatus() !== 'ACTIVE') {
      return;
    }

    const expectedVersion = user.getVersion();

    user.recordFailedLogin({
      maximumAttempts: this.maximumFailedAttempts,
      lockDurationMilliseconds: this.lockDurationMinutes,
      now,
    });

    try {
      await this.userRepository.update(user, expectedVersion);
    } catch (error: unknown) {
      if (!(error instanceof OptimisticConcurrencyError)) {
        throw error;
      }
    }
  }
}
