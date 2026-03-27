export interface IEmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface IEmailProvider {
  send(payload: IEmailPayload): Promise<void>;
}
