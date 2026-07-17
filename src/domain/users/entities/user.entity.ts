import type { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import type { UserStatus } from '../types/user-status.js';
import { DomainValidationError } from '@/domain/errors/domain-validation.error.js';

export interface UserState {
  id: string;
  email: EmailAddress;
  passwordHash: string;
  status: UserStatus;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePendingUserInput {
  id: string;
  email: EmailAddress;
  passwordHash: string;
  now: Date;
}

export interface RecordFailedLoginOptions {
  maximumAttempts: number;
  lockDurationMilliseconds: number;
  now: Date;
}

export class User {
  private readonly id: string;

  private email: EmailAddress;

  private passwordHash: string;

  private status: UserStatus;

  private emailVerified: boolean;

  private failedLoginAttempts: number;

  private lockedUntil: Date | null;

  private passwordChangedAt: Date | null;

  private lastLoginAt: Date | null;

  private version: number;

  private readonly createdAt: Date;

  private updatedAt: Date;

  private constructor(state: UserState) {
    User.validateState(state);

    this.id = state.id;
    this.email = state.email;
    this.passwordHash = state.passwordHash;
    this.status = state.status;
    this.emailVerified = state.emailVerified;
    this.failedLoginAttempts = state.failedLoginAttempts;
    this.lockedUntil = state.lockedUntil;
    this.passwordChangedAt = state.passwordChangedAt;
    this.lastLoginAt = state.lastLoginAt;
    this.version = state.version;
    this.createdAt = new Date(state.createdAt);
    this.updatedAt = new Date(state.updatedAt);
  }

  public static createPending(input: CreatePendingUserInput): User {
    return new User({
      id: input.id,
      email: input.email,
      passwordHash: input.passwordHash,
      status: 'PENDING_VERIFICATION',
      emailVerified: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: input.now,
      lastLoginAt: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  public static restore(state: UserState): User {
    return new User(state);
  }

  public getId(): string {
    return this.id;
  }

  public getEmail(): EmailAddress {
    return this.email;
  }

  public getPasswordHash(): string {
    return this.passwordHash;
  }

  public getStatus(): UserStatus {
    return this.status;
  }

  public isEmailVerified(): boolean {
    return this.emailVerified;
  }

  public getFailedLoginAttempts(): number {
    return this.failedLoginAttempts;
  }

  public getLockedUntil(): Date | null {
    return this.lockedUntil === null ? null : new Date(this.lockedUntil);
  }

  public getPasswordChangedAt(): Date | null {
    return this.passwordChangedAt === null ? null : new Date(this.passwordChangedAt);
  }

  public getLastLoginAt(): Date | null {
    return this.lastLoginAt === null ? null : new Date(this.lastLoginAt);
  }

  public getVersion(): number {
    return this.version;
  }

  public getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  public getUpdatedAt(): Date {
    return new Date(this.updatedAt);
  }

  public isLocked(now: Date): boolean {
    return this.lockedUntil !== null && this.lockedUntil.getTime() > now.getTime();
  }

  public canAuthenticate(now: Date): boolean {
    return this.status === 'ACTIVE' && this.emailVerified && !this.isLocked(now);
  }

  public verifyEmail(now: Date): void {
    if (this.status === 'DISABLED') {
      throw new DomainValidationError('Disabled user cannot verify email', [
        {
          code: 'USER_DISABLED',
          message: 'Disabled user cannot verify email',
        },
      ]);
    }

    this.emailVerified = true;

    if (this.status === 'PENDING_VERIFICATION') {
      this.status = 'ACTIVE';
    }

    this.touch(now);
  }

  public recordFailedLogin(options: RecordFailedLoginOptions): void {
    if (options.maximumAttempts <= 0) {
      throw new DomainValidationError('Maximum login attempts must be positive', [
        {
          code: 'INVALID_MAXIMUM_LOGIN_ATTEMPTS',
          message: 'Maximum login attempts must be greater than zero',
        },
      ]);
    }

    if (options.lockDurationMilliseconds <= 0) {
      throw new DomainValidationError('Account lock duration must be positive', [
        {
          code: 'INVALID_ACCOUNT_LOCK_DURATION',
          message: 'Account lock duration must be greater than zero',
        },
      ]);
    }

    this.failedLoginAttempts += 1;

    if (this.failedLoginAttempts >= options.maximumAttempts) {
      this.lockedUntil = new Date(options.now.getTime() + options.lockDurationMilliseconds);
    }

    this.touch(options.now);
  }

  public recordSuccessfulLogin(now: Date): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    this.lastLoginAt = new Date(now);

    this.touch(now);
  }

  public changePassword(newPasswordHash: string, now: Date): void {
    User.validatePasswordHash(newPasswordHash);

    if (newPasswordHash === this.passwordHash) {
      throw new DomainValidationError('New password must be different from the current password', [
        {
          code: 'PASSWORD_UNCHANGED',
          field: 'password',
          message: 'New password must be different from the current password',
        },
      ]);
    }

    this.passwordHash = newPasswordHash;
    this.passwordChangedAt = new Date(now);
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;

    this.touch(now);
  }

  public suspend(now: Date): void {
    if (this.status === 'DISABLED') {
      throw new DomainValidationError('Disabled user cannot be suspended', [
        {
          code: 'USER_DISABLED',
          message: 'Disabled user cannot be suspended',
        },
      ]);
    }

    this.status = 'SUSPENDED';
    this.touch(now);
  }

  public activate(now: Date): void {
    if (!this.emailVerified) {
      throw new DomainValidationError('Unverified user cannot be activated', [
        {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'User email must be verified befor activation',
        },
      ]);
    }

    if (this.status === 'DISABLED') {
      throw new DomainValidationError('Disabled user cannot be activated', [
        {
          code: 'USER_DISABLED',
          message: 'Disabled user cannot be activated',
        },
      ]);
    }

    this.status = 'ACTIVE';
    this.touch(now);
  }

  public disable(now: Date): void {
    this.status = 'DISABLED';
    this.lockedUntil = null;

    this.touch(now);
  }

  public toState(): UserState {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      status: this.status,
      emailVerified: this.emailVerified,
      failedLoginAttempts: this.failedLoginAttempts,
      lockedUntil: this.lockedUntil === null ? null : new Date(this.lockedUntil),
      passwordChangedAt: this.passwordChangedAt === null ? null : new Date(this.passwordChangedAt),
      lastLoginAt: this.lastLoginAt === null ? null : new Date(this.lastLoginAt),
      version: this.version,
      createdAt: new Date(this.createdAt),
      updatedAt: new Date(this.updatedAt),
    };
  }

  private touch(now: Date): void {
    this.updatedAt = new Date(now);
    this.version += 1;
  }

  private static validateState(state: UserState): void {
    const issues: {
      code: string;
      field?: string;
      message: string;
    }[] = [];

    if (state.id.trim().length === 0) {
      issues.push({
        code: 'USER_ID_REQUIRED',
        field: 'id',
        message: 'User ID is required',
      });
    }

    if (state.failedLoginAttempts < 0) {
      issues.push({
        code: 'INVALID_FAILED_LOGIN_ATTEMPTS',
        field: 'failedLoginAttempts',
        message: 'Failed login attempts must not be negative',
      });
    }

    if (state.version <= 0) {
      issues.push({
        code: 'INVALID_USER_VERSION',
        field: 'version',
        message: 'User version must be greater than zero',
      });
    }

    try {
      User.validatePasswordHash(state.passwordHash);
    } catch (error: unknown) {
      if (error instanceof DomainValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }

    if (issues.length > 0) {
      throw new DomainValidationError('User state is invalid', issues);
    }
  }

  private static validatePasswordHash(passwordHash: string): void {
    if (passwordHash.trim().length === 0) {
      throw new DomainValidationError('Password hash is required', [
        {
          code: 'PASSWORD_HASH_REQURIED',
          field: 'passwordHash',
          message: 'Password hash is required',
        },
      ]);
    }
  }
}
