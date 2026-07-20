export interface CheckPermissionInput {
  userId: string;
  applicationId: string;
  permissionCode: string;
  checkedAt: Date;
}

export interface PermissionChecker {
  hasPermission(input: CheckPermissionInput): Promise<boolean>;
}
