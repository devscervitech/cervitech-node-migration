import { google, androidpublisher_v3 } from 'googleapis';
import { logger } from '../utils/logger';
import { TransactionError } from '../utils/transactionError';

export type PlayEntitlementStatus = 'entitled' | 'pending' | 'not_entitled';

export interface PlaySubscriptionVerification {
  status: PlayEntitlementStatus;
  subscriptionState: string | null;
  expiryTimeMillis: number | null;
}

// #08: independently verifies Play purchases via the Android Publisher API
// so a modified client can't fabricate a Completed transaction. Requires a
// Google Cloud service account (Finance/Orders access in Play Console)
// configured via GOOGLE_PLAY_SERVICE_ACCOUNT_KEY -- see ENVIRONMENT_VARIABLES.md.
//
// Uses purchases.subscriptionsv2.get -- the v1 purchases.subscriptions.get
// endpoint the original ticket named has been retired by Google; v2 is the
// only one this installed googleapis version (and Google's current API)
// exposes.
export class GooglePlayService {
  private static authClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;

  static isConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY &&
        process.env.GOOGLE_PLAY_PACKAGE_NAME &&
        process.env.GOOGLE_PLAY_SUBSCRIPTION_IDS
    );
  }

  private static getAuth() {
    if (!this.authClient) {
      const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;

      if (!raw) {
        throw new TransactionError(
          'GOOGLE_PLAY_CONFIGURATION_MISSING',
          'Google Play purchase verification is not configured. The service account key is missing.',
          500
        );
      }

      let credentials: object;

      try {
        credentials = JSON.parse(raw);
      } catch {
        throw new TransactionError(
          'GOOGLE_PLAY_CREDENTIALS_INVALID',
          'Google Play service-account credentials are incorrectly formatted. A valid JSON key is required.',
          500
        );
      }

      this.authClient = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
    }

    return this.authClient;
  }

  private static getClient(): androidpublisher_v3.Androidpublisher {
    return google.androidpublisher({ version: 'v3', auth: this.getAuth() });
  }

  // subscriptionId/productId isn't needed by the v2 lookup call itself (the
  // purchase token alone identifies the purchase); it's still accepted from
  // the caller and stored on the transaction record for audit purposes.
  static async verifySubscriptionPurchase(params: {
    packageName: string;
    subscriptionId: string;
    purchaseToken: string;
  }): Promise<PlaySubscriptionVerification> {
    const expectedPackage = process.env.GOOGLE_PLAY_PACKAGE_NAME;

    const allowedProducts = (process.env.GOOGLE_PLAY_SUBSCRIPTION_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!expectedPackage) {
      throw new TransactionError(
        'GOOGLE_PLAY_CONFIGURATION_MISSING',
        'Google Play purchase verification is not configured. The application package name is missing.',
        500
      );
    }

    if (!allowedProducts.length) {
      throw new TransactionError(
        'GOOGLE_PLAY_CONFIGURATION_MISSING',
        'Google Play purchase verification is not configured. No subscription products have been allowlisted.',
        500
      );
    }

    if (params.packageName !== expectedPackage) {
      throw new TransactionError(
        'UNSUPPORTED_PACKAGE_NAME',
        'The supplied package name is not registered for this application.',
        400
      );
    }

    if (!allowedProducts.includes(params.subscriptionId)) {
      throw new TransactionError(
        'UNSUPPORTED_SUBSCRIPTION_ID',
        'The supplied subscription ID is not supported by this application.',
        400
      );
    }

    const client = this.getClient();

    let data: androidpublisher_v3.Schema$SubscriptionPurchaseV2;

    try {
      const response = await client.purchases.subscriptionsv2.get({
        packageName: params.packageName,
        token: params.purchaseToken,
      });

      data = response.data;
    } catch (error: any) {
      const httpStatus = error?.response?.status;
      const errorCode = error?.code;

      logger.warn('Play purchase verification request failed', {
        packageName: params.packageName,
        subscriptionId: params.subscriptionId,
        httpStatus,
        errorCode,
        error: error?.message,
      });

      if (httpStatus === 400 || httpStatus === 404) {
        throw new TransactionError(
          'PURCHASE_TOKEN_INVALID',
          'Google Play could not verify this purchase token. The purchase may be invalid, unrecognized, or associated with a different application.',
          400
        );
      }

      if (httpStatus === 401) {
        throw new TransactionError(
          'GOOGLE_PLAY_AUTHENTICATION_FAILED',
          'The server could not authenticate with the Google Play Developer API. Please contact support.',
          500
        );
      }

      if (httpStatus === 403) {
        throw new TransactionError(
          'GOOGLE_PLAY_PERMISSION_DENIED',
          'The configured Google service account does not have sufficient permissions to verify purchases.',
          500
        );
      }

      if (httpStatus === 429) {
        throw new TransactionError(
          'GOOGLE_PLAY_RATE_LIMITED',
          'Google Play has temporarily limited verification requests. Please retry later.',
          503
        );
      }

      if (
        httpStatus === 408 ||
        (typeof errorCode === 'string' &&
          ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNABORTED'].includes(errorCode))
      ) {
        throw new TransactionError(
          'GOOGLE_PLAY_REQUEST_TIMEOUT',
          'The request to Google Play timed out before purchase verification could be completed.',
          503
        );
      }

      if (typeof httpStatus === 'number' && httpStatus >= 500) {
        throw new TransactionError(
          'GOOGLE_PLAY_UNAVAILABLE',
          'Google Play is temporarily unavailable. Purchase verification could not be completed.',
          503
        );
      }

      if (!httpStatus) {
        throw new TransactionError(
          'GOOGLE_PLAY_UNAVAILABLE',
          'Google Play could not be reached. Purchase verification could not be completed.',
          503
        );
      }

      throw new TransactionError(
        'GOOGLE_PLAY_UPSTREAM_ERROR',
        'Google Play returned an unexpected response while verifying the purchase.',
        502
      );
    }

    if (!(data.lineItems ?? []).some((item) => item.productId === params.subscriptionId)) {
      throw new TransactionError(
        'PURCHASE_PRODUCT_MISMATCH',
        'The verified purchase does not match the requested subscription product.',
        400
      );
    }

    const expiryTimeMillis = (data.lineItems ?? [])
      .filter((item) => item.productId === params.subscriptionId)
      .reduce<number | null>((latest, item) => {
        if (!item.expiryTime) return latest;
        const t = new Date(item.expiryTime).getTime();
        if (Number.isNaN(t)) return latest;
        return latest === null ? t : Math.max(latest, t);
      }, null);
    const notExpired = expiryTimeMillis !== null && expiryTimeMillis > Date.now();

    const state = data.subscriptionState ?? null;
    let status: PlayEntitlementStatus;
    if (state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
      status = 'entitled';
    } else if (state === 'SUBSCRIPTION_STATE_CANCELED' && notExpired) {
      // Canceled just turns off auto-renew; access continues until expiry.
      status = 'entitled';
    } else if (state === 'SUBSCRIPTION_STATE_PENDING') {
      status = 'pending';
    } else {
      status = 'not_entitled';
    }

    return { status, subscriptionState: state, expiryTimeMillis };
  }
}
