import { InvalidRefreshTokenError } from '@/application/errors/invalid-refresh-token.error.js';
import type { AuthenticationTokenPair } from '@/application/models/authentication-token-pair.js';
import type { AccessTokenService } from '@/application/ports/authentication/access-token-service.js';
import type { RefreshTokenService } from '@/application/ports/authentication/refresh-token-service.js';
import type { RefreshSessionRepository } from '@/application/ports/repositories/refresh-session.repository.js';
import type { Clock } from '@/application/ports/system/clock.js';
import type { IdGenerator } from '@/application/ports/system/id-generator.js';

export interface RefreshSessionCommand {
  refreshToken: string;
}

export interface RefreshSessionResult {
  sessionId: string;
  tokens: AuthenticationTokenPair;
}

export interface RefreshSessionUseCaseDependencies {
  repository: RefreshSessionRepository;
  accessTokenService: AccessTokenService;
  refreshTokenService: RefreshTokenService;
  idGenerator: IdGenerator;
  clock: Clock;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
}

export class RefreshSessionUseCase {
  private readonly repository: RefreshSessionRepository;
  private readonly accessTokenService: AccessTokenService;
  private readonly refreshTokenService: RefreshTokenService;
  private readonly idGenerator: IdGenerator;
  private readonly clock: Clock;
  private readonly accessTokenExpiresInSeconds: number;
  private readonly refreshTokenTtlMilliseconds: number;

  public constructor(dependencies: RefreshSessionUseCaseDependencies) {
    if (
      !Number.isInteger(dependencies.accessTokenTtlMinutes) ||
      dependencies.accessTokenTtlMinutes <= 0
    ) {
      throw new RangeError('Access token TTL must be a positive integer');
    }

    if (
      !Number.isInteger(dependencies.refreshTokenTtlDays) ||
      dependencies.refreshTokenTtlDays <= 0
    ) {
      throw new RangeError('Refresh token TTL must be a positive integer');
    }

    this.repository = dependencies.repository;
    this.accessTokenService = dependencies.accessTokenService;
    this.refreshTokenService = dependencies.refreshTokenService;
    this.idGenerator = dependencies.idGenerator;
    this.clock = dependencies.clock;
    this.accessTokenExpiresInSeconds = dependencies.accessTokenTtlMinutes * 60;
    this.refreshTokenTtlMilliseconds = dependencies.refreshTokenTtlDays * 24 * 60 * 60 * 1_000;
  }

  public async execute(command: RefreshSessionCommand): Promise<RefreshSessionResult> {
    const rawCurrentToken = command.refreshToken.trim();

    if (rawCurrentToken.length === 0) {
      throw new InvalidRefreshTokenError();
    }

    const rotatedAt = this.clock.now();

    const newRefreshToken = this.refreshTokenService.generate();

    const requestedTokenExpiresAt = new Date(
      rotatedAt.getTime() + this.refreshTokenTtlMilliseconds,
    );

    const rotationResult = await this.repository.rotate({
      currentTokenHash: this.refreshTokenService.hash(rawCurrentToken),
      newTokenId: this.idGenerator.generate(),
      newTokenJti: newRefreshToken.jti,
      newTokenHash: newRefreshToken.tokenHash,
      rotatedAt,
      requestedTokenExpiresAt,
    });

    if (rotationResult.status !== 'ROTATED') {
      throw new InvalidRefreshTokenError();
    }

    const accessToken = await this.accessTokenService.create({
      claims: {
        userId: rotationResult.userId,
        sessionId: rotationResult.sessionId,
        applicationId: rotationResult.applicationId,
        email: rotationResult.userEmail,
      },
      issuedAt: rotatedAt,
    });

    return {
      sessionId: rotationResult.sessionId,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken.rawToken,
        tokenType: 'Bearer',
        accessTokenExpiresInSeconds: this.accessTokenExpiresInSeconds,
        refreshTokenExpiresAt: rotationResult.refreshTokenExpiresAt,
      },
    };
  }
}
