import { CryptoIdGenerator } from '@/infrastructure/system/crypto-id-generator.js';
import { SystemClock } from '@/infrastructure/system/system-clock.js';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('System infrastructure services', () => {
  it('returns the current time', () => {
    const clock = new SystemClock();

    const before = Date.now();
    const result = clock.now();
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it('generates a UUID version 4', () => {
    const idGenerator = new CryptoIdGenerator();

    const generatedId = idGenerator.generate();

    expect(generatedId).toMatch(UUID_V4_PATTERN);
  });

  it('generates different identifiers', () => {
    const idGenerator = new CryptoIdGenerator();

    expect(idGenerator.generate()).not.toBe(idGenerator.generate());
  });
});
