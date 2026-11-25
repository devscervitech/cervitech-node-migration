import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appUserFindOne: vi.fn(),
  loginValidation: vi.fn(),
  generateToken: vi.fn(),
  getLatestGoal: vi.fn(),
  toAppUserViewModel: vi.fn(),
  verifyPasswordInput: vi.fn(),
}));

vi.mock('../../src/utils/revokeToken.js', () => ({ revokeToken: vi.fn() }));
vi.mock('../../src/utils/hash.js', () => ({ HashUtil: { hash: vi.fn() } }));
vi.mock('../../src/utils/token.util.js', () => ({
  TokenUtil: { generateAppUserToken: (...args: unknown[]) => mocks.generateToken(...args) },
}));
vi.mock('../../src/models/TokenBlacklist.js', () => ({ default: {} }));
vi.mock('../../src/models/AppUser.js', () => ({
  default: { findOne: (...args: unknown[]) => mocks.appUserFindOne(...args) },
}));
vi.mock('../../src/services/otp.service.js', () => ({ OtpService: {} }));
vi.mock('../../src/utils/EmailService/emailutils.js', () => ({ EmailUtils: {} }));
vi.mock('../../src/validation/authValidation.js', () => ({
  AuthValidation: { loginValidation: (...args: unknown[]) => mocks.loginValidation(...args) },
}));
vi.mock('../../src/services/goalLookup.service.js', () => ({
  getLatestGoal: (...args: unknown[]) => mocks.getLatestGoal(...args),
}));
vi.mock('../../src/viewmodels/AppUser.viewmodel.js', () => ({
  toAppUserViewModel: (...args: unknown[]) => mocks.toAppUserViewModel(...args),
}));
vi.mock('../../src/utils/password.util.js', () => ({
  normalizePassword: vi.fn(),
  verifyPasswordInput: (...args: unknown[]) => mocks.verifyPasswordInput(...args),
}));
vi.mock('../../src/validation/schemas/auth.schema.js', () => ({ passwordPolicySchema: {} }));

import { AuthService } from '../../src/services/auth.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('login goal target', () => {
  it('returns the latest goal selected by the shared lookup', async () => {
    const user = {
      _id: 'user-1',
      email: 'user@example.test',
      username: 'user1',
      password: 'hashed-password',
      deleted: false,
      save: vi.fn().mockResolvedValue(undefined),
    };
    mocks.loginValidation.mockReturnValue({
      valid: true,
      value: { emailOrUsername: 'user@example.test', password: 'password', mobileChannel: 1 },
    });
    mocks.appUserFindOne.mockResolvedValue(user);
    mocks.verifyPasswordInput.mockResolvedValue({ isValid: true, needsRehash: false });
    mocks.generateToken.mockReturnValue('access-token');
    mocks.getLatestGoal.mockResolvedValue({ targetedAverageNeckAngle: 72 });
    mocks.toAppUserViewModel.mockReturnValue({ username: 'user1' });

    const result = await AuthService.authenticatev1({} as any);

    expect(result).toMatchObject({
      success: true,
      data: { currentTargetedAverageNeckAngle: 72, token: 'access-token' },
    });
    expect(mocks.getLatestGoal).toHaveBeenCalledWith('user-1');
  });
});
