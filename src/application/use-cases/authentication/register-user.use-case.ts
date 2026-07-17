import { EmailAlreadyExistsError } from '@/application/errors/email-already-exists.error.js';
import {
  EMAIL_JOB_NAMES,
  type SendEmailVerificationJobData,
} from '@/application/jobs/email-job.js';
import { OUTBOX_TOPICS } from '@/application/outbox/outbox-message.js';
import type { PasswordHasher } from '@/application/ports/authentication/password-hasher.js';
import type { SecureTokenService } from '@/application/ports/crypto/secure-token-service.js';
import type { UserRegistrationRepository } from '@/application/ports/repositories/user-registration.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import type { IdGenerator } from '@/application/ports/system/id-generator.js';
import type { PasswordPolicy } from '@/domain/authentication/services/password-policy.js';
import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { DomainValidationError } from '@/domain/errors/domain-validation.error.js';
import { User } from '@/domain/users/entities/user.entity.js';

export interface RegisterUserCommand {
  email: string;
  password: string;
}

export interface RegisterUserResult {
  userId: string;
  email: string;
  status: 'PENDING_VERIFICATION';
}

export interface RegisterUserUseCaseDependencies {
  registrationRepository: UserRegistrationRepository;
  passwordHasher: PasswordHasher;
  passwordPolicy: PasswordPolicy;
  secureTokenService: SecureTokenService;
  idGenerator: IdGenerator;
  clock: Clock;
  verificationTokenTtlMinutes: number;
}

export class RegisterUserUseCase {
  private readonly registrationRepository: UserRegistrationRepository;

  private readonly passwordHasher: PasswordHasher;

  private readonly passwordPolicy: PasswordPolicy;

  private readonly secureTokenService: SecureTokenService;

  private readonly idGenerator: IdGenerator;

  private readonly clock: Clock;

  private readonly verificationTokenTtlMilliseconds: number;

  public constructor(dependencies: RegisterUserUseCaseDependencies) {
    if (
      !Number.isInteger(dependencies.verificationTokenTtlMinutes) ||
      dependencies.verificationTokenTtlMinutes <= 0
    ) {
      throw new RangeError('Verification token TTL must be a positive integer');
    }

    this.registrationRepository = dependencies.registrationRepository;
    this.passwordHasher = dependencies.passwordHasher;
    this.passwordPolicy = dependencies.passwordPolicy;
    this.secureTokenService = dependencies.secureTokenService;
    this.idGenerator = dependencies.idGenerator;
    this.clock = dependencies.clock;

    this.verificationTokenTtlMilliseconds = dependencies.verificationTokenTtlMinutes * 60 * 1_000;
  }

  public async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    const email = EmailAddress.create(command.email);

    const passwordValidation = this.passwordPolicy.validate(command.password, {
      normalizedEmail: email.normalizedValue,
    });

    if (!passwordValidation.valid) {
      throw new DomainValidationError(
        'Password does not meet the required policy',
        passwordValidation.issues,
      );
    }

    const emailExists = await this.registrationRepository.existsByNormalizedEmail(
      email.normalizedValue,
    );

    if (emailExists) {
      throw new EmailAlreadyExistsError();
    }

    const now = this.clock.now();

    const passwordHash = await this.passwordHasher.hash(command.password);

    const user = User.createPending({
      id: this.idGenerator.generate(),
      email,
      passwordHash,
      now,
    });

    const rawVerificationToken = this.secureTokenService.generate();

    const tokenExpiresAt = new Date(now.getTime() + this.verificationTokenTtlMilliseconds);

    const emailJobPayload = {
      version: 1,
      userId: user.getId(),
      email: user.getEmail().value,
      verificationToken: rawVerificationToken,
      expiresAt: tokenExpiresAt.toISOString(),
    } satisfies SendEmailVerificationJobData;

    await this.registrationRepository.createRegistration({
      user,

      verificationToken: {
        id: this.idGenerator.generate(),
        tokenHash: this.secureTokenService.hash(rawVerificationToken),
        expiresAt: tokenExpiresAt,
        createdAt: now,
      },

      outboxMessage: {
        id: this.idGenerator.generate(),
        topic: OUTBOX_TOPICS.EMAIL,
        eventType: EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION,
        aggregateId: user.getId(),
        payload: emailJobPayload,
        availableAt: now,
        createdAt: now,
      },
    });

    return {
      userId: user.getId(),
      email: user.getEmail().value,
      status: 'PENDING_VERIFICATION',
    };
  }
}
