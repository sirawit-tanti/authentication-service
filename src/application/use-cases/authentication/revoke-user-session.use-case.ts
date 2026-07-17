import type { UserSessionRepository } from '@/application/ports/repositories/user-session.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const REMOTE_REVOCATION_REASON = 'Revoked by user';

export interface RevokeUserSessionCommand {
  userId: string;
  sessionId: string;
}

export interface RevokeUserSessionUseCaseDependencies {
  repository: UserSessionRepository;
  clock: Clock;
}

export class RevokeUserSessionUseCase {
  private readonly repository: UserSessionRepository;

  private readonly clock: Clock;

  public constructor(dependenceis: RevokeUserSessionUseCaseDependencies) {
    this.repository = dependenceis.repository;
    this.clock = dependenceis.clock;
  }

  public async execute(command: RevokeUserSessionCommand): Promise<void> {
    await this.repository.revoke({
      userId: command.userId,
      sessionId: command.sessionId,
      revokedAt: this.clock.now(),
      reason: REMOTE_REVOCATION_REASON,
    });
  }
}
