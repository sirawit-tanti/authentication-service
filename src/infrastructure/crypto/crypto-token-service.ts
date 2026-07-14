import type { SecureTokenService } from '@/application/ports/crypto/secure-token-service.js';
import { createHash, randomBytes } from 'crypto';

const TOKEN_SIZE_BYTES = 32;

export class CryptoTokenService implements SecureTokenService {
  public generate(): string {
    return randomBytes(TOKEN_SIZE_BYTES).toString('base64url');
  }

  public hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
