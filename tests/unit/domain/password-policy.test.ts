import { PasswordPolicy } from '@/domain/authentication/services/password-policy.js';

describe('PasswordPolicy', () => {
  const passwordPolicy = new PasswordPolicy();

  it('accepts a strong password', () => {
    const result = passwordPolicy.validate('StrongPass#2026');

    expect(result).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('returns all failed requirements', () => {
    const result = passwordPolicy.validate('weak');

    expect(result.valid).toBe(false);

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'PASSWORD_TOO_SHORT',
        'PASSWORD_UPPERCASE_REQUIRED',
        'PASSWORD_NUMBER_REQUIRED',
        'PASSWORD_SPECIAL_CHARACTER_REQUIRED',
      ]),
    );
  });

  it('rejects whitespace', () => {
    const result = passwordPolicy.validate('Strong Pass#2026');

    expect(result.valid).toBe(false);

    expect(result.issues).toContainEqual({
      code: 'PASSWORD_WHITESPACE_NOT_ALLOWED',
      field: 'password',
      message: 'Password must not contain whitespace',
    });
  });

  it('rejects a password containing the email local part', () => {
    const result = passwordPolicy.validate('Sirawit#Secure2026', {
      normalizedEmail: 'sirawit@example.com',
    });

    expect(result.valid).toBe(false);

    expect(result.issues).toContainEqual({
      code: 'PASSWORD_CONTAINS_EMAIL',
      field: 'password',
      message: 'Password must not contain the email local part',
    });
  });
});
