import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import { InvalidCurrentPasswordError } from '@/application/errors/invalid-current-password.error.js';
import { PasswordChangeConflictError } from '@/application/errors/password-change-conflict.error.js';
import { PasswordUnchangedError } from '@/application/errors/password-unchanged.error.js';
import type { PasswordHasher } from '@/application/ports/authentication/password-hasher.js';
import type { ChangePasswordRepository } from '@/application/ports/repositories/change-password.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const PASSWORD_CHANGE_REVOKE_REASON = 'Password changed by user';

export interface ChangePasswordCommand extends AuditRequestContext {
  userId: string;
  applicationId: string;
  currentSessionId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordUseCaseDependencies {
  repository: ChangePasswordRepository;
  passwordHasher: PasswordHasher;
  clock: Clock;
}

export class ChangePasswordUseCase {
  private readonly repository: ChangePasswordRepository;

  private readonly passwordHasher: PasswordHasher;

  private readonly clock: Clock;

  public constructor(dependencies: ChangePasswordUseCaseDependencies) {
    this.repository = dependencies.repository;

    this.passwordHasher = dependencies.passwordHasher;

    this.clock = dependencies.clock;
  }

  public async execute(command: ChangePasswordCommand): Promise<void> {
    const user = await this.repository.findUser({
      userId: command.userId,
    });

    if (user === null) {
      throw new InvalidCurrentPasswordError();
    }

    const currentPasswordIsValid = await this.passwordHasher.verify(
      command.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordIsValid) {
      throw new InvalidCurrentPasswordError();
    }

    const newPasswordMatchesCurrent = await this.passwordHasher.verify(
      command.newPassword,
      user.passwordHash,
    );

    if (newPasswordMatchesCurrent) {
      throw new PasswordUnchangedError();
    }

    const newPasswordHash = await this.passwordHasher.hash(command.newPassword);

    const passwordChangedAt = this.clock.now();

    const result = await this.repository.persist({
      userId: user.userId,
      applicationId: command.applicationId,
      expectedVersion: user.version,
      newPasswordHash,
      passwordChangedAt,
      currentSessionId: command.currentSessionId,
      revokeReason: PASSWORD_CHANGE_REVOKE_REASON,
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

    if (result === 'CONFLICT') {
      throw new PasswordChangeConflictError();
    }

    if (result === 'NOT_FOUND') {
      throw new InvalidCurrentPasswordError();
    }
  }
}
