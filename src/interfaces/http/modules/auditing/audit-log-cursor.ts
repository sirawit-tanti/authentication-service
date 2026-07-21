import { z } from 'zod';

import type { AuditLogCursor } from '@/application/ports/repositories/audit-log-query.repository.js';

const auditLogCursorPayloadSchema = z
  .object({
    createdAt: z.iso.datetime({
      offset: true,
    }),

    id: z.uuid(),
  })
  .strict();

export class InvalidAuditLogCursorError extends Error {
  public constructor() {
    super('Invalid audit log cursor');

    this.name = 'InvalidAuditLogCursorError';
  }
}

export function encodeAuditLogCursor(cursor: AuditLogCursor): string {
  const payload = JSON.stringify({
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
  });

  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeAuditLogCursor(encodedCursor: string): AuditLogCursor {
  try {
    const decodedCursor = Buffer.from(encodedCursor, 'base64url').toString('utf8');

    const parsedJson: unknown = JSON.parse(decodedCursor);

    const validationResult = auditLogCursorPayloadSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      throw new InvalidAuditLogCursorError();
    }

    const createdAt = new Date(validationResult.data.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new InvalidAuditLogCursorError();
    }

    return {
      createdAt,

      id: validationResult.data.id,
    };
  } catch (error: unknown) {
    if (error instanceof InvalidAuditLogCursorError) {
      throw error;
    }

    throw new InvalidAuditLogCursorError();
  }
}
