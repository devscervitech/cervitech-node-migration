import {it,expect,vi} from 'vitest';
import express from 'express';
vi.mock('../../src/utils/token.util',()=>({InvalidTokenError:class extends Error {},isUserTokenRole:(role:string)=>['APP_USER','BACKOFFICE_USER'].includes(role),TokenUtil:{verifyUserTokenWithAccount:vi.fn(async(token:string)=>{const role=token==='office'?'BACKOFFICE_USER':'APP_USER';return {payload:{userId:'owner',role},account:{userId:'owner',role,accessLevel:'ADMIN',readOnly:false}};})}}));
vi.mock('../../src/models/TokenBlacklist',()=>({default:{findOne:vi.fn(async()=>null)}}));
vi.mock('../../src/services/appUserServices/neckAngle.service',()=>({NeckAngleService:{postBatchNeckAngleRecordAsync:vi.fn(async()=>true)}}));
vi.mock('../../src/services/JobScheduler',()=>({JobScheduler:{}}));
vi.mock('../../src/controllers/user.controller',()=>({UserController:new Proxy({}, {get:()=>((_req:any,res:any)=>res.json({ok:true}))})}));
import neckRoutes from '../../src/routes/neckAngle.routes';
import userRoutes from '../../src/routes/users.routes';
import {NeckAngleService} from '../../src/services/appUserServices/neckAngle.service';
import {swaggerSpec} from '../../src/config/swagger';
async function request(path:string, method='GET', auth: boolean | string=false, body?:object){
 const app=express();app.use(express.json());app.use('/neck-angle',neckRoutes);app.use('/users',userRoutes);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 try{return await fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${typeof auth==='string'?auth:'test'}`}:{})},body:body?JSON.stringify(body):undefined});}
 finally{await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
}
it('requires authentication on all retained exposed endpoints',async()=>{
 for(const [method,path] of [['POST','/neck-angle/records/batch'],['POST','/neck-angle/weekly-averages'],['GET','/neck-angle/reports/current-day'],['GET','/users/?email=other'],['GET','/users/response-rate?id=other'],['GET','/users/other']])expect((await request(path,method)).status).toBe(401);
});
it('denies app-user access to administrative profile reads',async()=>{
 for(const path of ['/users/?email=other','/users/response-rate?id=other','/users/other'])expect((await request(path,'GET',true)).status).toBe(403);
});
it('ignores attacker-selected batch owner',async()=>{
 expect((await request('/neck-angle/records/batch','POST',true,{appUserId:'victim',neckAngleRecords:[{angle:10}]})).status).toBe(200);
 expect(NeckAngleService.postBatchNeckAngleRecordAsync).toHaveBeenCalledWith(expect.objectContaining({appUserId:'owner'}));
});
it('removes test routes and their OpenAPI paths',async()=>{
 expect((await request('/neck-angle/test-users')).status).toBe(404);
 expect((await request('/neck-angle/records/random','POST')).status).toBe(404);
 const paths=(swaggerSpec as any).paths;
 for(const path of ['/neck-angle/test-users','/neck-angle/records/random','/users/fcm-token'])expect(paths[path]).toBeUndefined();
});

it('allows backoffice profile reads',async()=>{
 for(const path of ['/users/?email=other','/users/response-rate?id=other','/users/other'])expect((await request(path,'GET','office')).status).toBe(200);
});
it('declares bearer authentication on retained endpoints',()=>{
 const paths=(swaggerSpec as any).paths;
 for(const [path,method] of [['/neck-angle/records/batch','post'],['/neck-angle/weekly-averages','post'],['/neck-angle/reports/current-day','get'],['/users','get'],['/users/response-rate','get'],['/users/{id}','get']])expect(paths[path][method].security).toEqual([{bearerAuth:[]}]);
});
