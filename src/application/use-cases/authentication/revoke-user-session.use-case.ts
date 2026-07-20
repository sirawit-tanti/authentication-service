import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import type { UserSessionRepository } from '@/application/ports/repositories/user-session.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const REMOTE_REVOCATION_REASON = 'Revoked by user';

export interface RevokeUserSessionCommand extends AuditRequestContext {
  userId: string;
  applicationId: string;
  sessionId: string;
}

export interface RevokeUserSessionUseCaseDependencies {
  repository: UserSessionRepository;
  clock: Clock;
}

export class RevokeUserSessionUseCase {
  private readonly repository: UserSessionRepository;

  private readonly clock: Clock;

  public constructor(dependencies: RevokeUserSessionUseCaseDependencies) {
    this.repository = dependencies.repository;

    this.clock = dependencies.clock;
  }

  public async execute(command: RevokeUserSessionCommand): Promise<void> {
    await this.repository.revoke({
      userId: command.userId,

      applicationId: command.applicationId,

      sessionId: command.sessionId,

      revokedAt: this.clock.now(),

      reason: REMOTE_REVOCATION_REASON,

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
  }
}
