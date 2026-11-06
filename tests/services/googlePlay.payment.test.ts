import {it,expect,vi,afterEach} from 'vitest';
import {GooglePlayService} from '../../src/services/googlePlay.service';
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks()});
it('fails closed without the product allowlist',async()=>{
 vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME','app.test');vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS','');
 await expect(GooglePlayService.verifySubscriptionPurchase({packageName:'app.test',subscriptionId:'premium',purchaseToken:'token'})).rejects.toThrow('allowlist');
});
it('rejects another package or product before calling Google',async()=>{
 vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME','app.test');vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS','premium');
 for(const [packageName,subscriptionId] of [['other.app','premium'],['app.test','other']]){
 await expect(GooglePlayService.verifySubscriptionPurchase({packageName,subscriptionId,purchaseToken:'token'})).rejects.toThrow('Unsupported');
 }
});
it('rejects a Google response for a different product',async()=>{
 vi.stubEnv('GOOGLE_PLAY_PACKAGE_NAME','app.test');vi.stubEnv('GOOGLE_PLAY_SUBSCRIPTION_IDS','premium');
 vi.spyOn(GooglePlayService as any,'getClient').mockReturnValue({purchases:{subscriptionsv2:{get:vi.fn(async()=>({data:{subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',lineItems:[{productId:'other'}]}}))}}});
 await expect(GooglePlayService.verifySubscriptionPurchase({packageName:'app.test',subscriptionId:'premium',purchaseToken:'token'})).rejects.toThrow('does not match');
});
