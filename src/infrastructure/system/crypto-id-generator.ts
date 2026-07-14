import { randomUUID } from 'node:crypto';

import type { IdGenerator } from '@/application/ports/system/id-generator.js';

export class CryptoIdGenerator implements IdGenerator {
  public generate(): string {
    return randomUUID();
  }
}
