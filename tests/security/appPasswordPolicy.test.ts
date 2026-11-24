import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/EmailService/emailutils', () => ({
  EmailUtils: {
    sendSignupEmail: vi.fn(),
    sendPasswordResetOtpEmail: vi.fn(),
  },
}));

import AppUser from '../../src/models/AppUser';
import TokenBlacklist from '../../src/models/TokenBlacklist';
import { AuthController } from '../../src/controllers/auth.controller';
import { AuthService } from '../../src/services/auth.service';
import { AuthValidation } from '../../src/validation/authValidation';
import { HashUtil } from '../../src/utils/hash';
import { verifyPasswordInput } from '../../src/utils/password.util';
import { TokenUtil } from '../../src/utils/token.util';
import { MOBILE_CHANNEL } from '../../src/enums/mobileChannel';
import {
  appUserChangePasswordSchema,
  appUserResetRequestSchema,
  appUserResetPasswordSchema,
  appUserVerifyResetOtpSchema,
  loginSchema,
  passwordPolicySchema,
  signupSchema,
  usernameExistsQuerySchema,
  emailValidationQuerySchema,
} from '../../src/validation/schemas/auth.schema';

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

describe('app-user password policy and username lookup', () => {
  it('uses the normalized signup values for duplicate lookup and account creation', async () => {
    vi.spyOn(AppUser, 'findOne').mockImplementation((async () => null) as any);
    const create = vi.spyOn(AppUser, 'create').mockImplementation(
      (async () => ({ toObject: () => ({ email: 'ada@example.com' }) })) as any
    );
    vi.spyOn(HashUtil, 'hash').mockResolvedValue('password-hash');

    const result = await AuthService.signup({
      email: ' ADA@example.com ',
      username: ' Ada123 ',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      password: 'Strong Pass1!',
      confirmPassword: 'Strong Pass1!',
      mobileChannel: MOBILE_CHANNEL.WEB,
    });

    expect(result.success).toBe(true);
    expect(AppUser.findOne).toHaveBeenCalledWith({ email: 'ada@example.com' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        username: 'ada123',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: 'password-hash',
      })
    );
  });

  it('uses the normalized login identifier from validation for the account lookup', async () => {
    vi.spyOn(AppUser, 'findOne').mockImplementation((async () => null) as any);

    await AuthService.authenticatev1({
      emailOrUsername: ' ADA123 ',
      password: 'Strong Pass1!',
      mobileChannel: MOBILE_CHANNEL.WEB,
    });

    expect(AppUser.findOne).toHaveBeenCalledWith({
      $or: [{ email: 'ada123' }, { username: 'ada123' }],
    });
  });

  it('uses one password policy and removes whitespace before checking it', () => {
    const result = passwordPolicySchema.validate(' Strong Pass1! ');

    expect(result.error).toBeUndefined();
    expect(result.value).toBe('StrongPass1!');
    expect(passwordPolicySchema.validate('short').error).toBeDefined();
  });

  it('uses normalized login identifiers and password values from validation', () => {
    const result = loginSchema.validate({
      emailOrUsername: ' ADA123 ',
      password: ' Legacy Pass1! ',
      mobileChannel: MOBILE_CHANNEL.WEB,
    });

    expect(result.error).toBeUndefined();
    expect(result.value.emailOrUsername).toBe('ada123');
    expect(result.value.password).toBe('LegacyPass1!');
  });

  it('preserves exact legacy password verification as a fallback and requests rehashing', async () => {
    const legacyValue = ' Legacy Pass1! ';
    const legacyHash = await HashUtil.hash(legacyValue);

    const result = await verifyPasswordInput('LegacyPass1!', legacyHash, legacyValue);

    expect(result).toMatchObject({ isValid: true, normalizedPassword: 'LegacyPass1!', needsRehash: true });
  });

  it('requires strong new passwords for app-user change and reset requests', () => {
    const weakChange = appUserChangePasswordSchema.validate({
      formerPassword: 'CurrentPass1!',
      newPassword: 'short',
    });
    const weakReset = appUserResetPasswordSchema.validate({
      token: 'reset-token',
      newPassword: 'short',
    });

    expect(weakChange.error?.message).toContain('Password must have a minimum of 8 characters');
    expect(weakReset.error?.message).toContain('Password must have a minimum of 8 characters');
  });

  it('validates reset email and OTP types while preserving six-digit leading zeros', () => {
    expect(appUserResetRequestSchema.validate({ email: ' PERSON@example.com ' }).value)
      .toEqual({ email: 'person@example.com' });
    expect(appUserResetRequestSchema.validate({ email: { $ne: null } }).error).toBeDefined();
    expect(appUserVerifyResetOtpSchema.validate({ email: 'p@example.com', otp: '000123' }).error)
      .toBeUndefined();
    expect(appUserVerifyResetOtpSchema.validate({ email: 'p@example.com', otp: 123456 }).error)
      .toBeDefined();
    expect(appUserVerifyResetOtpSchema.validate({ email: 'p@example.com', otp: '12345' }).error)
      .toBeDefined();
    expect(emailValidationQuerySchema.validate({ email: { $ne: null } }).error).toBeDefined();
  });

  it('preserves the supplied current password for legacy verification while normalizing the new one', () => {
    const result = appUserChangePasswordSchema.validate({
      formerPassword: ' Current Pass1! ',
      newPassword: ' New Pass2! ',
    });

    expect(result.error).toBeUndefined();
    expect(result.value.formerPassword).toBe(' Current Pass1! ');
    expect(result.value.newPassword).toBe('NewPass2!');
  });

  it('does not hash or save a weak app-user password during change', async () => {
    const currentHash = await HashUtil.hash('Current Pass1!');
    vi.spyOn(AppUser, 'findById').mockImplementation(
      (async () => ({ password: currentHash })) as any
    );
    const hash = vi.spyOn(HashUtil, 'hash');
    const update = vi.spyOn(AppUser, 'findByIdAndUpdate');

    const result = await AuthService.changePassword('app-user-id', 'Current Pass1!', 'short');

    expect(result).toMatchObject({ success: false, code: 'INVALID_NEW_PASSWORD' });
    expect(hash).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('hashes the normalized strong password during app-user change', async () => {
    const currentHash = await HashUtil.hash('CurrentPass1!');
    vi.spyOn(AppUser, 'findById').mockImplementation(
      (async () => ({ password: currentHash })) as any
    );
    const hash = vi.spyOn(HashUtil, 'hash').mockResolvedValue('replacement-hash');
    const update = vi.spyOn(AppUser, 'findByIdAndUpdate').mockImplementation(
      (async () => null) as any
    );

    const result = await AuthService.changePassword(
      'app-user-id',
      'CurrentPass1!',
      ' New Pass2! '
    );

    expect(result).toMatchObject({ success: true });
    expect(hash).toHaveBeenCalledWith('NewPass2!');
    expect(update).toHaveBeenCalledWith('app-user-id', {
      password: 'replacement-hash',
    });
  });

  it('does not hash or save a weak password during reset', async () => {
    vi.spyOn(TokenBlacklist, 'findOne').mockImplementation((async () => null) as any);
    vi.spyOn(TokenUtil, 'verifyToken').mockReturnValue({ userId: 'app-user-id' } as any);
    const hash = vi.spyOn(HashUtil, 'hash');
    const update = vi.spyOn(AppUser, 'findByIdAndUpdate');

    await expect(
      AuthService.resetPassword({ token: 'reset-token', newPassword: 'short' })
    ).rejects.toThrow('Password must have a minimum of 8 characters');

    expect(hash).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects malformed username query values and regex operators', () => {
    expect(usernameExistsQuerySchema.validate({ username: { $ne: null } }).error).toBeDefined();
    expect(usernameExistsQuerySchema.validate({ username: '.*' }).error).toBeDefined();
    expect(usernameExistsQuerySchema.validate({ username: 'a'.repeat(51) }).error).toBeDefined();
    expect(signupSchema.extract('username').validate('a'.repeat(51)).error).toBeDefined();
    expect(usernameExistsQuerySchema.validate({ username: 'ada123' }).error).toBeUndefined();
  });

  it('returns 400 for weak new passwords and malformed username query objects', async () => {
    const changePassword = vi.spyOn(AuthService, 'changePassword');
    const resetPassword = vi.spyOn(AuthService, 'resetPassword');
    const usernameLookup = vi.spyOn(AuthService, 'usernameAlreadyExists');
    const changeResponse = makeResponse();
    const resetResponse = makeResponse();
    const usernameResponse = makeResponse();

    await AuthController.changePassword(
      {
        user: { userId: 'app-user-id' },
        body: { formerPassword: 'CurrentPass1!', newPassword: 'short' },
      } as any,
      changeResponse
    );
    await AuthController.resetPassword(
      { body: { token: 'reset-token', newPassword: 'short' }, query: {} } as any,
      resetResponse
    );
    await AuthController.usernameAlreadyExists(
      { query: { username: { $ne: null } } } as any,
      usernameResponse
    );

    expect(changeResponse.status).toHaveBeenCalledWith(400);
    expect(resetResponse.status).toHaveBeenCalledWith(400);
    expect(usernameResponse.status).toHaveBeenCalledWith(400);
    expect(changePassword).not.toHaveBeenCalled();
    expect(resetPassword).not.toHaveBeenCalled();
    expect(usernameLookup).not.toHaveBeenCalled();
  });

  it('escapes regex metacharacters before querying for a username', async () => {
    const exists = vi.spyOn(AppUser, 'exists').mockImplementation((async () => null) as any);

    await AuthService.usernameAlreadyExists('a.*');

    const filter = exists.mock.calls[0][0] as any;
    expect(filter.username.$regex).toBeInstanceOf(RegExp);
    expect(filter.username.$regex.source).toBe('^a\\.\\*$');
  });

  it('returns the shared success envelope for username and email checks', async () => {
    vi.spyOn(AuthService, 'usernameAlreadyExists').mockResolvedValue(true);
    vi.spyOn(AuthService, 'isValidEmail').mockResolvedValue(false);
    const usernameResponse = makeResponse();
    const emailResponse = makeResponse();

    await AuthController.usernameAlreadyExists({ query: { username: 'Ada123' } } as any, usernameResponse);
    await AuthController.isValidEmail({ query: { email: 'invalid' }, body: {} } as any, emailResponse);

    expect(usernameResponse.json).toHaveBeenCalledWith({
      success: true,
      message: 'Username availability checked.',
      data: { exists: true },
    });
    expect(emailResponse.json).toHaveBeenCalledWith({
      success: true,
      message: 'Email validation completed.',
      data: { isValid: false },
    });
  });

  it('does not return an internal email-validation error to the caller', async () => {
    vi.spyOn(AuthService, 'isValidEmail').mockRejectedValue(new Error('database internals'));
    const response = makeResponse();

    await AuthController.isValidEmail({ query: { email: 'valid@example.com' }, body: {} } as any, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'Unable to validate email.',
    });
  });
});
