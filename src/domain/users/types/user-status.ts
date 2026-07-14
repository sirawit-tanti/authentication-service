export const USER_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];
