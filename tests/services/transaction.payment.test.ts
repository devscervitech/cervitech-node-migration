import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  records: [] as any[],
  grant: vi.fn(async () => ({ hasPaid: true })),
  response: vi.fn(async () => ({ hasPaid: false })),
}));
vi.mock('../../src/models/TransactionRecord', () => ({
  default: class {
    static findOne = vi.fn(
      async (q: any) => state.records.find((r) => r.paymentRef === q.paymentRef) ?? null
    );
    constructor(data: any) {
      Object.assign(this, data);
    }
    async save() {
      if (!state.records.includes(this)) state.records.push(this);
      return this;
    }
  },
}));
vi.mock('../../src/services/appUserServices/appUserService.service', () => ({
  AppUserService: { grantPaidEntitlement: state.grant, getAppUserResponse: state.response },
}));
vi.mock('../../src/services/googlePlay.service', () => ({
  GooglePlayService: { verifySubscriptionPurchase: vi.fn(async () => ({ status: 'entitled' })) },
}));
vi.mock('../../src/utils/logger', () => ({ logger: { warn: vi.fn() } }));
import { TransactionService } from '../../src/services/transaction.service';

const payload = {
  paymentRef: 'fake-reference',
  purchaseToken: 'MixedCaseToken',
  packageName: 'app.test',
  subscriptionId: 'premium',
  amount: 100,
  status: 1,
  transDate: new Date('2026-11-06'),
};
beforeEach(() => {
  state.records.length = 0;
  vi.clearAllMocks();
});
describe('Payment review reproductions', () => {
  // Ensures legacy payment submissions without a Google Play purchase token are rejected.
  it('rejects payments without a verified purchase token', async () => {
    await expect(
      TransactionService.transactionRecords('user-a', {
        paymentRef: 'fake',
        amount: 100,
        status: 1,
        transDate: new Date(),
      })
    ).rejects.toMatchObject({
      code: 'PURCHASE_TOKEN_INVALID',
      statusCode: 400,
    });

    expect(state.grant).not.toHaveBeenCalled();
  });

  it('rejects zero and negative amounts with the correct error code', async () => {
    for (const amount of [0, -100]) {
      await expect(
        TransactionService.transactionRecords('user-a', { ...payload, amount })
      ).rejects.toMatchObject({
        code: 'TRANSACTION_AMOUNT_INVALID',
        statusCode: 400,
      });
    }

    expect(state.records).toHaveLength(0);
  });

  // Prevents a valid purchase token from being claimed by a second account.
  it('rejects a purchase owned by another account with a conflict error', async () => {
    await TransactionService.transactionRecords('user-a', payload);

    await expect(TransactionService.transactionRecords('user-b', payload)).rejects.toMatchObject({
      code: 'PURCHASE_ALREADY_OWNED',
      statusCode: 409,
    });
  });

  it('replays mixed-case tokens without duplicates or repeated grants', async () => {
    await TransactionService.transactionRecords('user-a', payload);
    await TransactionService.transactionRecords('user-a', payload);
    expect(state.records).toHaveLength(1);
    expect(state.grant).toHaveBeenCalledTimes(1);
  });

  // Ensures whitespace around purchase identifiers is removed before
  // Google Play verification and database storage.
  it('normalizes purchase identifiers before verification and storage', async () => {
    const { GooglePlayService } = await import('../../src/services/googlePlay.service');

    const paddedPayload = {
      ...payload,
      purchaseToken: ' MixedCaseToken ',
      packageName: ' app.test ',
      subscriptionId: ' premium ',
    };

    await TransactionService.transactionRecords('user-a', paddedPayload);

    expect(GooglePlayService.verifySubscriptionPurchase).toHaveBeenCalledWith({
      packageName: 'app.test',
      subscriptionId: 'premium',
      purchaseToken: 'MixedCaseToken',
    });

    expect(state.records).toHaveLength(1);
    expect(state.records[0]).toMatchObject({
      paymentRef: 'MixedCaseToken',
      purchaseToken: 'MixedCaseToken',
      packageName: 'app.test',
      subscriptionId: 'premium',
    });
  });

  it('updates pending status when verification completes', async () => {
    const { GooglePlayService } = await import('../../src/services/googlePlay.service');
    vi.mocked(GooglePlayService.verifySubscriptionPurchase).mockResolvedValueOnce({
      status: 'pending',
    } as any);
    await TransactionService.transactionRecords('user-a', payload);
    expect(state.grant).not.toHaveBeenCalled();
    await TransactionService.transactionRecords('user-a', payload);
    expect(state.grant).toHaveBeenCalledTimes(1);
    expect(state.records[0].status).toBe(1);
  });
});
