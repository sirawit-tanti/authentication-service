export class AdministrativeUserNotFoundError extends Error {
  public constructor() {
    super('The user was not found in this application');

    this.name = 'AdministrativeUserNotFoundError';
  }
}
