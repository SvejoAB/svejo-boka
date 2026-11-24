export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Signs the owner's session cookie. */
  SESSION_SECRET: string;
  /** Encrypts stored Google refresh tokens. */
  TOKEN_KEY: string;
  /** Public origin used in links sent to bookers, e.g. https://boka.svejo.se */
  PUBLIC_URL: string;
  /** Resend API key (send-only). Without it, no emails are sent. */
  RESEND_API_KEY?: string;
  /** Sender address for system emails, e.g. noreply@svejo.se */
  EMAIL_FROM: string;
  /** Local development only: where Resend calls go instead of api.resend.com. */
  RESEND_MOCK_URL?: string;
  /** Local development only: base URL of the mock Google server. */
  GOOGLE_MOCK_URL?: string;
}
