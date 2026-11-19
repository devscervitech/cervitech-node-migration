# 02 — Add purpose scoping to shared reset/deletion tokens

**What to build:** The general-purpose token used for both password-reset and account-deletion emails carries a `purpose` claim, and each flow's verification step rejects a token minted for the other purpose. A token from a password-reset email can no longer be used to confirm account deletion, and vice versa.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `TokenUtil.generateToken` accepts and embeds a `purpose` (e.g. `'password_reset' | 'account_deletion'`)
- [ ] `TokenUtil.verifyToken` accepts an expected `purpose` and throws a clear error if the token's purpose doesn't match
- [ ] `AuthService.sendPasswordResetToken` / `resetPassword` use `purpose: 'password_reset'`
- [ ] `AppUserService.deleteAccountRequest` and its confirmation step use `purpose: 'account_deletion'`
- [ ] A token minted for one purpose is rejected (not a crash) when presented to the other flow's confirmation endpoint
- [ ] Existing password-reset and account-deletion-request flows still work end-to-end
