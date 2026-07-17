import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { User } from '@/domain/users/entities/user.entity.js';
import { DomainValidationError } from '@/domain/errors/domain-validation.error.js';

describe('User', () => {
  const initialDate = new Date('2026-07-14T00:00:00.000Z');

  function createPendingUser(): User {
    return User.createPending({
      id: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
      email: EmailAddress.create('sirawit@example.com'),
      passwordHash: 'hashed-password',
      now: initialDate,
    });
  }

  it('creates a pending user with safe defaults', () => {
    const user = createPendingUser();

    expect(user.getStatus()).toBe('PENDING_VERIFICATION');
    expect(user.isEmailVerified()).toBe(false);
    expect(user.getFailedLoginAttempts()).toBe(0);
    expect(user.getLockedUntil()).toBeNull();
    expect(user.getVersion()).toBe(1);
  });

  it('activates a pending user when email is verified', () => {
    const user = createPendingUser();
    const verificationDate = new Date('2026-07-14T01:00:00.000Z');

    user.verifyEmail(verificationDate);

    expect(user.isEmailVerified()).toBe(true);
    expect(user.getStatus()).toBe('ACTIVE');
    expect(user.getVersion()).toBe(2);
    expect(user.canAuthenticate(verificationDate)).toBe(true);
  });

  it('locks the account after reaching the failed-attempt threshold', () => {
    const user = createPendingUser();

    user.verifyEmail(initialDate);

    const firstAttempt = new Date('2026-07-14T01:00:00.000Z');
    const secondAttempt = new Date('2026-07-14T01:01:00.000Z');
    const thirdAttempt = new Date('2026-07-14T01:02:00.000Z');

    const options = {
      maximumAttempts: 3,
      lockDurationMilliseconds: 15 * 60 * 1_000,
    };

    user.recordFailedLogin({
      ...options,
      now: firstAttempt,
    });

    user.recordFailedLogin({
      ...options,
      now: secondAttempt,
    });

    expect(user.isLocked(secondAttempt)).toBe(false);

    user.recordFailedLogin({
      ...options,
      now: thirdAttempt,
    });

    expect(user.getFailedLoginAttempts()).toBe(3);
    expect(user.isLocked(thirdAttempt)).toBe(true);
    expect(user.canAuthenticate(thirdAttempt)).toBe(false);

    expect(user.getLockedUntil()).toEqual(new Date('2026-07-14T01:17:00.000Z'));
  });

  it('clears failed attempts after successful login', () => {
    const user = createPendingUser();

    user.verifyEmail(initialDate);

    user.recordFailedLogin({
      maximumAttempts: 3,
      lockDurationMilliseconds: 15 * 60 * 1_000,
      now: new Date('2026-07-14T01:00:00.000Z'),
    });

    const loginDate = new Date('2026-07-14T02:00:00.000Z');

    user.recordSuccessfulLogin(loginDate);

    expect(user.getFailedLoginAttempts()).toBe(0);
    expect(user.getLockedUntil()).toBeNull();
    expect(user.getLastLoginAt()).toEqual(loginDate);
  });

  it('rejects changing to the same password hash', () => {
    const user = createPendingUser();

    expect(() =>
      user.changePassword('hashed-password', new Date('2026-07-14T03:00:00.000Z')),
    ).toThrow(DomainValidationError);
  });

  it('does not activate an unverified user', () => {
    const user = createPendingUser();

    expect(() => user.activate(new Date('2026-07-14T03:00:00.000Z'))).toThrow(
      DomainValidationError,
    );
  });

  it('does not allow a disabled user to be activated', () => {
    const user = createPendingUser();

    user.verifyEmail(initialDate);
    user.disable(new Date('2026-07-14T01:00:00.000Z'));

    expect(() => user.activate(new Date('2026-07-14T02:00:00.000Z'))).toThrow(
      DomainValidationError,
    );
  });
});
