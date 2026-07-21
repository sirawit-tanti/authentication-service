export interface FindUserAuthorizationInput {
  userId: string;
  applicationId: string;
  checkedAt: Date;
}

export interface UserAuthorizationRecord {
  roles: string[];
  permissions: string[];
}

export interface UserAuthorizationQueryRepository {
  findForUser(input: FindUserAuthorizationInput): Promise<UserAuthorizationRecord>;
}
