export type AuditLogOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditLogCursor {
  createdAt: Date;
  id: string;
}

export interface AuditLogRecord {
  id: string;
  applicationId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  outcome: AuditLogOutcome;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: unknown;
  errorMessage: string | null;
  createdAt: Date;
}

export interface FindAuditLogsInput {
  applicationId: string;
  limit: number;
  cursor?: AuditLogCursor;
  actorUserId?: string;
  action?: string;
  outcome?: AuditLogOutcome;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface FindAuditLogsResult {
  records: AuditLogRecord[];
  nextCursor: AuditLogCursor | null;
}

export interface AuditLogQueryRepository {
  findMany(input: FindAuditLogsInput): Promise<FindAuditLogsResult>;
}
