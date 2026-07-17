import bcrypt from 'bcrypt';

import type { PasswordHasher } from '@/application/ports/authentication/password-hasher.js';
import { env } from '@/shared/config/env.js';

export class BcryptPasswordHasher implements PasswordHasher {
  private readonly cost: number;

  public constructor(cost: number = env.BCRYPT_COST) {
    if (!Number.isInteger(cost) || cost < 10 || cost > 15) {
      throw new RangeError('Bcrypt cost must be an integer between 10 and 15');
    }

    this.cost = cost;
  }

  public async hash(plainTextPassword: string): Promise<string> {
    return bcrypt.hash(plainTextPassword, this.cost);
  }

  public async verify(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainTextPassword, passwordHash);
  }

  public needsRehash(passwordHash: string): boolean {
    try {
      return bcrypt.getRounds(passwordHash) !== this.cost;
    } catch {
      return true;
    }
  }
}
