import type { EmailProvider, SendEmailInput } from '@/application/ports/email/email-provider.js';

export interface DevelopmentEmailLogger {
  info(metadata: Record<string, unknown>, message: string): void;
}

export class DevelopmentEmailProvider implements EmailProvider {
  private readonly logger: DevelopmentEmailLogger;

  public constructor(logger: DevelopmentEmailLogger) {
    this.logger = logger;
  }

  public send(input: SendEmailInput): Promise<void> {
    this.logger.info(
      {
        recipient: input.to,
        subject: input.subject,
        textLength: input.text.length,
        htmlLength: input.html.length,
      },
      'Development email processed',
    );

    return Promise.resolve();
  }
}
