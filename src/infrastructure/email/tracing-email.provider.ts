import { SpanKind } from '@opentelemetry/api';

import type { EmailProvider, SendEmailInput } from '@/application/ports/email/email-provider.js';
import { runTracedOperation } from '@/infrastructure/observability/trace-operation.js';

export interface TracingEmailProviderOptions {
  provider: EmailProvider;
  providerName: string;
}

export class TracingEmailProvider implements EmailProvider {
  private readonly provider: EmailProvider;

  private readonly providerName: string;

  public constructor(options: TracingEmailProviderOptions) {
    const providerName = options.providerName.trim();

    if (providerName.length === 0) {
      throw new RangeError('Email provider name must not be empty');
    }

    this.provider = options.provider;
    this.providerName = providerName;
  }

  public send(input: SendEmailInput): Promise<void> {
    return runTracedOperation(
      {
        name: 'email.send',

        kind: SpanKind.CLIENT,

        attributes: {
          'email.provider.name': this.providerName,
          'email.operation.name': 'send',
        },
      },
      async (): Promise<void> => {
        await this.provider.send(input);
      },
    );
  }
}
