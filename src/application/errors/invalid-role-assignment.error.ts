export class InvalidRoleAssignmentError extends Error {
  public readonly invalidRoleIds: string[];

  public constructor(invalidRoleIds: string[]) {
    super('One or more roles are invalid for this application');

    this.name = 'InvalidRoleAssignmentError';

    this.invalidRoleIds = invalidRoleIds;
  }
}
