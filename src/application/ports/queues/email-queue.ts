import type {
  SendEmailVerificationJobData,
  SendPasswordResetJobData,
} from '@/application/jobs/email-job.js';

export interface EnqueueEmailVerificationInput extends SendEmailVerificationJobData {
  jobId: string;
}

export interface EnqueuePasswordResetInput extends SendPasswordResetJobData {
  jobId: string;
}

export interface EmailQueue {
  enqueueEmailVerification(input: EnqueueEmailVerificationInput): Promise<void>;

  enqueuePasswordReset(input: EnqueuePasswordResetInput): Promise<void>;
}
