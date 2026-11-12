export type TransactionErrorCode =
  // Client and purchase errors
  | 'TRANSACTION_DATA_MISSING'
  | 'TRANSACTION_AMOUNT_INVALID'
  | 'UNSUPPORTED_PACKAGE_NAME'
  | 'UNSUPPORTED_SUBSCRIPTION_ID'
  | 'PURCHASE_TOKEN_INVALID'
  | 'PURCHASE_PRODUCT_MISMATCH'
  | 'PURCHASE_ALREADY_OWNED'

  // Google Play configuration and authentication
  | 'GOOGLE_PLAY_CONFIGURATION_MISSING'
  | 'GOOGLE_PLAY_CREDENTIALS_INVALID'
  | 'GOOGLE_PLAY_AUTHENTICATION_FAILED'
  | 'GOOGLE_PLAY_PERMISSION_DENIED'

  // Google Play availability and upstream errors
  | 'GOOGLE_PLAY_RATE_LIMITED'
  | 'GOOGLE_PLAY_UNAVAILABLE'
  | 'GOOGLE_PLAY_REQUEST_TIMEOUT'
  | 'GOOGLE_PLAY_UPSTREAM_ERROR'

  // Unexpected errors
  | 'TRANSACTION_INTERNAL_ERROR';

export type TransactionErrorStatus = 400 | 409 | 500 | 502 | 503;

export class TransactionError extends Error {
  constructor(
    public readonly code: TransactionErrorCode,
    message: string,
    public readonly statusCode: TransactionErrorStatus
  ) {
    super(message);

    this.name = 'TransactionError';

    Object.setPrototypeOf(this, TransactionError.prototype);
  }
}
