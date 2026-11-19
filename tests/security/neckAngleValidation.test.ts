import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  postBatch: vi.fn(),
  postRandomBatch: vi.fn(),
}));

vi.mock('../../src/services/appUserServices/neckAngle.service', () => ({
  NeckAngleService: {
    postBatchNeckAngleRecordAsync: (...args: unknown[]) => service.postBatch(...args),
    postRandomBatchNeckAngleRecordForTestAsync: (...args: unknown[]) =>
      service.postRandomBatch(...args),
  },
}));

import { NeckAngleController } from '../../src/controllers/neckAngle.controller';
import { swaggerSpec } from '../../src/config/swagger';

const makeResponse = () => {
  const response: any = {};
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
};

const appUserRequest = (body: unknown) => ({
  user: { userId: 'authenticated-user', role: 'APP_USER' },
  body,
});

describe('neck-angle batch request validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.postBatch.mockResolvedValue(true);
    service.postRandomBatch.mockResolvedValue(true);
  });

  it('publishes the Joi limits and fields in the OpenAPI component schemas', () => {
    const schemas = (swaggerSpec as any).components.schemas;

    expect(schemas.NeckAngleBatchRequest.properties.neckAngleRecords.maxItems).toBe(100);
    expect(schemas.RandomNeckAngleBatchRequest.properties.numberOfRecords.maximum).toBe(30);
    expect(schemas.RandomNeckAngleBatchRequest.required).toEqual(
      expect.arrayContaining(['appUserId', 'startDate', 'endDate', 'numberOfRecords'])
    );
  });

  it('caps app-user batches and rejects them before service/database work', async () => {
    const response = makeResponse();
    await NeckAngleController.postBatchNeckAngleRecords(
      appUserRequest({
        neckAngleRecords: Array.from({ length: 101 }, () => ({
          angle: 45,
          dateTimeRecorded: '2026-10-01T12:00:00.000Z',
        })),
      }) as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(service.postBatch).not.toHaveBeenCalled();
  });

  it('rejects missing or invalid record values before calling the service', async () => {
    const response = makeResponse();
    await NeckAngleController.postBatchNeckAngleRecords(
      appUserRequest({
        neckAngleRecords: [{ angle: 'not-a-number', dateTimeRecorded: 'not-a-date' }],
      }) as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(service.postBatch).not.toHaveBeenCalled();
  });

  it('takes ownership from the token and passes only fields used for persistence', async () => {
    const response = makeResponse();
    await NeckAngleController.postBatchNeckAngleRecords(
      appUserRequest({
        appUserId: 'attacker-selected-user',
        neckAngleRecords: [
          {
            appUserId: 'attacker-selected-user',
            angle: 45,
            craniumVertebralAngle: 999,
            counter: 999,
            dateTimeRecorded: '2026-10-01T12:00:00.000Z',
          },
        ],
      }) as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(service.postBatch).toHaveBeenCalledWith({
      neckAngleRecords: [
        {
          appUserId: 'authenticated-user',
          angle: 45,
          dateTimeRecorded: new Date('2026-10-01T12:00:00.000Z'),
        },
      ],
    });
  });
});

describe('random neck-angle test request validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.postRandomBatch.mockResolvedValue(true);
  });

  it.each([
    { appUserId: 'user-1', startDate: '2026-10-02T00:00:00Z', endDate: '2026-10-01T00:00:00Z', numberOfRecords: 1 },
    { appUserId: 'user-1', startDate: '2026-10-01T00:00:00Z', endDate: '2026-10-02T00:00:00Z', numberOfRecords: 0 },
    { appUserId: 'user-1', startDate: '2026-10-01T00:00:00Z', endDate: '2026-10-02T00:00:00Z', numberOfRecords: 31 },
    { appUserId: 'user-1', startDate: 'invalid', endDate: '2026-10-02T00:00:00Z', numberOfRecords: 1 },
  ])('rejects invalid random batch parameters', async (body) => {
    const response = makeResponse();
    await NeckAngleController.postRandomTestBatchNeckAngleRecords({ body } as any, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(service.postRandomBatch).not.toHaveBeenCalled();
  });

  it('accepts the fields consumed by the service and no longer requires ignored testValues', async () => {
    const response = makeResponse();
    await NeckAngleController.postRandomTestBatchNeckAngleRecords(
      {
        body: {
          appUserId: 'user-1',
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-02T00:00:00.000Z',
          numberOfRecords: 30,
        },
      } as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(service.postRandomBatch).toHaveBeenCalledWith({
      appUserId: 'user-1',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-02T00:00:00.000Z'),
      numberOfRecords: 30,
    });
  });

  it('rejects the old body with unused testValues instead of silently generating zero records', async () => {
    const response = makeResponse();
    await NeckAngleController.postRandomTestBatchNeckAngleRecords(
      { body: { appUserId: 'user-1', testValues: [] } } as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(service.postRandomBatch).not.toHaveBeenCalled();
  });
});
