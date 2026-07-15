import {
  EMAIL_JOB_NAMES,
  type EmailJobDataMap,
  type EmailJobName,
  type SendEmailVerificationJobData,
  type SendPasswordResetJobData,
} from '../email-job.js';
import type { EmailProvider } from '@/application/ports/email/email-provider.js';

export interface EmailJobProcessorOptions {
  emailProvider: EmailProvider;
  fromAddress: string;
  fromName: string;
  emailVerificationBaseUrl: string;
}

export interface ProcessEmailJobInput {
  name: EmailJobName;
  data: EmailJobDataMap[EmailJobName];
}

export class EmailJobProcessor {
  private readonly emailProvider: EmailProvider;

  private readonly fromAddress: string;

  private readonly fromName: string;

  private readonly emailVerificationBaseUrl: string;

  public constructor(options: EmailJobProcessorOptions) {
    this.emailProvider = options.emailProvider;
    this.fromAddress = options.fromAddress;
    this.fromName = options.fromName;
    this.emailVerificationBaseUrl = options.emailVerificationBaseUrl;
  }

  public async process(job: ProcessEmailJobInput): Promise<void> {
    switch (job.name) {
      case EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION:
        await this.processEmailVerification(job.data as SendEmailVerificationJobData);
        return;

      case EMAIL_JOB_NAMES.SEND_PASSWORD_RESET:
        await this.processPasswordReset(job.data as SendPasswordResetJobData);
        return;
    }
  }

  private async processEmailVerification(data: SendEmailVerificationJobData): Promise<void> {
    this.validateVersion(data.version);

    const verificationUrl = new URL(this.emailVerificationBaseUrl);

    verificationUrl.searchParams.set('token', data.verificationToken);

    await this.emailProvider.send({
      to: data.email,
      subject: 'Verify your email address',
      text: [
        `Verify your email form ${this.fromName}.`,
        `Open this link: ${verificationUrl.toString()}`,
        `This link expires at ${data.expiresAt}`,
        `Sender: ${this.fromAddress}`,
      ].join('\n'),

      html: [
        `<p>Verify your email for ${this.escapeHtml(this.fromName)}.</p>`,
        `<p><a href="${this.escapeHtml(verificationUrl.toString())}">Verify Email</a>.</p>`,
        `<p>This link expires at ${this.escapeHtml(data.expiresAt)}.</p>`,
      ].join(''),
    });
  }

  private async processPasswordReset(data: SendPasswordResetJobData): Promise<void> {
    this.validateVersion(data.version);

    await this.emailProvider.send({
      to: data.email,
      subject: 'Reset your password',
      text: [
        `Password reset token: ${data.resetToken}`,
        `This token expires at ${data.expiresAt}.`,
      ].join('\n'),

      html: [
        '<p>A password reset was requested.</p>',
        `<p>This token expires at ${this.escapeHtml(data.expiresAt)}.</p>`,
      ].join(''),
    });
  }

  private validateVersion(version: number): void {
    if (version !== 1) {
      throw new Error(`Unsupported email job payload version ${String(version)}`);
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
