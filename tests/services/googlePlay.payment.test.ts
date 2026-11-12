import { it, expect, vi, afterEach } from 'vitest';
import { GooglePlayService } from '../../src/services/googlePlay.service';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * Google Play purchase verification tests.
 *
 * Covers application and subscription validation, purchase-token verification,
 * product matching, and Google Play API failure handling.
 *
 * Google Play API responses are mocked to ensure these tests run without
 * making real external requests.
 */

// Ensures purchase verification fails closed when no subscription products
// have been configured, preventing unapproved purchases from being processed.
it('fails closed without the product allowlist', async () => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', '');

  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'app.test',
      subscriptionId: 'premium',
      purchaseToken: 'token',
    })
  ).rejects.toMatchObject({
    code: 'GOOGLE_PLAY_CONFIGURATION_MISSING',
    statusCode: 500,
  });
});

// Validate the package name and subscription ID independently before making
// any Google Play API calls. This prevents unsupported apps or products from
// reaching the external verification service.

it('rejects an unsupported package name before calling Google', async () => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

  const getClientSpy = vi.spyOn(GooglePlayService as any, 'getClient');

  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'other.app',
      subscriptionId: 'premium',
      purchaseToken: 'token',
    })
  ).rejects.toMatchObject({
    code: 'UNSUPPORTED_PACKAGE_NAME',
    statusCode: 400,
  });

  expect(getClientSpy).not.toHaveBeenCalled();
});
// Ensures only subscription products explicitly included in the configured
// allowlist can be verified.

it('rejects an unsupported subscription ID before calling Google', async () => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

  const getClientSpy = vi.spyOn(GooglePlayService as any, 'getClient');

  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'app.test',
      subscriptionId: 'other',
      purchaseToken: 'token',
    })
  ).rejects.toMatchObject({
    code: 'UNSUPPORTED_SUBSCRIPTION_ID',
    statusCode: 400,
  });

  expect(getClientSpy).not.toHaveBeenCalled();
});

// Ensure a successfully retrieved Google Play purchase belongs to the
// requested subscription product before granting entitlement.

it('rejects a Google response for a different product', async () => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');
  vi.spyOn(GooglePlayService as any, 'getClient').mockReturnValue({
    purchases: {
      subscriptionsv2: {
        get: vi.fn(async () => ({
          data: {
            subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
            lineItems: [{ productId: 'other' }],
          },
        })),
      },
    },
  });
  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'app.test',
      subscriptionId: 'premium',
      purchaseToken: 'token',
    })
  ).rejects.toMatchObject({
    code: 'PURCHASE_PRODUCT_MISMATCH',
    statusCode: 400,
  });
});

// Google Play 400/404 responses indicate that the supplied purchase token
// cannot be verified and must not result in an entitlement.

it.each([400, 404])(
  'rejects an unrecognized purchase token when Google returns %i',
  async (status) => {
    vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
    vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

    const get = vi.fn().mockRejectedValue({
      response: { status },
      message: 'Google API error',
    });

    vi.spyOn(GooglePlayService as any, 'getClient').mockReturnValue({
      purchases: { subscriptionsv2: { get } },
    });

    await expect(
      GooglePlayService.verifySubscriptionPurchase({
        packageName: 'app.test',
        subscriptionId: 'premium',
        purchaseToken: 'invalid-token',
      })
    ).rejects.toMatchObject({
      code: 'PURCHASE_TOKEN_INVALID',
      statusCode: 400,
    });
  }
);

// Distinguishes Google API authentication failures from permission failures.
// These indicate server configuration or access issues, not invalid purchases.

it.each([401, 403])(
  'treats Google authentication or permission failure (%i) as a server error',
  async (status) => {
    vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
    vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

    const get = vi.fn().mockRejectedValue({
      response: { status },
      message: 'Google API error',
    });

    vi.spyOn(GooglePlayService as any, 'getClient').mockReturnValue({
      purchases: { subscriptionsv2: { get } },
    });

    await expect(
      GooglePlayService.verifySubscriptionPurchase({
        packageName: 'app.test',
        subscriptionId: 'premium',
        purchaseToken: 'test-token',
      })
    ).rejects.toMatchObject({
      code: status === 401 ? 'GOOGLE_PLAY_AUTHENTICATION_FAILED' : 'GOOGLE_PLAY_PERMISSION_DENIED',
      statusCode: 500,
    });
  }
);

// Google Play rate limits should be treated as temporary service failures,
// allowing the client to retry later.

it('handles Google Play rate limiting', async () => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

  const get = vi.fn().mockRejectedValue({
    response: { status: 429 },
    message: 'Rate limit exceeded',
  });

  vi.spyOn(GooglePlayService as any, 'getClient').mockReturnValue({
    purchases: { subscriptionsv2: { get } },
  });

  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'app.test',
      subscriptionId: 'premium',
      purchaseToken: 'test-token',
    })
  ).rejects.toMatchObject({
    code: 'GOOGLE_PLAY_RATE_LIMITED',
    statusCode: 503,
  });
});

// Ensures requests that exceed the allowed response time are classified
// as temporary verification failures rather than invalid purchases.

it('handles Google Play request timeouts', async () => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

  const get = vi.fn().mockRejectedValue({
    response: { status: 408 },
    message: 'Request timeout',
  });

  vi.spyOn(GooglePlayService as any, 'getClient').mockReturnValue({
    purchases: { subscriptionsv2: { get } },
  });

  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'app.test',
      subscriptionId: 'premium',
      purchaseToken: 'test-token',
    })
  ).rejects.toMatchObject({
    code: 'GOOGLE_PLAY_REQUEST_TIMEOUT',
    statusCode: 503,
  });
});

// Ensures Google Play server-side failures are classified as service
// unavailability so clients can retry when the service recovers.

it.each([500, 503])('handles Google Play server errors (%i)', async (status) => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

  const get = vi.fn().mockRejectedValue({
    response: { status },
    message: 'Google server error',
  });

  vi.spyOn(GooglePlayService as any, 'getClient').mockReturnValue({
    purchases: { subscriptionsv2: { get } },
  });

  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'app.test',
      subscriptionId: 'premium',
      purchaseToken: 'test-token',
    })
  ).rejects.toMatchObject({
    code: 'GOOGLE_PLAY_UNAVAILABLE',
    statusCode: 503,
  });
});

// Ensures unexpected Google API responses receive a distinct upstream error
// classification instead of being mistaken for invalid purchase tokens.

it('handles unexpected Google Play API responses', async () => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

  const get = vi.fn().mockRejectedValue({
    response: { status: 409 },
    message: 'Unexpected Google API response',
  });

  vi.spyOn(GooglePlayService as any, 'getClient').mockReturnValue({
    purchases: { subscriptionsv2: { get } },
  });

  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'app.test',
      subscriptionId: 'premium',
      purchaseToken: 'test-token',
    })
  ).rejects.toMatchObject({
    code: 'GOOGLE_PLAY_UPSTREAM_ERROR',
    statusCode: 502,
  });
});

// Network failures prevent Google Play verification from completing.
// They should be reported as temporary service unavailability.

it('treats a network failure as a server error', async () => {
  vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME', 'app.test');
  vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS', 'premium');

  const get = vi.fn().mockRejectedValue(new Error('Network unavailable'));

  vi.spyOn(GooglePlayService as any, 'getClient').mockReturnValue({
    purchases: { subscriptionsv2: { get } },
  });

  await expect(
    GooglePlayService.verifySubscriptionPurchase({
      packageName: 'app.test',
      subscriptionId: 'premium',
      purchaseToken: 'test-token',
    })
  ).rejects.toMatchObject({
    code: 'GOOGLE_PLAY_UNAVAILABLE',
    statusCode: 503,
  });
});
