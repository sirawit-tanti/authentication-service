export const EMAIL_JOB_NAMES = {
  SEND_EMAIL_VERIFICATION: 'send-email-verification',
  SEND_PASSWORD_RESET: 'send-password-reset',
} as const;

export type EmailJobName = (typeof EMAIL_JOB_NAMES)[keyof typeof EMAIL_JOB_NAMES];

export interface TraceContextCarrier {
  traceparent?: string;
  tracestate?: string;
}

interface TraceableEmailJobData {
  traceContext?: TraceContextCarrier;
}

export interface SendEmailVerificationJobData extends TraceableEmailJobData {
  version: 1;
  userId: string;
  email: string;
  verificationToken: string;
  expiresAt: string;
}

export interface SendPasswordResetJobData extends TraceableEmailJobData {
  version: 1;
  userId: string;
  email: string;
  resetToken: string;
  expiresAt: string;
}

export interface EmailJobDataMap {
  [EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION]: SendEmailVerificationJobData;
  [EMAIL_JOB_NAMES.SEND_PASSWORD_RESET]: SendPasswordResetJobData;
}
