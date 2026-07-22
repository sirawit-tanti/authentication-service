import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import {
  AdministrativeUserNotFoundError,
  CannotChangeOwnStatusError,
  DisabledUserStatusError,
  UnverifiedUserActivationError,
  UserStatusConflictError,
} from '@/application/errors/user-status-management.error.js';
import type { AdministrativeUserStatus } from '@/application/ports/repositories/user-administration-query.repository.js';
import type { UserStatusManagementRepository } from '@/application/ports/repositories/user-status-management.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const ACCOUNT_STATUS_REVOKE_REASON = 'User account status changed by administrator';

export type ChangeableUserStatus = Exclude<AdministrativeUserStatus, 'PENDING_VERIFICATION'>;

export interface ChangeUserStatusCommand extends AuditRequestContext {
  applicationId: string;
  actorUserId: string;
  targetUserId: string;
  expectedVersion: number;
  status: ChangeableUserStatus;
}

export interface ChangeUserStatusResult {
  user: {
    id: string;
    email: string;
    previousStatus: AdministrativeUserStatus;
    status: AdministrativeUserStatus;
    version: number;
    revokedSessionCount: number;
    updatedAt: Date;
  };
}

export interface ChangeUserStatusUseCaseDependencies {
  repository: UserStatusManagementRepository;
  clock: Clock;
}

export class ChangeUserStatusUseCase {
  private readonly repository: UserStatusManagementRepository;

  private readonly clock: Clock;

  public constructor(dependencies: ChangeUserStatusUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.clock = dependencies.clock;
  }

  public async execute(command: ChangeUserStatusCommand): Promise<ChangeUserStatusResult> {
    if (command.actorUserId === command.targetUserId) {
      throw new CannotChangeOwnStatusError();
    }

    const result = await this.repository.changeStatus({
      applicationId: command.applicationId,

      actorUserId: command.actorUserId,

      targetUserId: command.targetUserId,

      expectedVersion: command.expectedVersion,

      status: command.status,

      changedAt: this.clock.now(),

      revokeReason: ACCOUNT_STATUS_REVOKE_REASON,

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

    if (result.status === 'NOT_FOUND') {
      throw new AdministrativeUserNotFoundError();
    }

    if (result.status === 'CONFLICT') {
      throw new UserStatusConflictError();
    }

    if (result.status === 'DISABLED_USER') {
      throw new DisabledUserStatusError();
    }

    if (result.status === 'EMAIL_NOT_VERIFIED') {
      throw new UnverifiedUserActivationError();
    }

    return {
      user: {
        id: result.userId,

        email: result.email,

        previousStatus: result.previousStatus,

        status: result.currentStatus,

        version: result.version,

        revokedSessionCount: result.revokedSessionCount,

        updatedAt: result.updatedAt,
      },
    };
  }
}
