import type {
  RevokeOtherUserSessionsResult,
  UserSessionRepository,
} from '@/application/ports/repositories/user-session.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const REVOKE_OTHER_SESSIONS_REASON = 'Revoked by user from another session';

export interface RevokeOtherUserSessionsCommand {
  userId: string;
  currentSessionId: string;
}

export interface RevokeOtherUserSessionsUseCaseDependencies {
  repository: UserSessionRepository;
  clock: Clock;
}

export class RevokeOtherUserSessionsUseCase {
  private readonly repository: UserSessionRepository;

  private readonly clock: Clock;

  public constructor(dependencies: RevokeOtherUserSessionsUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.clock = dependencies.clock;
  }

  public execute(command: RevokeOtherUserSessionsCommand): Promise<RevokeOtherUserSessionsResult> {
    return this.repository.revokeOthers({
      userId: command.userId,
      currentSessionId: command.currentSessionId,
      revokedAt: this.clock.now(),
      reason: REVOKE_OTHER_SESSIONS_REASON,
    });
  }
}
