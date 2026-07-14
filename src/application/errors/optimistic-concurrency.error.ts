export class OptimisticConcurrencyError extends Error {
  public readonly entityName: string;

  public readonly entityId: string;

  public constructor(entityName: string, entityId: string) {
    super(`${entityName} "${entityId}" was modified by another operation`);

    this.name = 'OptimisticConcurrencyError';
    this.entityName = entityName;
    this.entityId = entityId;

    Error.captureStackTrace(this, new.target);
  }
}
