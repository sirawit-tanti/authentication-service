import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { User } from '@/domain/users/entities/user.entity.js';
import {
  mapPrismaUserToDomain,
  mapUserToPrismaCreateData,
  type PrismaUserRecord,
} from '@/infrastructure/database/mapper/prisma-user.mapper.js';
import { DomainValidationError } from '@/domain/errors/domain-validation.error.js';

describe('PrismaUserMapper', () => {
  const createdAt = new Date('2026-07-14T00:00:00.000Z');

  function createRecord(overrides: Partial<PrismaUserRecord> = {}): PrismaUserRecord {
    return {
      id: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
      email: 'Sirawit@example.com',
      normalizedEmail: 'sirawit@example.com',
      passwordHash: 'hashed-password',
      status: 'ACTIVE',
      emailVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: createdAt,
      lastLoginAt: null,
      version: 2,
      createdAt,
      updatedAt: createdAt,
      ...overrides,
    };
  }

  it('maps a Prisma record to a domain entity', () => {
    const user = mapPrismaUserToDomain(createRecord());

    expect(user.getId()).toBe('f7ee2402-e515-47fa-b79f-c700e82b4451');
    expect(user.getEmail().value).toBe('Sirawit@example.com');
    expect(user.getEmail().normalizedValue).toBe('sirawit@example.com');
    expect(user.getStatus()).toBe('ACTIVE');
    expect(user.isEmailVerified()).toBe(true);
    expect(user.getVersion()).toBe(2);
  });

  it('maps a domain entity to create data', () => {
    const user = User.createPending({
      id: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
      email: EmailAddress.create('Sirawit@example.com'),
      passwordHash: 'hashed-password',
      now: createdAt,
    });

    const data = mapUserToPrismaCreateData(user);

    expect(data).toEqual({
      id: 'f7ee2402-e515-47fa-b79f-c700e82b4451',
      email: 'Sirawit@example.com',
      normalizedEmail: 'sirawit@example.com',
      passwordHash: 'hashed-password',
      status: 'PENDING_VERIFICATION',
      emailVerified: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: createdAt,
      lastLoginAt: null,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('rejects an unsupported stored user status', () => {
    expect(() =>
      mapPrismaUserToDomain(
        createRecord({
          status: 'UNKNOWN_STATUS',
        }),
      ),
    ).toThrow(DomainValidationError);
  });

  it('rejects inconsistent normalized email data', () => {
    expect(() =>
      mapPrismaUserToDomain(
        createRecord({
          normalizedEmail: 'another@example.com',
        }),
      ),
    ).toThrow(DomainValidationError);
  });
});
