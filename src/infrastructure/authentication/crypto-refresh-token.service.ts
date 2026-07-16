import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type {
  GeneratedRefreshToken,
  RefreshTokenService,
} from '@/application/ports/authentication/refresh-token-service.js';

export interface CryptoRefreshTokenServiceOptions {
  tokenSizeInBytes?: number;
}

export class CryptoRefreshTokenService implements RefreshTokenService {
  private readonly tokenSizeInBytes: number;

  public constructor(options: CryptoRefreshTokenServiceOptions = {}) {
    const tokenSizeInBytes = options.tokenSizeInBytes ?? 48;

    if (!Number.isInteger(tokenSizeInBytes) || tokenSizeInBytes < 32) {
      throw new RangeError('Refresh token size must be at least 32 bytes');
    }

    this.tokenSizeInBytes = tokenSizeInBytes;
  }

  public generate(): GeneratedRefreshToken {
    const rawToken = randomBytes(this.tokenSizeInBytes).toString('base64url');

    return {
      rawToken,
      tokenHash: this.hash(rawToken),
      jti: randomUUID(),
    };
  }

  public hash(rawToken: string): string {
    if (rawToken.length === 0) {
      throw new TypeError('Refresh token must not be empty');
    }

    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }
}
