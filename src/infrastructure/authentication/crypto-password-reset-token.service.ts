import { createHash, randomBytes } from 'node:crypto';

import type {
  GeneratedPasswordResetToken,
  PasswordResetTokenService,
} from '@/application/ports/authentication/password-reset-token.service.js';

const TOKEN_SIZE_BYTES = 32;

export class CryptoPasswordResetTokenService implements PasswordResetTokenService {
  public generate(): GeneratedPasswordResetToken {
    const rawToken = randomBytes(TOKEN_SIZE_BYTES).toString('base64url');

    return {
      rawToken,
      tokenHash: this.hash(rawToken),
    };
  }

  public hash(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }
}
