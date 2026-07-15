import type { ClaimedOutboxMessage } from '@/application/outbox/outbox-message.js';

export interface ClaimOutboxMessagesInput {
  workerId: string;
  batchSize: number;
  lockTimeoutMilliseconds: number;
}

export interface MarkOutboxFailedInput {
  messageId: string;
  errorMessage: string;
  maximumAttempts: number;
  retryDelayMilliseconds: number;
}

export interface OutboxRepository {
  claimPendingMessages(input: ClaimOutboxMessagesInput): Promise<ClaimedOutboxMessage[]>;

  markPublished(messageId: string, publishedAt: Date): Promise<void>;

  markFailed(input: MarkOutboxFailedInput): Promise<void>;
}
