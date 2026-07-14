import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { DomainValidationError } from '@/shared/errors/domain-validation.error.js';

describe('EmailAddress', () => {
  it('creates an email and normalizes it for comparison', () => {
    const email = EmailAddress.create('  Sirawit.Tanti@Example.com  ');

    expect(email.value).toBe('Sirawit.Tanti@Example.com');
    expect(email.normalizedValue).toBe('sirawit.tanti@example.com');
  });

  it('considers emails equal after normalization', () => {
    const firstEmail = EmailAddress.create('Sirawit@Example.com');
    const secondEmail = EmailAddress.create('sirawit@example.com');

    expect(firstEmail.equals(secondEmail)).toBe(true);
  });

  it.each([
    '',
    'invalid-email',
    '@example.com',
    'user@',
    'user name@example.com',
    '.user@example.com',
    'user..name@example.com',
    'user@example',
  ])('rejects invalid email: %s', (input) => {
    expect(() => EmailAddress.create(input)).toThrow(DomainValidationError);
  });
});
