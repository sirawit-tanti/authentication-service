import type {
  ClaimOutboxMessagesInput,
  MarkOutboxFailedInput,
  OutboxRepository,
} from '@/application/ports/repositories/outbox.repository.js';
import type { ClaimedOutboxMessage } from '@/application/outbox/outbox-message.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

interface RawOutboxMessage {
  id: string;
  topic: string;
  eventType: string;
  aggregateId: string | null;
  payload: unknown;
  attempts: number;
  createdAt: Date;
}

export class PrismaOutboxRepository implements OutboxRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async claimPendingMessages(
    input: ClaimOutboxMessagesInput,
  ): Promise<ClaimedOutboxMessage[]> {
    return this.prisma.$transaction(
      async (transaction) => {
        const records = await transaction.$queryRaw<RawOutboxMessage[]>`
            WITH candidates AS (
              SELECT "id"
              FROM "outbox_messages"
              WHERE (
                (
                  "status" = 'PENDING'
                  AND "available_at" <= NOW()
                )
                OR (
                  "status" = 'PROCESSING'
                  AND "locked_at" <
                    NOW() - (
                      ${input.lockTimeoutMilliseconds}
                      * INTERVAL '1 millisecond'
                    )
                )
              )
              ORDER BY "created_at" ASC
              FOR UPDATE SKIP LOCKED
              LIMIT ${input.batchSize}
            )
            UPDATE "outbox_messages" AS message
            SET
              "status" = 'PROCESSING',
              "locked_at" = NOW(),
              "locked_by" = ${input.workerId},
              "updated_at" = NOW()
            FROM candidates
            WHERE message."id" = candidates."id"
            RETURNING
              message."id",
              message."topic",
              message."event_type" AS "eventType",
              message."aggregate_id" AS "aggregateId",
              message."payload",
              message."attempts",
              message."created_at" AS "createdAt"
          `;

        return records;
      },
      {
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }

  public async markPublished(messageId: string, publishedAt: Date): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: {
        id: messageId,
      },
      data: {
        status: 'PUBLISHED',
        publishedAt,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  public async markFailed(input: MarkOutboxFailedInput): Promise<void> {
    const currentMessage = await this.prisma.outboxMessage.findUnique({
      where: {
        id: input.messageId,
      },
      select: {
        attempts: true,
      },
    });

    if (currentMessage === null) {
      return;
    }

    const nextAttempts = currentMessage.attempts + 1;

    const permanentlyFailed = nextAttempts >= input.maximumAttempts;

    const commonUpdateData = {
      attempts: nextAttempts,
      lockedAt: null,
      lockedBy: null,
      lastError: input.errorMessage.slice(0, 5_000),
    };

    if (permanentlyFailed) {
      await this.prisma.outboxMessage.update({
        where: {
          id: input.messageId,
        },
        data: {
          ...commonUpdateData,
          status: 'FAILED',
        },
      });

      return;
    }

    await this.prisma.outboxMessage.update({
      where: {
        id: input.messageId,
      },
      data: {
        ...commonUpdateData,
        status: 'PENDING',
        availableAt: new Date(Date.now() + input.retryDelayMilliseconds),
      },
    });
  }
}
