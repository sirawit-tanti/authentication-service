import { PrismaUserRepository } from '@/infrastructure/database/repositories/prisma-user.repository.js';
import {
  createPrismaClient,
  type ApplicationPrismaClient,
} from '../../../src/infrastructure/database/prisma-client.js';

import { OptimisticConcurrencyError } from '@/application/errors/optimistic-concurrency.error.js';
import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { User } from '@/domain/users/entities/user.entity.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === 'true' ? describe : describe.skip;

describeDatabase('PrismaUserRepository', () => {
  let prisma: ApplicationPrismaClient;
  let repository: PrismaUserRepository;

  beforeAll(async () => {
    prisma = createPrismaClient();
    repository = new PrismaUserRepository(prisma);

    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@repository-test.local',
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@repository-test.local',
        },
      },
    });

    await prisma.$disconnect();
  });

  it('creates and retrieves a user by normalized email', async () => {
    const now = new Date('2026-07-14T00:00:00.000Z');

    const user = User.createPending({
      id: '7c5359f1-937a-42d6-bdf5-e36250592f65',
      email: EmailAddress.create('Repository.User@repository-test.local'),
      passwordHash: 'hashed-password',
      now,
    });

    await repository.create(user);

    const foundUser = await repository.findByNormalizedEmail(
      'repository.user@repository-test.local',
    );

    expect(foundUser).not.toBeNull();
    expect(foundUser?.getId()).toBe(user.getId());
    expect(foundUser?.getStatus()).toBe('PENDING_VERIFICATION');
  });

  it('checks whether a normalized email exists', async () => {
    const now = new Date('2026-07-14T00:00:00.000Z');

    const user = User.createPending({
      id: '1fd8b700-98bd-4ddd-8a17-5a013a51843e',
      email: EmailAddress.create('Exists.User@repository-test.local'),
      passwordHash: 'hashed-password',
      now,
    });

    await repository.create(user);

    await expect(
      repository.existsByNormalizedEmail('exists.user@repository-test.local'),
    ).resolves.toBe(true);

    await expect(
      repository.existsByNormalizedEmail('missing.user@repository-test.local'),
    ).resolves.toBe(false);
  });

  it('updates a user using optimistic concurrency control', async () => {
    const createdAt = new Date('2026-07-14T00:00:00.000Z');

    const user = User.createPending({
      id: '250b0b33-a9dc-435e-b81d-f3c289a1d3e9',
      email: EmailAddress.create('Update.User@repository-test.local'),
      passwordHash: 'hashed-password',
      now: createdAt,
    });

    await repository.create(user);

    const expectedVersion = user.getVersion();

    user.verifyEmail(new Date('2026-07-14T01:00:00.000Z'));

    await repository.update(user, expectedVersion);

    const updatedUser = await repository.findById(user.getId());

    expect(updatedUser?.getStatus()).toBe('ACTIVE');
    expect(updatedUser?.isEmailVerified()).toBe(true);
    expect(updatedUser?.getVersion()).toBe(2);
  });

  it('rejects an update with an outdated version', async () => {
    const createdAt = new Date('2026-07-14T00:00:00.000Z');

    const user = User.createPending({
      id: '904e3752-9d7c-463d-bc19-dce0791b8ba3',
      email: EmailAddress.create('Conflict.User@repository-test.local'),
      passwordHash: 'hashed-password',
      now: createdAt,
    });

    await repository.create(user);

    user.verifyEmail(new Date('2026-07-14T01:00:00.000Z'));

    await expect(repository.update(user, 999)).rejects.toBeInstanceOf(OptimisticConcurrencyError);
  });
});
