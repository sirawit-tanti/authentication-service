export interface ValidateAccessSessionInput {
  sessionId: string;
  userId: string;
  applicationId: string;
  checkedAt: Date;
}

export interface ValidAccessSession {
  userId: string;
  email: string;
  applicationId: string;
  sessionId: string;
}

export interface AccessSessionRepository {
  findActive(input: ValidateAccessSessionInput): Promise<ValidAccessSession | null>;
}
