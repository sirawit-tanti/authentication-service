import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { User } from '@/domain/users/entities/user.entity.js';
import { isUserStatus, type UserStatus } from '@/domain/users/types/user-status.js';
import { DomainValidationError } from '@/shared/errors/domain-validation.error.js';

export interface PrismaUserRecord {
  id: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  status: string;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaUserCreateData {
  id: string;
  email: string;
  normalizedEmail: string;
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

export interface PrismaUserUpdateData {
  email: string;
  normalizedEmail: string;
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

export class PrismaUserMapper {
  public static toDomain(record: PrismaUserRecord): User {
    if (!isUserStatus(record.status)) {
      throw new DomainValidationError('Stored user status is unsupported', [
        {
          code: 'UNSUPPORTED_USER_STATUS',
          field: 'status',
          message: `Unsupported user status: ${record.status}`,
        },
      ]);
    }

    const email = EmailAddress.create(record.email);

    if (email.normalizedValue !== record.normalizedEmail) {
      throw new DomainValidationError('Stored normalized email is inconsistent', [
        {
          code: 'INCONSISTENT_NORMALIZED_EMAIL',
          field: 'normalizedEmail',
          message: 'Stored normalized email does not match the user email',
        },
      ]);
    }

    return User.restore({
      id: record.id,
      email,
      passwordHash: record.passwordHash,
      status: record.status,
      emailVerified: record.emailVerified,
      failedLoginAttempts: record.failedLoginAttempts,
      lockedUntil: record.lockedUntil,
      passwordChangedAt: record.passwordChangedAt,
      lastLoginAt: record.lastLoginAt,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  public static toCreateData(user: User): PrismaUserCreateData {
    const state = user.toState();

    return {
      id: state.id,
      email: state.email.value,
      normalizedEmail: state.email.normalizedValue,
      passwordHash: state.passwordHash,
      status: state.status,
      emailVerified: state.emailVerified,
      failedLoginAttempts: state.failedLoginAttempts,
      lockedUntil: state.lockedUntil,
      passwordChangedAt: state.passwordChangedAt,
      lastLoginAt: state.lastLoginAt,
      version: state.version,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }

  public static toUpdateData(user: User): PrismaUserUpdateData {
    const state = user.toState();

    return {
      email: state.email.value,
      normalizedEmail: state.email.normalizedValue,
      passwordHash: state.passwordHash,
      status: state.status,
      emailVerified: state.emailVerified,
      failedLoginAttempts: state.failedLoginAttempts,
      lockedUntil: state.lockedUntil,
      passwordChangedAt: state.passwordChangedAt,
      lastLoginAt: state.lastLoginAt,
      version: state.version,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  }
}
