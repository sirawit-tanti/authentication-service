import { InvalidPasswordResetTokenError } from '@/application/errors/invalid-password-reset-token.error.js';
import { PasswordResetConflictError } from '@/application/errors/password-reset-conflict.error.js';
import { PasswordUnchangedError } from '@/application/errors/password-unchanged.error.js';
import type { PasswordHasher } from '@/application/ports/authentication/password-hasher.js';
import type { PasswordResetTokenService } from '@/application/ports/authentication/password-reset-token.service.js';
import type { ResetPasswordRepository } from '@/application/ports/repositories/reset-password.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const PASSWORD_RESET_REVOKE_REASON = 'Password reset completed';

export interface ResetPasswordCommand {
  token: string;
  newPassword: string;
}

export interface ResetPasswordUseCaseDependencies {
  repository: ResetPasswordRepository;
  passwordHasher: PasswordHasher;
  passwordResetTokenService: PasswordResetTokenService;
  clock: Clock;
}

export class ResetPasswordUseCase {
  private readonly repository: ResetPasswordRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly passwordResetTokenService: PasswordResetTokenService;
  private readonly clock: Clock;

  public constructor(dependencies: ResetPasswordUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.passwordHasher = dependencies.passwordHasher;
    this.passwordResetTokenService = dependencies.passwordResetTokenService;
    this.clock = dependencies.clock;
  }

  public async execute(command: ResetPasswordCommand): Promise<void> {
    const rawToken = command.token.trim();

    if (rawToken.length === 0) {
      throw new InvalidPasswordResetTokenError();
    }

    const checkedAt = this.clock.now();

    const tokenHash = this.passwordResetTokenService.hash(rawToken);

    const resetRequest = await this.repository.findActiveRequest({
      tokenHash,
      checkedAt,
    });

    if (resetRequest === null) {
      throw new InvalidPasswordResetTokenError();
    }

    const passwordIsUnchanged = await this.passwordHasher.verify(
      command.newPassword,
      resetRequest.passwordHash,
    );

    if (passwordIsUnchanged) {
      throw new PasswordUnchangedError();
    }

    const newPasswordHash = await this.passwordHasher.hash(command.newPassword);

    const result = await this.repository.consume({
      tokenId: resetRequest.tokenId,
      tokenHash,
      userId: resetRequest.userId,

      expectedUserVersion: resetRequest.userVersion,

      newPasswordHash,
      passwordChangedAt: checkedAt,

      revokeReason: PASSWORD_RESET_REVOKE_REASON,
    });

    if (result === 'INVALID_TOKEN') {
      throw new InvalidPasswordResetTokenError();
    }

    if (result === 'CONFLICT') {
      throw new PasswordResetConflictError();
    }
  }
}
