import type { EmailJobDataMap, EmailJobName } from '../jobs/email-job.js';

export const OUTBOX_TOPICS = {
  EMAIL: 'EMAIL',
} as const;

export type OutboxTopic = (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];

export interface CreateEmailOutboxMessageInput<TName extends EmailJobName = EmailJobName> {
  id: string;
  topic: typeof OUTBOX_TOPICS.EMAIL;
  eventType: TName;
  aggregateId: string;
  payload: EmailJobDataMap[TName];
  availableAt: Date;
  createdAt: Date;
}

export interface ClaimedOutboxMessage {
  id: string;
  topic: string;
  eventType: string;
  aggregateId: string | null;
  payload: unknown;
  attempts: number;
  createdAt: Date;
}
