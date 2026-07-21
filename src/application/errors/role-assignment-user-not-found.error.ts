export class RoleAssignmentUserNotFoundError extends Error {
  public constructor() {
    super('The target user was not found');

    this.name = 'RoleAssignmentUserNotFoundError';

    Error.captureStackTrace(this, new.target);
  }
}
