import type { RefreshTokenService } from '@/application/ports/authentication/refresh-token-service.js';
import type { LogoutSessionRepository } from '@/application/ports/repositories/logout-session.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const USER_LOGOUT_REASON = 'User requested logout';

export interface LogoutSessionCommand {
  refreshToken: string;
}

export interface LogoutSessionUseCaseDependencies {
  repository: LogoutSessionRepository;
  refreshTokenService: RefreshTokenService;
  clock: Clock;
}

export class LogoutSessionUseCase {
  private readonly repository: LogoutSessionRepository;
  private readonly refreshTokenService: RefreshTokenService;
  private readonly clock: Clock;

  public constructor(dependencies: LogoutSessionUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.refreshTokenService = dependencies.refreshTokenService;
    this.clock = dependencies.clock;
  }

  public async execute(command: LogoutSessionCommand): Promise<void> {
    const rawRefreshToken = command.refreshToken.trim();

    if (rawRefreshToken.length === 0) {
      return;
    }

    await this.repository.revokeByRefreshToken({
      refreshTokenHash: this.refreshTokenService.hash(rawRefreshToken),

      revokedAt: this.clock.now(),
      reason: USER_LOGOUT_REASON,
    });
  }
}
