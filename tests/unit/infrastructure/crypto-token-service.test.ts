import { CryptoTokenService } from '../../../src/infrastructure/crypto/crypto-token-service.js';

describe('CryptoTokenService', () => {
  const tokenService = new CryptoTokenService();

  it('generates a non-empty random token', () => {
    const token = tokenService.generate();

    expect(token.length).toBeGreaterThan(32);
  });

  it('generates different tokens', () => {
    expect(tokenService.generate()).not.toBe(tokenService.generate());
  });

  it('produces a deterministic SHA-256 hash', () => {
    const firstHash = tokenService.hash('test-token');
    const secondHash = tokenService.hash('test-token');

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different tokens', () => {
    expect(tokenService.hash('token-a')).not.toBe(tokenService.hash('token-b'));
  });
});
