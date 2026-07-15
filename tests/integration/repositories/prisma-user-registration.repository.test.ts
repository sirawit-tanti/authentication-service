import { EmailAddress } from '../../../src/domain/authentication/value-objects/email-address.js';
import { User } from '../../../src/domain/users/entities/user.entity.js';
import { createPrismaClient } from '../../../src/infrastructure/database/prisma-client.js';
import type { ApplicationPrismaClient } from '../../../src/infrastructure/database/prisma-client.js';
import { PrismaUserRegistrationRepository } from '../../../src/infrastructure/database/repositories/prisma-user-registration.repository.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === 'true' ? describe : describe.skip;

describeDatabase('PrismaUserRegistrationRepository', () => {
  let prisma: ApplicationPrismaClient;
  let repository: PrismaUserRegistrationRepository;

  const testEmail = 'register.user@repository-test.local';

  beforeAll(async () => {
    prisma = createPrismaClient();
    repository = new PrismaUserRegistrationRepository(prisma);

    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        normalizedEmail: testEmail,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        normalizedEmail: testEmail,
      },
    });

    await prisma.$disconnect();
  });

  it('creates a user and verification token atomically', async () => {
    const now = new Date('2026-07-14T00:00:00.000Z');

    const user = User.createPending({
      id: '381becf7-9993-43a3-b8c3-47b21133e501',
      email: EmailAddress.create(testEmail),
      passwordHash: 'hashed-password',
      now,
    });

    await repository.createRegistration({
      user,

      verificationToken: {
        id: '71df0004-1490-4161-b463-b988254d0927',
        tokenHash: 'verification-token-hash',
        expiresAt: new Date('2026-07-14T01:00:00.000Z'),
        createdAt: now,
      },
    });

    const storedUser = await prisma.user.findUnique({
      where: {
        normalizedEmail: testEmail,
      },

      include: {
        emailVerificationTokens: true,
      },
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.emailVerificationTokens).toHaveLength(1);

    expect(storedUser?.emailVerificationTokens[0]?.tokenHash).toBe('verification-token-hash');
  });
});
