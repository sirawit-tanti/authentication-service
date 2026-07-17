import { randomUUID } from 'node:crypto';

import { EMAIL_JOB_NAMES } from '@/application/jobs/email-job.js';
import { OUTBOX_TOPICS } from '@/application/outbox/outbox-message.js';
import type { PasswordResetTokenService } from '@/application/ports/authentication/password-reset-token.service.js';
import type { ForgotPasswordRepository } from '@/application/ports/repositories/forgot-password.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

export interface ForgotPasswordCommand {
  email: string;
}

export interface ForgotPasswordUseCaseDependencies {
  repository: ForgotPasswordRepository;
  passwordResetTokenService: PasswordResetTokenService;
  clock: Clock;
}

export class ForgotPasswordUseCase {
  private readonly repository: ForgotPasswordRepository;
  private readonly passwordResetTokenService: PasswordResetTokenService;
  private readonly clock: Clock;

  public constructor(dependencies: ForgotPasswordUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.passwordResetTokenService = dependencies.passwordResetTokenService;
    this.clock = dependencies.clock;
  }

  public async execute(command: ForgotPasswordCommand): Promise<void> {
    const normalizedEmail = command.email.trim().toLowerCase();

    const user = await this.repository.findActiveUserByNormalizedEmail(normalizedEmail);

    if (user === null) {
      return;
    }

    const createdAt = this.clock.now();

    const expiresAt = new Date(createdAt.getTime() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1_000);

    const generatedToken = this.passwordResetTokenService.generate();

    await this.repository.createPasswordResetRequest({
      userId: user.userId,
      resetToken: {
        id: randomUUID(),
        tokenHash: generatedToken.tokenHash,
        expiresAt,
        createdAt,
      },
      outboxMessage: {
        id: randomUUID(),
        topic: OUTBOX_TOPICS.EMAIL,
        eventType: EMAIL_JOB_NAMES.SEND_PASSWORD_RESET,
        aggregateId: user.userId,
        payload: {
          version: 1,
          userId: user.userId,
          email: user.email,
          resetToken: generatedToken.rawToken,
          expiresAt: expiresAt.toISOString(),
        },
        availableAt: createdAt,
        createdAt,
      },
      invalidatedAt: createdAt,
    });
  }
}
