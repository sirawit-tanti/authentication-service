import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import type { AccessTokenService } from '@/application/ports/authentication/access-token-service.js';
import type { RefreshTokenService } from '@/application/ports/authentication/refresh-token-service.js';
import type { LogoutSessionRepository } from '@/application/ports/repositories/logout-session.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';

const LOGOUT_REASON = 'User requested logout';

export interface LogoutSessionCommand extends AuditRequestContext {
  refreshToken: string;
  accessToken?: string;
}

export interface LogoutSessionUseCaseDependencies {
  repository: LogoutSessionRepository;
  refreshTokenService: RefreshTokenService;
  accessTokenService: AccessTokenService;
  clock: Clock;
}

export class LogoutSessionUseCase {
  private readonly repository: LogoutSessionRepository;

  private readonly refreshTokenService: RefreshTokenService;

  private readonly accessTokenService: AccessTokenService;

  private readonly clock: Clock;

  public constructor(dependencies: LogoutSessionUseCaseDependencies) {
    this.repository = dependencies.repository;
    this.refreshTokenService = dependencies.refreshTokenService;
    this.accessTokenService = dependencies.accessTokenService;
    this.clock = dependencies.clock;
  }

  public async execute(command: LogoutSessionCommand): Promise<void> {
    const refreshToken = command.refreshToken.trim();

    if (refreshToken.length === 0) {
      return;
    }

    const revokedAt = this.clock.now();

    const accessToken = await this.verifyOptionalAccessToken({
      accessToken: command.accessToken,
      verifiedAt: revokedAt,
    });

    await this.repository.revokeByRefreshToken({
      refreshTokenHash: this.refreshTokenService.hash(refreshToken),
      revokedAt,
      reason: LOGOUT_REASON,

      ...(accessToken === undefined
        ? {}
        : {
            accessToken,
          }),

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

  private async verifyOptionalAccessToken(input: {
    accessToken: string | undefined;
    verifiedAt: Date;
  }): Promise<
    | {
        jti: string;
        sessionId: string;
        expiresAt: Date;
      }
    | undefined
  > {
    const rawAccessToken = input.accessToken?.trim();

    if (rawAccessToken === undefined || rawAccessToken.length === 0) {
      return undefined;
    }

    try {
      const claims = await this.accessTokenService.verify({
        token: rawAccessToken,
        verifiedAt: input.verifiedAt,
      });

      return {
        jti: claims.jti,
        sessionId: claims.sessionId,
        expiresAt: claims.expiresAt,
      };
    } catch {
      return undefined;
    }
  }
}
