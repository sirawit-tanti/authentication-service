import type {
  UserSessionRecord,
  UserSessionRepository,
} from '@/application/ports/repositories/user-session.repository.js';

export interface ListUserSessionsCommand {
  userId: string;
  currentSessionId: string;
}

export interface UserSessionResult {
  sessionId: string;
  applicationId: string;
  deviceId: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  createdAt: Date;
  current: boolean;
}

export interface ListUserSessionsResult {
  sessions: UserSessionResult[];
}

export class ListUserSessionsUseCase {
  private readonly repository: UserSessionRepository;

  public constructor(repository: UserSessionRepository) {
    this.repository = repository;
  }

  public async execute(command: ListUserSessionsCommand): Promise<ListUserSessionsResult> {
    const sessions = await this.repository.findByUserId(command.userId);

    return {
      sessions: sessions.map((session: UserSessionRecord): UserSessionResult => ({
        ...session,
        current: session.sessionId === command.currentSessionId,
      })),
    };
  }
}
