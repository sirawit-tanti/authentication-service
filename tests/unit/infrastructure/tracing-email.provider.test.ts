import type {
  EmailProvider,
  SendEmailInput,
} from '../../../src/application/ports/email/email-provider.js';
import { TracingEmailProvider } from '../../../src/infrastructure/email/tracing-email.provider.js';

class EmailProviderSpy implements EmailProvider {
  public sentInputs: SendEmailInput[] = [];

  public error: Error | undefined;

  public send(input: SendEmailInput): Promise<void> {
    this.sentInputs.push(input);

    if (this.error !== undefined) {
      return Promise.reject(this.error);
    }

    return Promise.resolve();
  }
}

describe('TracingEmailProvider', () => {
  it('delegates the email to the wrapped provider', async () => {
    const provider = new EmailProviderSpy();

    const tracingProvider = new TracingEmailProvider({
      provider,
      providerName: 'development',
    });

    const input: SendEmailInput = {
      to: 'user@example.com',

      subject: 'Verify your account',

      text: 'Verification message',

      html: '<p>Verification message</p>',
    };

    await tracingProvider.send(input);

    expect(provider.sentInputs).toEqual([input]);
  });

  it('preserves errors from the wrapped provider', async () => {
    const provider = new EmailProviderSpy();

    const providerError = new Error('Email delivery failed');

    provider.error = providerError;

    const tracingProvider = new TracingEmailProvider({
      provider,
      providerName: 'development',
    });

    await expect(
      tracingProvider.send({
        to: 'user@example.com',

        subject: 'Reset password',

        text: 'Reset password message',

        html: '<p>Reset password message</p>',
      }),
    ).rejects.toBe(providerError);
  });

  it('rejects an empty provider name', () => {
    const provider = new EmailProviderSpy();

    expect(
      () =>
        new TracingEmailProvider({
          provider,
          providerName: '   ',
        }),
    ).toThrow('Email provider name must not be empty');
  });
});
