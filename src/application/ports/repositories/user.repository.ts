import type { AuditRequestContext } from '@/application/auditing/audit-request-context.js';
import type { User } from '@/domain/users/entities/user.entity.js';

export interface RecordFailedLoginInput extends AuditRequestContext {
  user: User;
  expectedVersion: number;
  applicationId: string;
  failedAt: Date;
  accountLocked: boolean;
}

export interface UserRepository {
  findById(userId: string): Promise<User | null>;

  findByNormalizedEmail(normalizedEmail: string): Promise<User | null>;

  existsByNormalizedEmail(normalizedEmail: string): Promise<boolean>;

  create(user: User): Promise<void>;

  update(user: User, expectedVersion: number): Promise<void>;

  recordFailedLogin(input: RecordFailedLoginInput): Promise<void>;
}
