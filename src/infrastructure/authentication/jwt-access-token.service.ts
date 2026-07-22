import { randomUUID } from 'node:crypto';

import type {
  AccessTokenService,
  CreateAccessTokenInput,
  VerifyAccessTokenInput,
  VerifyAccessTokenResult,
} from '@/application/ports/authentication/access-token-service.js';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

export interface JwtAccessTokenServiceOptions {
  secret: string;
  issuer: string;
  audience: string;
  timeToLiveMinutes: number;
}

export class InvalidAccessTokenError extends Error {
  public constructor() {
    super('Access token is invalid');

    this.name = 'InvalidAccessTokenError';

    Error.captureStackTrace(this, new.target);
  }
}

export class JwtAccessTokenService implements AccessTokenService {
  private readonly secret: Uint8Array;

  private readonly issuer: string;

  private readonly audience: string;

  private readonly timeToLiveSeconds: number;

  public constructor(options: JwtAccessTokenServiceOptions) {
    if (options.secret.length < 32) {
      throw new RangeError('JWT access token secret must contain at least 32 characters');
    }

    const issuer = options.issuer.trim();

    if (issuer.length === 0) {
      throw new RangeError('JWT access token issuer must not be empty');
    }

    const audience = options.audience.trim();

    if (audience.length === 0) {
      throw new RangeError('JWT access token audience must not be empty');
    }

    if (!Number.isInteger(options.timeToLiveMinutes) || options.timeToLiveMinutes <= 0) {
      throw new RangeError('JWT access token TTL must be a positive integer');
    }

    this.secret = new TextEncoder().encode(options.secret);
    this.issuer = issuer;
    this.audience = audience;
    this.timeToLiveSeconds = options.timeToLiveMinutes * 60;
  }

  public async create(input: CreateAccessTokenInput): Promise<string> {
    const issuedAtInSeconds = Math.floor(input.issuedAt.getTime() / 1_000);

    const expiresAtInSeconds = issuedAtInSeconds + this.timeToLiveSeconds;

    return new SignJWT({
      sid: input.claims.sessionId,
      app_id: input.claims.applicationId,
      email: input.claims.email,
    })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setJti(randomUUID())
      .setSubject(input.claims.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(issuedAtInSeconds)
      .setExpirationTime(expiresAtInSeconds)
      .sign(this.secret);
  }

  public async verify(input: VerifyAccessTokenInput): Promise<VerifyAccessTokenResult> {
    try {
      const verificationResult = await jwtVerify(input.token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
        currentDate: input.verifiedAt ?? new Date(),
      });

      const jti = verificationResult.payload.jti;
      const subject = verificationResult.payload.sub;
      const sessionId = verificationResult.payload.sid;
      const applicationId = verificationResult.payload.app_id;
      const email = verificationResult.payload.email;
      const issuedAt = verificationResult.payload.iat;
      const expiresAt = verificationResult.payload.exp;

      if (
        typeof jti !== 'string' ||
        jti.length === 0 ||
        subject === undefined ||
        typeof sessionId !== 'string' ||
        typeof applicationId !== 'string' ||
        typeof email !== 'string' ||
        issuedAt === undefined ||
        expiresAt === undefined
      ) {
        throw new InvalidAccessTokenError();
      }

      return {
        jti,
        userId: subject,
        sessionId,
        applicationId,
        email,
        issuedAt: new Date(issuedAt * 1_000),
        expiresAt: new Date(expiresAt * 1_000),
      };
    } catch (error: unknown) {
      if (error instanceof InvalidAccessTokenError) {
        throw error;
      }

      if (error instanceof joseErrors.JOSEError) {
        throw new InvalidAccessTokenError();
      }

      throw error;
    }
  }
}
