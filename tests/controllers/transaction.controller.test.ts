import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionError } from '../../src/utils/transactionError';

const transactionRecords = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/transaction.service', () => ({
  TransactionService: {
    transactionRecords,
  },
}));

import { TransactionController } from '../../src/controllers/transaction.controller';

const makeRes = () => {
  const res: any = { statusCode: 0, body: null };

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });

  return res;
};

const makeReq = (userId?: string, body: any = { purchaseToken: 'test-token' }) =>
  ({
    user: userId ? { userId } : undefined,
    body,
  }) as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TransactionController.createTransactionRecord', () => {
  // Ensures users without a valid authenticated session cannot create transactions.
  it('returns 401 when the user is not authenticated', async () => {
    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq(), res);

    expect(res.statusCode).toBe(401);
    expect(transactionRecords).not.toHaveBeenCalled();
  });

  // Ensures the controller rejects requests without transaction data
  // before passing anything to the transaction service.

  it('returns 400 when transaction data is missing', async () => {
    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq('user-a', null), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'Transaction data is required.',
      code: 'TRANSACTION_DATA_MISSING',
    });
    expect(transactionRecords).not.toHaveBeenCalled();
  });

  // Ensures successful transaction creation returns HTTP 201 and the service result.
  it('returns 201 when the transaction is created successfully', async () => {
    const result = { success: true, message: 'Transaction created' };
    transactionRecords.mockResolvedValueOnce(result);

    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq('user-a'), res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(result);
    expect(transactionRecords).toHaveBeenCalledWith('user-a', { purchaseToken: 'test-token' });
  });

  // Ensures invalid Google Play purchase tokens are returned with
  // the appropriate transaction error code and HTTP status.
  it('returns 400 for an invalid purchase token', async () => {
    transactionRecords.mockRejectedValueOnce(
      new TransactionError(
        'PURCHASE_TOKEN_INVALID',
        'Google Play could not verify this purchase token.',
        400
      )
    );

    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq('user-a'), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'Google Play could not verify this purchase token.',
      code: 'PURCHASE_TOKEN_INVALID',
    });
  });

  // Ensures purchase ownership conflicts are returned as HTTP 409
  // rather than being treated as ordinary invalid requests.
  it('returns 409 when a purchase belongs to another account', async () => {
    transactionRecords.mockRejectedValueOnce(
      new TransactionError(
        'PURCHASE_ALREADY_OWNED',
        'This purchase is already associated with a different account.',
        409
      )
    );

    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq('user-a'), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: 'This purchase is already associated with a different account.',
      code: 'PURCHASE_ALREADY_OWNED',
    });
  });

  // Ensures Google API authentication failures retain their specific error
  // classification while preventing internal server details from reaching clients.
  it('returns 500 when Google authentication fails', async () => {
    transactionRecords.mockRejectedValueOnce(
      new TransactionError(
        'GOOGLE_PLAY_AUTHENTICATION_FAILED',
        'The server could not authenticate with the Google Play Developer API. Please contact support.',
        500
      )
    );

    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq('user-a'), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error:
        'The server could not authenticate with the Google Play Developer API. Please contact support.',
      code: 'GOOGLE_PLAY_AUTHENTICATION_FAILED',
    });
  });

  // Ensures temporary Google Play connectivity failures return the appropriate
  // service-unavailable status and error classification.
  it('returns 503 when Google Play is unavailable', async () => {
    transactionRecords.mockRejectedValueOnce(
      new TransactionError(
        'GOOGLE_PLAY_UNAVAILABLE',
        'Google Play could not be reached. Purchase verification could not be completed.',
        503
      )
    );

    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq('user-a'), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: 'Google Play could not be reached. Purchase verification could not be completed.',
      code: 'GOOGLE_PLAY_UNAVAILABLE',
    });
  });

  it('returns 400 when the service returns no transaction', async () => {
    transactionRecords.mockResolvedValueOnce(null);

    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq('user-a'), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Failed to create transaction record.');
  });

  // Ensures unexpected errors are handled safely without exposing internal
  // implementation details to the client.
  it('returns a generic 500 response for unexpected errors', async () => {
    transactionRecords.mockRejectedValueOnce(
      new Error('Unexpected database implementation detail')
    );

    const res = makeRes();

    await TransactionController.createTransactionRecord(makeReq('user-a'), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: 'Internal server error',
      code: 'TRANSACTION_INTERNAL_ERROR',
    });

    expect(res.body.error).not.toContain('database implementation detail');
  });
});
