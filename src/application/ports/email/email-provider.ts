export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<void>;
}
