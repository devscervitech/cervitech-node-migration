import {it,expect,vi,beforeAll} from 'vitest';
import jwt from 'jsonwebtoken';
vi.mock('../../src/models/AppUser',()=>({default:{findById:vi.fn()}}));
vi.mock('../../src/models/BackOfficeUser',()=>({default:{findById:vi.fn()}}));
let TokenUtil: typeof import('../../src/utils/token.util').TokenUtil;
beforeAll(async()=>{
 process.env.APP_USER_JWT_SECRET='test-app-secret';
 process.env.BACKOFFICE_JWT_SECRET='test-office-secret';
 process.env.GENERAL_TOKEN_SECRET='test-general-secret';
 ({TokenUtil}=await import('../../src/utils/token.util'));
});
it('rejects reset tokens from another realm',()=>{
 const token=TokenUtil.generateToken('user','password_reset',undefined,'BACKOFFICE_USER');
 expect(()=>TokenUtil.verifyToken(token,'password_reset')).toThrow();
 expect(TokenUtil.verifyToken(token,'password_reset','BACKOFFICE_USER').userId).toBe('user');
});
it('rejects a token for another purpose',()=>{
 const token=TokenUtil.generateToken('user','account_deletion');
 expect(()=>TokenUtil.verifyToken(token,'password_reset')).toThrow();
});
it('preserves database failures',async()=>{
 const {default:User}=await import('../../src/models/AppUser');
 const failure=new Error('database unavailable');
 vi.mocked(User.findById).mockReturnValueOnce({select:()=>({lean:()=>Promise.reject(failure)})} as any);
 const token=jwt.sign({userId:'user',role:'APP_USER'},'test-app-secret');
 await expect(TokenUtil.verifyUserToken(token)).rejects.toBe(failure);
});
it('uses a unique token index and expiry-based TTL',async()=>{
 const {default:Blacklist}=await import('../../src/models/TokenBlacklist');
 expect(Blacklist.schema.indexes()).toEqual(expect.arrayContaining([
  [expect.objectContaining({token:1}),expect.objectContaining({unique:true})],
  [expect.objectContaining({expiresAt:1}),expect.objectContaining({expireAfterSeconds:0})]
 ]));
 expect(Blacklist.schema.indexes().some(([fields])=>'createdAt' in fields)).toBe(false);
});
