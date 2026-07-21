export class DuplicateRoleCodeError extends Error {
  public constructor(code: string) {
    super(`Role code ${code} already exists in this application`);

    this.name = 'DuplicateRoleCodeError';
  }
}

export class RoleNotFoundError extends Error {
  public constructor() {
    super('The role was not found');

    this.name = 'RoleNotFoundError';
  }
}

export class SystemRoleProtectedError extends Error {
  public constructor() {
    super('System roles cannot be modified');

    this.name = 'SystemRoleProtectedError';
  }
}

export class InvalidRolePermissionsError extends Error {
  public readonly invalidPermessionIds: string[];

  public constructor(invalidPermissionIds: string[]) {
    super('One or more permissions are invalid for this application');

    this.name = 'InvalidRolePermissionsError';

    this.invalidPermessionIds = invalidPermissionIds;
  }
}
