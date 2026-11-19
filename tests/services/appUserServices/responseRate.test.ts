import {it,expect,vi} from 'vitest';
vi.mock('../../../src/utils/EmailService/emailutils',()=>({EmailUtils:{}}));
import AppUser from '../../../src/models/AppUser';
import ResponseRate from '../../../src/models/ResponseRate';
import {AppUserService} from '../../../src/services/appUserServices/appUserService.service';
import {computeCompliance} from '../../../src/services/goalCycle';
import {readFileSync} from 'node:fs';
it('looks up the push recipient by Mongo ID',async()=>{
 const find=vi.spyOn(AppUser,'findById').mockReturnValue({exec:async()=>({fcmToken:'owner-token'})} as any);
 expect(await AppUserService.getFCMTokenById('owner')).toBe('owner-token');
 expect(find).toHaveBeenCalledWith('owner');
 find.mockRestore();
});
it('records a response against the latest prompt owned by the user',async()=>{
 const update=vi.spyOn(ResponseRate,'findOneAndUpdate').mockResolvedValue({response:1});
 expect(await AppUserService.postResponseRateAsync('owner')).toBe(true);
 expect(update).toHaveBeenCalledWith({appUserId:'owner',prompt:{$gt:0}},{$set:{response:1}},{sort:{dateCreated:-1,_id:-1},new:true});
 update.mockResolvedValueOnce(null);
 expect(await AppUserService.postResponseRateAsync('missing')).toBe(false);
 update.mockRestore();
});
it('defaults new users and signup requests to a usable prompt',()=>{
 expect(new AppUser().prompt).toBe(5);
 expect(readFileSync('src/services/auth.service.ts','utf8')).toMatch(/prompt: 5/);
});
it('shares finite compliance behavior for invalid targets',()=>{
 for(const target of [0,-1,NaN,Infinity])expect(computeCompliance(50,target)).toBe(0);
 expect(readFileSync('src/services/appUserServices/appUserService.service.ts','utf8')).toContain('computeCompliance(average, goal.targetedAverageNeckAngle)');
});
