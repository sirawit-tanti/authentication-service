import { EmailAddress } from '@/domain/authentication/value-objects/email-address.js';
import { User } from '@/domain/users/entities/user.entity.js';
import {
  createPrismaClient,
  type ApplicationPrismaClient,
} from '@/infrastructure/database/prisma-client.js';
import { PrismaUserRegistrationRepository } from '@/infrastructure/database/repositories/prisma-user-registration.repository.js';

const describeDatabase = process.env.RUN_DATABASE_TESTS === 'true' ? describe : describe.skip;

describeDatabase('PrismaUserRegistrationRepository', () => {
  let prisma: ApplicationPrismaClient;
  let repository: PrismaUserRegistrationRepository;

  const userId = '381becf7-9993-43a3-b8c3-47b21133e501';

  const verificationTokenId = '71df0004-1490-4161-b463-b988254d0927';

  const outboxMessageId = '6dfb09cb-6d9b-4e64-b86c-e954359057b6';

  const testEmail = 'register.user@repository-test.local';

  async function cleanupTestData(): Promise<void> {
    await prisma.outboxMessage.deleteMany({
      where: {
        OR: [
          {
            id: outboxMessageId,
          },
          {
            aggregateId: userId,
          },
        ],
      },
    });

    await prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          {
            id: verificationTokenId,
          },
          {
            userId,
          },
        ],
      },
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          {
            id: userId,
          },
          {
            normalizedEmail: testEmail,
          },
        ],
      },
    });
  }

  beforeAll(async () => {
    prisma = createPrismaClient();

    repository = new PrismaUserRegistrationRepository(prisma);

    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('creates a user, verification token, and outbox message atomically', async () => {
    const now = new Date('2026-07-14T00:00:00.000Z');

    const verificationExpiresAt = new Date('2026-07-14T01:00:00.000Z');

    const user = User.createPending({
      id: userId,
      email: EmailAddress.create(testEmail),
      passwordHash: 'hashed-password',
      now,
    });

    await repository.createRegistration({
      user,

      verificationToken: {
        id: verificationTokenId,
        tokenHash: 'verification-token-hash',
        expiresAt: verificationExpiresAt,
        createdAt: now,
      },

      outboxMessage: {
        id: outboxMessageId,
        topic: 'EMAIL',
        eventType: 'send-email-verification',
        aggregateId: user.getId(),

        payload: {
          version: 1,
          userId: user.getId(),
          email: testEmail,
          verificationToken: 'raw-verification-token',
          expiresAt: verificationExpiresAt.toISOString(),
        },

        availableAt: now,
        createdAt: now,
      },
    });

    const storedUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.normalizedEmail).toBe(testEmail);
    expect(storedUser?.status).toBe('PENDING_VERIFICATION');

    const storedVerificationToken = await prisma.emailVerificationToken.findUnique({
      where: {
        id: verificationTokenId,
      },
    });

    expect(storedVerificationToken).not.toBeNull();
    expect(storedVerificationToken?.userId).toBe(userId);
    expect(storedVerificationToken?.tokenHash).toBe('verification-token-hash');
    expect(storedVerificationToken?.expiresAt).toEqual(verificationExpiresAt);

    const storedOutboxMessage = await prisma.outboxMessage.findUnique({
      where: {
        id: outboxMessageId,
      },
    });

    expect(storedOutboxMessage).not.toBeNull();
    expect(storedOutboxMessage?.topic).toBe('EMAIL');
    expect(storedOutboxMessage?.eventType).toBe('send-email-verification');
    expect(storedOutboxMessage?.aggregateId).toBe(userId);
    expect(storedOutboxMessage?.status).toBe('PENDING');
    expect(storedOutboxMessage?.attempts).toBe(0);
    expect(storedOutboxMessage?.availableAt).toEqual(now);

    expect(storedOutboxMessage?.payload).toEqual({
      version: 1,
      userId,
      email: testEmail,
      verificationToken: 'raw-verification-token',
      expiresAt: verificationExpiresAt.toISOString(),
    });
  });
});
