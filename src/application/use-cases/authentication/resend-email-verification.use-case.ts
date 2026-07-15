import {
  EMAIL_JOB_NAMES,
  type SendEmailVerificationJobData,
} from '@/application/jobs/email-job.js';
import { OUTBOX_TOPICS } from '@/application/outbox/outbox-message.js';
import type { SecureTokenService } from '@/application/ports/crypto/secure-token-service.js';
import type { ResendEmailVerificationRepository } from '@/application/ports/repositories/resend-email-verification.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import type { IdGenerator } from '@/application/ports/system/id-generator.js';
import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';

export interface ResendEmailVerificationCommand {
  email: string;
}

export interface ResendEmailVerificationResult {
  accepted: true;
}

export interface ResendEmailVerificationUseCaseDependencies {
  repository: ResendEmailVerificationRepository;
  secureTokenService: SecureTokenService;
  idGenerator: IdGenerator;
  clock: Clock;
  verificationTokenTtlMinutes: number;
  cooldownSeconds: number;
}

export class ResendEmailVerificationUseCase {
  private readonly repository: ResendEmailVerificationRepository;

  private readonly secureTokenService: SecureTokenService;

  private readonly idGenerator: IdGenerator;

  private readonly clock: Clock;

  private readonly verificationTokenTtlMilliseconds: number;

  private readonly cooldownSeconds: number;

  public constructor(dependencies: ResendEmailVerificationUseCaseDependencies) {
    if (
      !Number.isInteger(dependencies.verificationTokenTtlMinutes) ||
      dependencies.verificationTokenTtlMinutes <= 0
    ) {
      throw new RangeError('Verification token TTL must be a positive integer');
    }

    if (!Number.isInteger(dependencies.cooldownSeconds) || dependencies.cooldownSeconds <= 0) {
      throw new RangeError('Verification resend cooldown must be a positive integer');
    }

    this.repository = dependencies.repository;
    this.secureTokenService = dependencies.secureTokenService;
    this.idGenerator = dependencies.idGenerator;
    this.clock = dependencies.clock;
    this.cooldownSeconds = dependencies.cooldownSeconds;

    this.verificationTokenTtlMilliseconds = dependencies.verificationTokenTtlMinutes * 60 * 1_000;
  }

  public async execute(
    command: ResendEmailVerificationCommand,
  ): Promise<ResendEmailVerificationResult> {
    const email = EmailAddress.create(command.email);
    const requestedAt = this.clock.now();

    const rawVerificationToken = this.secureTokenService.generate();

    const tokenExpiresAt = new Date(requestedAt.getTime() + this.verificationTokenTtlMilliseconds);

    const userIdPlaceholder = '00000000-0000-0000-0000-000000000000';

    const emailJobPayload = {
      version: 1,
      userId: userIdPlaceholder,
      email: email.value,
      verificationToken: rawVerificationToken,
      expiresAt: tokenExpiresAt.toISOString(),
    } satisfies SendEmailVerificationJobData;

    await this.repository.createReplacementVerification({
      normalizedEmail: email.normalizedValue,
      requestedAt,
      cooldownSeconds: this.cooldownSeconds,

      verificationToken: {
        id: this.idGenerator.generate(),
        tokenHash: this.secureTokenService.hash(rawVerificationToken),
        expiresAt: tokenExpiresAt,
        createdAt: requestedAt,
      },

      outboxMessage: {
        id: this.idGenerator.generate(),
        topic: OUTBOX_TOPICS.EMAIL,
        eventType: EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION,
        aggregateId: userIdPlaceholder,
        payload: emailJobPayload,
        availableAt: requestedAt,
        createdAt: requestedAt,
      },
    });

    return {
      accepted: true,
    };
  }
}
