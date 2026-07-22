import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../../../application/errors/unauthorized.error.js';
import type { AccessTokenService } from '../../../application/ports/authentication/access-token-service.js';
import type { AccessSessionRepository } from '../../../application/ports/repositories/access-session.repository.js';
import type { AccessTokenBlacklistRepository } from '../../../application/ports/repositories/access-token-blacklist.repository.js';
import type { Clock } from '../../../application/ports/system/clock.js';
import { InvalidAccessTokenError } from '../../../infrastructure/authentication/jwt-access-token.service.js';
import { createErrorResponse } from '../../../shared/http/api-response.js';

export interface AuthenticationGuardDependencies {
  accessTokenService: AccessTokenService;
  accessSessionRepository: AccessSessionRepository;
  accessTokenBlacklistRepository: AccessTokenBlacklistRepository;
  clock: Clock;
}

export type AuthenticationGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (authorizationHeader === undefined) {
    throw new UnauthorizedError();
  }

  const parts = authorizationHeader.trim().split(/\s+/u);

  if (parts.length !== 2) {
    throw new UnauthorizedError();
  }

  const [scheme, token] = parts;

  if (scheme?.toLowerCase() !== 'bearer' || token === undefined || token.length === 0) {
    throw new UnauthorizedError();
  }

  return token;
}

async function sendUnauthorized(reply: FastifyReply): Promise<void> {
  await reply.status(401).send(createErrorResponse('UNAUTHORIZED', 'Authentication is required'));
}

export function createAuthenticationGuard(
  dependencies: AuthenticationGuardDependencies,
): AuthenticationGuard {
  return async function authenticationGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    request.authenticatedPrincipal = null;

    let accessToken: string;

    try {
      accessToken = extractBearerToken(request.headers.authorization);
    } catch (error: unknown) {
      if (error instanceof UnauthorizedError) {
        await sendUnauthorized(reply);

        return;
      }

      throw error;
    }

    const checkedAt = dependencies.clock.now();

    let claims;

    try {
      claims = await dependencies.accessTokenService.verify({
        token: accessToken,
        verifiedAt: checkedAt,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidAccessTokenError) {
        await sendUnauthorized(reply);

        return;
      }

      throw error;
    }

    const blacklisted = await dependencies.accessTokenBlacklistRepository.isBlacklisted({
      jti: claims.jti,
      checkedAt,
    });

    if (blacklisted) {
      await sendUnauthorized(reply);

      return;
    }

    const activeSession = await dependencies.accessSessionRepository.findActive({
      sessionId: claims.sessionId,
      userId: claims.userId,
      applicationId: claims.applicationId,
      checkedAt,
    });

    if (activeSession?.email !== claims.email) {
      await sendUnauthorized(reply);

      return;
    }

    request.authenticatedPrincipal = {
      userId: activeSession.userId,
      email: activeSession.email,
      applicationId: activeSession.applicationId,
      sessionId: activeSession.sessionId,
    };
  };
}
