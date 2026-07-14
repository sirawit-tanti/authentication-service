import { BcryptPasswordHasher } from '@/infrastructure/crypto/bcrypt-password-hasher.js';

describe('BcryptPasswordHasher', () => {
  const passwordHasher = new BcryptPasswordHasher(10);

  it('hashes and verifies a password', async () => {
    const password = 'StrongPassword#2026';

    const passwordHash = await passwordHasher.hash(password);

    expect(passwordHash).not.toBe(password);
    await expect(passwordHasher.verify(password, passwordHash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await passwordHasher.hash('CorrectPassword#2026');

    await expect(passwordHasher.verify('IncorrectPassword#2026', passwordHash)).resolves.toBe(
      false,
    );
  });

  it('detects a hash created with a different cost', async () => {
    const lowerCostHasher = new BcryptPasswordHasher(10);
    const higherCostHasher = new BcryptPasswordHasher(11);

    const passwordHash = await lowerCostHasher.hash('StrongPassword#2026');

    expect(lowerCostHasher.needsRehash(passwordHash)).toBe(false);
    expect(higherCostHasher.needsRehash(passwordHash)).toBe(true);
  });

  it('considers an invalid hash eligible for replacement', () => {
    expect(passwordHasher.needsRehash('invalid-hash')).toBe(true);
  });

  it.each([9, 16, 10.5])('rejects unsupported bcrypt cost: %s', (cost) => {
    expect(() => new BcryptPasswordHasher(cost)).toThrow(RangeError);
  });
});
