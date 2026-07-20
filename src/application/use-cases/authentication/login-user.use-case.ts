import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import { InvalidCredentialsError } from '@/application/errors/invalid-credentials.error.js';
import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import type { AuthenticationTokenPair } from '@/application/models/authentication-token-pair.js';
import type { AccessTokenService } from '@/application/ports/authentication/access-token-service.js';
import type { PasswordHasher } from '@/application/ports/authentication/password-hasher.js';
import type { RefreshTokenService } from '@/application/ports/authentication/refresh-token-service.js';
import type { LoginSessionRepository } from '@/application/ports/repositories/login-session.repository.js';
import type { UserRepository } from '@/application/ports/repositories/user.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import type { IdGenerator } from '@/application/ports/system/id-generator.js';
import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { DomainValidationError } from '@/domain/errors/domain-validation.error.js';
import type { User } from '@/domain/users/entities/user.entity.js';

export interface LoginUserCommand extends AuditRequestContext {
  applicationId: string;
  email: string;
  password: string;
}

export interface LoginUserResult {
  user: {
    userId: string;
    email: string;
    status: 'ACTIVE';
  };

  sessionId: string;
  tokens: AuthenticationTokenPair;
}

export interface LoginUserUseCaseDependencies {
  userRepository: UserRepository;
  loginSessionRepository: LoginSessionRepository;
  passwordHasher: PasswordHasher;
  accessTokenService: AccessTokenService;
  refreshTokenService: RefreshTokenService;
  idGenerator: IdGenerator;
  clock: Clock;
  dummyPasswordHash: string;
  maximumFailedAttempts: number;
  lockDurationMinutes: number;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
}

export class LoginUserUseCase {
  private readonly userRepository: UserRepository;

  private readonly loginSessionRepository: LoginSessionRepository;

  private readonly passwordHasher: PasswordHasher;

  private readonly accessTokenService: AccessTokenService;

  private readonly refreshTokenService: RefreshTokenService;

  private readonly idGenerator: IdGenerator;

  private readonly clock: Clock;

  private readonly dummyPasswordHash: string;

  private readonly maximumFailedAttempts: number;

  private readonly lockDurationMilliseconds: number;

  private readonly accessTokenExpiresInSeconds: number;

  private readonly refreshTokenTtlMilliseconds: number;

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

    if (
      !Number.isInteger(dependencies.accessTokenTtlMinutes) ||
      dependencies.accessTokenTtlMinutes <= 0
    ) {
      throw new RangeError('Access token TTL must be a positive integer');
    }

    if (
      !Number.isInteger(dependencies.refreshTokenTtlDays) ||
      dependencies.refreshTokenTtlDays <= 0
    ) {
      throw new RangeError('Refresh token TTL must be a positive integer');
    }

    if (dependencies.dummyPasswordHash.trim().length === 0) {
      throw new RangeError('Dummy password hash must not be empty');
    }

    this.userRepository = dependencies.userRepository;

    this.loginSessionRepository = dependencies.loginSessionRepository;

    this.passwordHasher = dependencies.passwordHasher;

    this.accessTokenService = dependencies.accessTokenService;

    this.refreshTokenService = dependencies.refreshTokenService;

    this.idGenerator = dependencies.idGenerator;

    this.clock = dependencies.clock;

    this.dummyPasswordHash = dependencies.dummyPasswordHash;

    this.maximumFailedAttempts = dependencies.maximumFailedAttempts;

    this.lockDurationMilliseconds = dependencies.lockDurationMinutes * 60 * 1_000;

    this.accessTokenExpiresInSeconds = dependencies.accessTokenTtlMinutes * 60;

    this.refreshTokenTtlMilliseconds = dependencies.refreshTokenTtlDays * 24 * 60 * 60 * 1_000;
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
      await this.recordFailedLogin({
        user,
        now,
        command,
      });

      throw new InvalidCredentialsError();
    }

    if (!user.canAuthenticate(now)) {
      throw new InvalidCredentialsError();
    }

    const expectedUserVersion = user.getVersion();

    user.recordSuccessfulLogin(now);

    const sessionId = this.idGenerator.generate();

    const refreshTokenId = this.idGenerator.generate();

    const refreshTokenFamilyId = this.idGenerator.generate();

    const refreshToken = this.refreshTokenService.generate();

    const refreshTokenExpiresAt = new Date(now.getTime() + this.refreshTokenTtlMilliseconds);

    const accessToken = await this.accessTokenService.create({
      claims: {
        userId: user.getId(),
        sessionId,
        applicationId: command.applicationId,
        email: user.getEmail().value,
      },

      issuedAt: now,
    });

    await this.loginSessionRepository.create({
      user,
      expectedUserVersion,

      sessionId,
      applicationId: command.applicationId,

      refreshTokenId,
      refreshTokenFamilyId,
      refreshTokenJti: refreshToken.jti,
      refreshTokenHash: refreshToken.tokenHash,

      createdAt: now,
      sessionExpiresAt: refreshTokenExpiresAt,
      refreshTokenExpiresAt,

      ...(command.requestId === undefined
        ? {}
        : {
            requestId: command.requestId,
          }),

      ...(command.ipAddress === undefined
        ? {}
        : {
            ipAddress: command.ipAddress,
          }),

      ...(command.userAgent === undefined
        ? {}
        : {
            userAgent: command.userAgent,
          }),
    });

    return {
      user: {
        userId: user.getId(),
        email: user.getEmail().value,
        status: 'ACTIVE',
      },

      sessionId,

      tokens: {
        accessToken,

        refreshToken: refreshToken.rawToken,

        tokenType: 'Bearer',

        accessTokenExpiresInSeconds: this.accessTokenExpiresInSeconds,

        refreshTokenExpiresAt,
      },
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

  private async recordFailedLogin(input: {
    user: User;
    now: Date;
    command: LoginUserCommand;
  }): Promise<void> {
    if (input.user.getStatus() !== 'ACTIVE' || !input.user.isEmailVerified()) {
      return;
    }

    const expectedVersion = input.user.getVersion();

    const wasLockedBeforeAttempt = input.user.isLocked(input.now);

    input.user.recordFailedLogin({
      maximumAttempts: this.maximumFailedAttempts,

      lockDurationMilliseconds: this.lockDurationMilliseconds,

      now: input.now,
    });

    const accountLocked = !wasLockedBeforeAttempt && input.user.isLocked(input.now);

    try {
      await this.userRepository.recordFailedLogin({
        user: input.user,
        expectedVersion,

        applicationId: input.command.applicationId,

        failedAt: input.now,
        accountLocked,

        ...(input.command.requestId === undefined
          ? {}
          : {
              requestId: input.command.requestId,
            }),

        ...(input.command.ipAddress === undefined
          ? {}
          : {
              ipAddress: input.command.ipAddress,
            }),

        ...(input.command.userAgent === undefined
          ? {}
          : {
              userAgent: input.command.userAgent,
            }),
      });
    } catch (error: unknown) {
      if (!(error instanceof OptimisticConcurrencyError)) {
        throw error;
      }
    }
  }
}
