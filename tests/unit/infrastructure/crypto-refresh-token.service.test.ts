import { describe, expect, it } from 'vitest';

import { CryptoRefreshTokenService } from '../../../src/infrastructure/authentication/crypto-refresh-token.service.js';

describe('CryptoRefreshTokenService', () => {
  it('generates unique refresh tokens', () => {
    const service = new CryptoRefreshTokenService();

    const firstToken = service.generate();
    const secondToken = service.generate();

    expect(firstToken.rawToken).not.toBe(secondToken.rawToken);

    expect(firstToken.tokenHash).not.toBe(secondToken.tokenHash);
  });

  it('generates a hash matching the raw token', () => {
    const service = new CryptoRefreshTokenService();

    const generatedToken = service.generate();

    expect(service.hash(generatedToken.rawToken)).toBe(generatedToken.tokenHash);
  });

  it('does not return the raw token as its hash', () => {
    const service = new CryptoRefreshTokenService();

    const generatedToken = service.generate();

    expect(generatedToken.tokenHash).not.toBe(generatedToken.rawToken);

    expect(generatedToken.tokenHash).toHaveLength(64);
  });

  it('rejects an empty refresh token', () => {
    const service = new CryptoRefreshTokenService();

    expect(() => service.hash('')).toThrow('Refresh token must not be empty');
  });
});
