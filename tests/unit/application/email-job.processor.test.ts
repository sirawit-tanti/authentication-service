import type { EmailProvider, SendEmailInput } from '@/application/ports/email/email-provider.js';
import {
  EMAIL_JOB_NAMES,
  type SendEmailVerificationJobData,
} from '@/application/jobs/email-job.js';
import { EmailJobProcessor } from '@/application/jobs/processors/email-job.processor.js';

class FakeEmailProvider implements EmailProvider {
  public sentEmails: SendEmailInput[] = [];

  public send(input: SendEmailInput): Promise<void> {
    this.sentEmails.push(input);

    return Promise.resolve();
  }
}

describe('EmailJobProcessor', () => {
  it('processes an email verification job', async () => {
    const emailProvider = new FakeEmailProvider();

    const processor = new EmailJobProcessor({
      emailProvider,
      fromAddress: 'no-reply@example.com',
      fromName: 'Authentication Service',
      emailVerificationBaseUrl: 'http://localhost:3000/verify-email',
    });

    const jobData = {
      version: 1,
      userId: 'user-id',
      email: 'sirawit@example.com',
      verificationToken: 'secret-token',
      expiresAt: '2026-07-15T05:00:00.000Z',
    } satisfies SendEmailVerificationJobData;

    await processor.process({
      name: EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION,
      data: jobData,
    });

    expect(emailProvider.sentEmails).toHaveLength(1);

    expect(emailProvider.sentEmails[0]).toMatchObject({
      to: 'sirawit@example.com',
      subject: 'Verify your email address',
    });

    expect(emailProvider.sentEmails[0]?.text).toContain('token=secret-token');
  });

  it('rejects an unsupported payload version', async () => {
    const emailProvider = new FakeEmailProvider();

    const processor = new EmailJobProcessor({
      emailProvider,
      fromAddress: 'no-reply@example.com',
      fromName: 'Authentication Service',
      emailVerificationBaseUrl: 'http://localhost:3000/verify-email',
    });

    await expect(
      processor.process({
        name: EMAIL_JOB_NAMES.SEND_EMAIL_VERIFICATION,
        data: {
          version: 2,
          userId: 'user-id',
          email: 'sirawit@example.com',
          verificationToken: 'secret-token',
          expiresAt: '2026-07-15T05:00:00.000Z',
        },
      } as never),
    ).rejects.toThrow('Unsupported email job payload version');
  });
});
