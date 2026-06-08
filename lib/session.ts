export interface OAuthTokens {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  scope?: string;
  // epoch milliseconds when the access token expires
  expires_at?: number;
}
