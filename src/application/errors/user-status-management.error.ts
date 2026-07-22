export class AdministrativeUserNotFoundError extends Error {
  public constructor() {
    super('The user was not found in this application');

    this.name = 'AdministrativeUserNotFoundError';
  }
}

export class CannotChangeOwnStatusError extends Error {
  public constructor() {
    super('You cannot change your own account status');

    this.name = 'CannotChangeOwnStatusError';
  }
}

export class DisabledUserStatusError extends Error {
  public constructor() {
    super('A disabled user cannot be reactivated or suspended');

    this.name = 'DisabledUserStatusError';
  }
}

export class UnverifiedUserActivationError extends Error {
  public constructor() {
    super('An unverified user cannot be activated');

    this.name = 'UnverifiedUserActivationError';
  }
}

export class UserStatusConflictError extends Error {
  public constructor() {
    super('The user was modified by another request');

    this.name = 'UserStatusConflictError';
  }
}
