import { google, androidpublisher_v3 } from 'googleapis';
import { logger } from '../utils/logger';
import { CustomException } from '../utils/customException';

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
    return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_PLAY_PACKAGE_NAME && process.env.GOOGLE_PLAY_SUBSCRIPTION_IDS);
  }

  private static getAuth() {
    if (!this.authClient) {
      const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;
      if (!raw) {
        throw new Error(
          'GOOGLE_PLAY_SERVICE_ACCOUNT_KEY is not set. Play purchase verification requires a ' +
            'Google Cloud service account (Finance/Orders access in Play Console) configured as a secret.'
        );
      }

      let credentials: object;
      try {
        credentials = JSON.parse(raw);
      } catch {
        throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY must be the service account JSON key.');
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
      .split(',').map(value => value.trim()).filter(Boolean);
    if (!expectedPackage || !allowedProducts.length) {
      throw new Error('Google Play package and subscription allowlist must be configured.');
    }
    if (params.packageName !== expectedPackage || !allowedProducts.includes(params.subscriptionId)) {
      throw new CustomException('Unsupported Google Play package or subscription.');
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
      const httpStatus = error?.response?.status ?? error?.code;
      logger.warn('Play purchase verification request failed', {
        packageName: params.packageName,
        subscriptionId: params.subscriptionId,
        httpStatus,
        error: error?.message,
      });

      // Google returns 400/404 for a token it doesn't recognize (invalid or
      // forged); anything else (auth/permission/network) is our problem, not
      // the client's, so it shouldn't be reported back as a bad request.
      if (httpStatus === 400 || httpStatus === 404) {
        throw new CustomException('Purchase token could not be verified with Google Play.');
      }
      throw new Error('Play purchase verification request failed.');
    }

    if (!(data.lineItems ?? []).some(item => item.productId === params.subscriptionId)) {
      throw new CustomException('Purchase does not match the requested subscription.');
    }
    const expiryTimeMillis = (data.lineItems ?? []).filter(item => item.productId === params.subscriptionId).reduce<number | null>((latest, item) => {
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
