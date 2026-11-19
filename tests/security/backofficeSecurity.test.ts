import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/EmailService/emailutils', () => ({
  EmailUtils: { sendPasswordResetOtpEmail: vi.fn() },
}));

import BackofficeUser from '../../src/models/BackOfficeUser';
import BackofficeUserService from '../../src/services/backofficeuser.service';
import backofficeUserService from '../../src/services/backofficeuser.service';
import BackOfficeUserController from '../../src/controllers/backOfficeUser.controller';
import backOfficeUserRoutes from '../../src/routes/backOfficeUser.routes';
import usersRoutes from '../../src/routes/users.routes';
import authRoutes from '../../src/routes/auth.routes';
import goalsRoutes from '../../src/routes/goals.routes';
import transactionRoutes from '../../src/routes/transaction.routes';
import neckAngleRoutes from '../../src/routes/neckAngle.routes';
import fcmRoutes from '../../src/routes/fcm.routes';
import { NeckAngleController } from '../../src/controllers/neckAngle.controller';
import { NeckAngleService } from '../../src/services/appUserServices/neckAngle.service';
import { HashUtil } from '../../src/utils/hash';
import { normalizePassword, verifyPasswordInput } from '../../src/utils/password.util';
import { OtpService } from '../../src/services/otp.service';
import BackofficeSecurityState, {
  ACTIVE_BACKOFFICE_ADMIN_STATE_ID,
} from '../../src/models/BackofficeSecurityState';
import {
  authorizeRole,
  requireAccessLevel,
  requireWritable,
} from '../../src/middlewares/auth.middleware';
import { BACKOFFICE_ACCESS_LEVEL, BACKOFFICE_ACCESS_LEVELS } from '../../src/enums/backofficeAccessLevel';
import {
  backofficeChangePasswordSchema,
  backofficeLoginSchema,
  backofficeVerifyResetOtpSchema,
  updateBackofficeAccessSchema,
  updateBackofficeProfileSchema,
} from '../../src/validation/schemas/backOfficeUser.schema';
import { loginSchema, signupSchema } from '../../src/validation/schemas/auth.schema';
import { validateBackofficeInput } from '../../src/validation/backOfficeUserValidation';

afterEach(() => vi.restoreAllMocks());

function makeResponse() {
  const response: any = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

function userWithSecrets() {
  return {
    _id: { toString: () => 'backoffice-id' },
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    telephone: '123456789',
    username: 'ada',
    accessLevel: 'OPERATOR',
    readOnly: false,
    dateRegistered: new Date('2024-01-01T00:00:00Z'),
    password: '$2b$10$hash',
    resetToken: 'reset-secret',
    resetTokenExpires: new Date('2025-01-01T00:00:00Z'),
  };
}

describe('back-office password and account data security', () => {
  it('keeps OTPs as six-character strings, including leading zeroes', () => {
    const stringOtp = validateBackofficeInput<{ email: string; otp: string }>(
      backofficeVerifyResetOtpSchema,
      { email: 'ada@example.com', otp: '000123' }
    );
    const numericOtp = validateBackofficeInput<{ email: string; otp: string }>(
      backofficeVerifyResetOtpSchema,
      { email: 'ada@example.com', otp: 123 }
    );

    expect(stringOtp.error).toBeNull();
    expect(stringOtp.value?.otp).toBe('000123');
    expect(numericOtp.error).toContain('OTP must be a 6-digit code');
  });

  it('requires currentPassword and rejects unrecognized password-change fields', () => {
    const missingCurrentPassword = validateBackofficeInput(
      backofficeChangePasswordSchema,
      { newPassword: 'StrongPass1!' }
    );
    const extraField = validateBackofficeInput(
      backofficeChangePasswordSchema,
      { currentPassword: 'old', newPassword: 'StrongPass1!', accessLevel: 'admin' }
    );

    expect(missingCurrentPassword.error).toContain('Current password is required');
    expect(extraField.error).toContain('Field accessLevel is not allowed');
  });

  it('removes all whitespace from passwords during validation and normalization', async () => {
    const password = ' Strong Pass1! ';
    const backoffice = validateBackofficeInput<{ currentPassword: string; newPassword: string }>(
      backofficeChangePasswordSchema,
      { currentPassword: ' old password ', newPassword: password }
    );
    const backofficeLogin = validateBackofficeInput<{ username: string; password: string }>(
      backofficeLoginSchema,
      { username: 'ada', password }
    );
    const appPassword = signupSchema.extract('password').validate(password, { convert: true });
    const appLoginPassword = loginSchema.extract('password').validate(password, { convert: true });
    const normalizedPassword = normalizePassword(password);
    const hash = await HashUtil.hash(normalizedPassword);

    expect(backoffice.error).toBeNull();
    expect(backoffice.value?.currentPassword).toBe('oldpassword');
    expect(backoffice.value?.newPassword).toBe(normalizedPassword);
    expect(backofficeLogin.value?.password).toBe(normalizedPassword);
    expect(appPassword.error).toBeUndefined();
    expect(appPassword.value).toBe(normalizedPassword);
    expect(appLoginPassword.error).toBeUndefined();
    expect(appLoginPassword.value).toBe(normalizedPassword);
    expect(await HashUtil.compare(normalizedPassword, hash)).toBe(true);
    expect(await HashUtil.compare(password, hash)).toBe(false);

    const whitespaceOnly = validateBackofficeInput(backofficeChangePasswordSchema, {
      currentPassword: '   ',
      newPassword: '   ',
    });
    expect(whitespaceOnly.error).not.toBeNull();
  });

  it('allows one exact legacy password login and returns its whitespace-free replacement', async () => {
    const legacyPassword = ' Legacy Pass1! ';
    const legacyHash = await HashUtil.hash(legacyPassword);

    const result = await verifyPasswordInput(legacyPassword, legacyHash);

    expect(result).toEqual({
      isValid: true,
      normalizedPassword: 'LegacyPass1!',
      needsRehash: true,
    });
    const normalizedHash = await HashUtil.hash(result.normalizedPassword);
    expect(await HashUtil.compare('LegacyPass1!', normalizedHash)).toBe(true);
  });

  it('hashes a whitespace-free password even when account creation is called directly', async () => {
    const hash = vi.spyOn(HashUtil, 'hash').mockResolvedValue('$2b$10$normalized');
    vi.spyOn(BackofficeUser.prototype, 'save').mockResolvedValue({} as any);

    await BackofficeUserService.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      telephone: '123456789',
      username: 'ada',
      password: ' Strong Pass1! ',
      accessLevel: 'OPERATOR',
      readOnly: false,
    });

    expect(hash).toHaveBeenCalledWith('StrongPass1!');
  });

  it('rejects protected fields on profile updates', () => {
    const result = validateBackofficeInput(updateBackofficeProfileSchema, {
      firstName: 'Ada',
      password: 'attacker-value',
      accessLevel: 'administrator',
      readOnly: false,
      $set: { password: 'attacker-value' },
    });

    expect(result.error).toContain('Field password is not allowed');
    expect(result.error).toContain('Field accessLevel is not allowed');
    expect(result.error).toContain('Field readOnly is not allowed');
    expect(result.error).toContain('Field $set is not allowed');
  });

  it('accepts only ADMIN and OPERATOR access levels', () => {
    const normalized = validateBackofficeInput<{ accessLevel?: string }>(
      updateBackofficeAccessSchema,
      { accessLevel: ' admin ' }
    );
    const invalid = validateBackofficeInput(
      updateBackofficeAccessSchema,
      { accessLevel: 'SUPERUSER' }
    );

    expect(normalized.value?.accessLevel).toBe(BACKOFFICE_ACCESS_LEVEL.ADMIN);
    expect(invalid.error).toContain('Access level must be ADMIN or OPERATOR');
    expect(BACKOFFICE_ACCESS_LEVELS).toEqual(['ADMIN', 'OPERATOR']);
    expect(BackofficeUser.schema.path('accessLevel')?.options.enum).toEqual(
      BACKOFFICE_ACCESS_LEVELS
    );
  });

  it('keeps the profile service update allowlist even if called with extra fields', async () => {
    const updated = userWithSecrets();
    const update = vi.spyOn(BackofficeUser, 'findByIdAndUpdate').mockResolvedValue(updated as any);

    await BackofficeUserService.update('backoffice-id', {
      firstName: 'Augusta',
      password: 'attacker-value',
      accessLevel: 'administrator',
      readOnly: false,
    } as any);

    expect(update.mock.calls[0][1]).toEqual({ firstName: 'Augusta' });
  });

  it('does not return an OTP even if the OTP service returns one in debug mode', async () => {
    vi.spyOn(BackofficeUser, 'findOne').mockResolvedValue({
      email: 'ada@example.com',
      username: 'ada',
    } as any);
    vi.spyOn(OtpService, 'issueResetCode').mockResolvedValue({ code: '001234' });

    const result = await BackofficeUserService.sendPasswordResetToken('ada@example.com');

    expect(result).toEqual({ message: OtpService.genericMessage() });
    expect(result).not.toHaveProperty('otp');
    expect(result).not.toHaveProperty('code');
  });

  it('returns the same public reset response for unknown email addresses', async () => {
    vi.spyOn(BackofficeUser, 'findOne').mockResolvedValue(null as any);

    const result = await BackofficeUserService.sendPasswordResetToken('missing@example.com');

    expect(result).toEqual({ message: OtpService.genericMessage() });
  });

  it('verifies the current password before saving a new password', async () => {
    const user: any = { password: '$2b$10$old', save: vi.fn().mockResolvedValue(undefined) };
    const query = { select: vi.fn().mockResolvedValue(user) };
    vi.spyOn(BackofficeUser, 'findById').mockReturnValue(query as any);
    vi.spyOn(HashUtil, 'compare').mockResolvedValue(false);

    const result = await BackofficeUserService.changePassword('backoffice-id', 'wrong', 'StrongPass1!');

    expect(result).toEqual({ status: 'incorrect_current_password' });
    expect(HashUtil.compare).toHaveBeenCalledWith('wrong', '$2b$10$old');
    expect(user.save).not.toHaveBeenCalled();
  });

  it('changes the password only after the current password matches', async () => {
    const user: any = { password: '$2b$10$old', save: vi.fn().mockResolvedValue(undefined) };
    const query = { select: vi.fn().mockResolvedValue(user) };
    vi.spyOn(BackofficeUser, 'findById').mockReturnValue(query as any);
    vi.spyOn(HashUtil, 'compare').mockResolvedValue(true);
    vi.spyOn(HashUtil, 'hash').mockResolvedValue('$2b$10$new');

    const result = await BackofficeUserService.changePassword(
      'backoffice-id',
      'correct-current',
      'StrongPass1!'
    );

    expect(result).toEqual({ status: 'changed' });
    expect(user.password).toBe('$2b$10$new');
    expect(user.save).toHaveBeenCalledOnce();
  });

  it('hides password and reset fields from back-office read responses', async () => {
    vi.spyOn(backofficeUserService, 'getAll').mockResolvedValue([userWithSecrets()] as any);
    const response = makeResponse();

    await BackOfficeUserController.getUsers({ query: {}, params: {} } as any, response);

    const payload = response.json.mock.calls[0][0];
    expect(payload.data[0]).toMatchObject({ id: 'backoffice-id', username: 'ada' });
    expect(payload.data[0]).not.toHaveProperty('password');
    expect(payload.data[0]).not.toHaveProperty('resetToken');
    expect(payload.data[0]).not.toHaveProperty('resetTokenExpires');
  });

  it('does not expose internal login errors in API responses', async () => {
    vi.spyOn(backofficeUserService, 'loginService').mockRejectedValue(
      new Error('Mongo connection details')
    );
    const response = makeResponse();

    await BackOfficeUserController.loginController(
      { body: { username: 'ada', password: 'some-password' } } as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json.mock.calls[0][0]).not.toHaveProperty('error');
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('Mongo connection details');
  });

  it('marks the password hash as excluded by default in the Mongoose schema', () => {
    expect(BackofficeUser.schema.path('password')?.options.select).toBe(false);
    expect(BackofficeUser.schema.path('password')?.options.required).toBe(true);
    expect(BackofficeUser.schema.path('resetToken')?.options.select).toBe(false);
    expect(BackofficeUser.schema.path('resetTokenExpires')?.options.select).toBe(false);
  });

  it('allows only writable back-office accounts through requireWritable', () => {
    const next = vi.fn();
    const response = makeResponse();

    requireWritable(
      { user: { userId: 'writer-id', role: 'BACKOFFICE_USER', readOnly: false } } as any,
      response,
      next
    );
    expect(next).toHaveBeenCalledOnce();

    next.mockClear();
    const readOnlyResponse = makeResponse();
    requireWritable(
      { user: { userId: 'reader-id', role: 'BACKOFFICE_USER', readOnly: true } } as any,
      readOnlyResponse,
      next
    );
    expect(readOnlyResponse.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    const missingPermissionResponse = makeResponse();
    requireWritable(
      { user: { userId: 'legacy-id', role: 'BACKOFFICE_USER' } } as any,
      missingPermissionResponse,
      next
    );
    expect(missingPermissionResponse.status).toHaveBeenCalledWith(403);
  });

  it('allows account administration only to ADMIN accounts', () => {
    const next = vi.fn();
    const adminResponse = makeResponse();
    requireAccessLevel('ADMIN')(
      {
        user: {
          userId: 'admin-id',
          role: 'BACKOFFICE_USER',
          accessLevel: BACKOFFICE_ACCESS_LEVEL.ADMIN,
        },
      } as any,
      adminResponse,
      next
    );
    expect(next).toHaveBeenCalledOnce();

    next.mockClear();
    const operatorResponse = makeResponse();
    requireAccessLevel('ADMIN')(
      {
        user: {
          userId: 'operator-id',
          role: 'BACKOFFICE_USER',
          accessLevel: BACKOFFICE_ACCESS_LEVEL.OPERATOR,
        },
      } as any,
      operatorResponse,
      next
    );
    expect(operatorResponse.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    const unknownLevelResponse = makeResponse();
    requireAccessLevel('ADMIN')(
      {
        user: { userId: 'legacy-id', role: 'BACKOFFICE_USER', accessLevel: 'legacy-admin' },
      } as any,
      unknownLevelResponse,
      next
    );
    expect(unknownLevelResponse.status).toHaveBeenCalledWith(403);
  });

  it('places the ADMIN gate on all back-office account-management routes', () => {
    const hasAdminGate = (router: any, method: string, path: string) =>
      router.stack
        .filter((layer: any) => layer.route?.path === path && layer.route.methods[method])
        .some((layer: any) =>
          layer.route.stack.some(
            (routeLayer: any) => routeLayer.handle.name === 'requireAccessLevelMiddleware'
          )
        );

    expect(hasAdminGate(backOfficeUserRoutes, 'post', '/signup')).toBe(true);
    expect(hasAdminGate(backOfficeUserRoutes, 'get', '/')).toBe(true);
    expect(hasAdminGate(backOfficeUserRoutes, 'get', '/:id')).toBe(true);
    expect(hasAdminGate(backOfficeUserRoutes, 'put', '/:id')).toBe(true);
    expect(hasAdminGate(backOfficeUserRoutes, 'put', '/:id/access')).toBe(true);
    expect(hasAdminGate(backOfficeUserRoutes, 'delete', '/:id')).toBe(true);
    expect(hasAdminGate(usersRoutes, 'delete', '/:id')).toBe(true);

    const middlewareNames = (method: string, path: string) =>
      neckAngleRoutes.stack
        .filter((layer: any) => layer.route?.path === path && layer.route.methods[method])
        .flatMap((layer: any) => layer.route.stack.map((routeLayer: any) => routeLayer.handle.name));

    expect(middlewareNames('post', '/records/random')).toEqual(
      expect.arrayContaining([
        'authenticateJWT',
        'authorizeRoleMiddleware',
        'requireAccessLevelMiddleware',
        'requireWritable',
      ])
    );
    expect(
      neckAngleRoutes.stack.some((layer: any) => layer.route?.path === '/test-users')
    ).toBe(false);
  });

  it('requires app-user tokens on authenticated app-user routes', () => {
    const hasRoleGuard = (router: any, method: string, path: string) =>
      router.stack
        .filter((layer: any) => layer.route?.path === path && layer.route.methods[method])
        .some((layer: any) =>
          layer.route.stack.some(
            (routeLayer: any) => routeLayer.handle.name === 'authorizeRoleMiddleware'
          )
        );

    expect(hasRoleGuard(authRoutes, 'put', '/change-password')).toBe(true);
    expect(hasRoleGuard(authRoutes, 'post', '/logout')).toBe(true);
    expect(hasRoleGuard(usersRoutes, 'put', '/me')).toBe(true);
    expect(hasRoleGuard(usersRoutes, 'put', '/me/picture')).toBe(true);
    expect(hasRoleGuard(usersRoutes, 'get', '/me/allow-push-notification')).toBe(true);
    expect(hasRoleGuard(usersRoutes, 'put', '/me/toggle-push-notification')).toBe(true);
    expect(hasRoleGuard(usersRoutes, 'put', '/me/fcm-token')).toBe(true);
    expect(hasRoleGuard(usersRoutes, 'post', '/me/deletion-requests')).toBe(true);
    expect(hasRoleGuard(goalsRoutes, 'post', '/turn-on')).toBe(true);
    expect(hasRoleGuard(goalsRoutes, 'put', '/turn-off')).toBe(true);
    expect(hasRoleGuard(goalsRoutes, 'get', '/user-goals')).toBe(true);
    expect(hasRoleGuard(goalsRoutes, 'get', '/neck-angle')).toBe(true);
    expect(hasRoleGuard(transactionRoutes, 'get', '/')).toBe(true);
    expect(hasRoleGuard(transactionRoutes, 'get', '/:id')).toBe(true);
    expect(hasRoleGuard(transactionRoutes, 'post', '/')).toBe(true);
    expect(hasRoleGuard(neckAngleRoutes, 'get', '/stats')).toBe(true);
    expect(hasRoleGuard(neckAngleRoutes, 'post', '/records/batch')).toBe(true);
    expect(hasRoleGuard(neckAngleRoutes, 'post', '/notification-count/reset')).toBe(true);
    expect(hasRoleGuard(neckAngleRoutes, 'get', '/weekly-chart')).toBe(true);
    expect(hasRoleGuard(fcmRoutes, 'put', '/token')).toBe(true);
  });

  it('stores a neck-angle batch only under the authenticated app-user ID', async () => {
    const postBatch = vi
      .spyOn(NeckAngleService, 'postBatchNeckAngleRecordAsync')
      .mockResolvedValue(true);
    const response = makeResponse();

    await NeckAngleController.postBatchNeckAngleRecords(
      {
        user: { userId: 'authenticated-user', role: 'APP_USER' },
        body: {
          appUserId: 'attacker-selected-user',
          neckAngleRecords: [
            { appUserId: 'attacker-selected-user', angle: 42, dateTimeRecorded: new Date() },
          ],
        },
      } as any,
      response
    );

    expect(postBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        neckAngleRecords: [
          expect.objectContaining({ appUserId: 'authenticated-user' }),
        ],
      })
    );
  });

  it('rejects a back-office token on an app-user route', () => {
    const next = vi.fn();
    const response = makeResponse();

    authorizeRole('APP_USER')(
      { user: { userId: 'backoffice-id', role: 'BACKOFFICE_USER' } } as any,
      response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('serializes account deletion and rejects removal of the last active administrator', async () => {
    const actor = { _id: 'admin-1', accessLevel: 'ADMIN', readOnly: false };
    const target = { _id: 'admin-2', accessLevel: 'ADMIN', readOnly: false };
    const findById = vi.spyOn(BackofficeUser, 'findById').mockImplementation((id: any) => {
      const value = id === 'admin-1' ? actor : target;
      return {
        select: () => ({ lean: () => Promise.resolve(value) }),
      } as any;
    });
    const countDocuments = vi
      .spyOn(BackofficeUser, 'countDocuments')
      .mockResolvedValueOnce(2 as any)
      .mockResolvedValueOnce(1 as any)
      .mockResolvedValueOnce(1 as any);
    const stateQuery = (value: unknown) => ({ lean: vi.fn().mockResolvedValue(value) });
    vi.spyOn(BackofficeSecurityState, 'findById')
      .mockReturnValue(stateQuery({ activeAdminCount: 2, adminMutationLocked: false }) as any);
    vi.spyOn(BackofficeSecurityState, 'updateOne').mockResolvedValue({} as any);
    const lock = vi
      .spyOn(BackofficeSecurityState, 'findOneAndUpdate')
      .mockResolvedValue({ adminMutationLocked: true } as any);
    const deleteAccount = vi.spyOn(BackofficeUser, 'findByIdAndDelete');

    const result = await BackofficeUserService.deleteById('admin-2', 'admin-1');

    expect(result).toEqual({ status: 'last_admin' });
    expect(lock).toHaveBeenCalledWith(
      {
        _id: ACTIVE_BACKOFFICE_ADMIN_STATE_ID,
        $or: [
          { adminMutationLocked: false },
          { adminMutationLocked: { $exists: false } },
        ],
      },
      { $set: { adminMutationLocked: true } },
      { new: true }
    );
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(findById).toHaveBeenCalledTimes(3);
    expect(countDocuments).toHaveBeenCalledTimes(3);
  });

  it('fails closed while another back-office account security mutation holds the lock', async () => {
    vi.spyOn(BackofficeUser, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: 'admin-1', accessLevel: 'ADMIN', readOnly: false }) }),
    } as any);
    vi.spyOn(BackofficeSecurityState, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({ activeAdminCount: 2, adminMutationLocked: true }),
    } as any);
    const lock = vi
      .spyOn(BackofficeSecurityState, 'findOneAndUpdate')
      .mockResolvedValue(null as any);
    const deleteAccount = vi.spyOn(BackofficeUser, 'findByIdAndDelete');

    const result = await BackofficeUserService.deleteById('admin-2', 'admin-1');

    expect(result).toEqual({ status: 'admin_mutation_busy' });
    expect(lock).toHaveBeenCalledOnce();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('rejects account-management service calls made by an OPERATOR', async () => {
    const operator = { _id: 'operator-id', accessLevel: 'OPERATOR', readOnly: false };
    const target = { _id: 'target-id', accessLevel: 'OPERATOR', readOnly: false };
    vi.spyOn(BackofficeUser, 'findById').mockImplementation((id: any) => {
      const value = id === 'operator-id' ? operator : target;
      return {
        select: () => ({ lean: () => Promise.resolve(value) }),
      } as any;
    });
    const update = vi.spyOn(BackofficeUser, 'findByIdAndUpdate');

    const deletion = await BackofficeUserService.deleteById('target-id', 'operator-id');
    const accessChange = await BackofficeUserService.updateAccess(
      'target-id',
      'operator-id',
      { accessLevel: 'ADMIN' }
    );

    expect(deletion).toEqual({ status: 'not_admin' });
    expect(accessChange).toEqual({ status: 'not_admin' });
    expect(update).not.toHaveBeenCalled();
  });
});
