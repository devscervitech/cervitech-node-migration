import {it,expect} from 'vitest';
import {redact,redactText} from '../../src/utils/logRedaction';
import {safeLogFormat} from '../../src/utils/logger';
import winston from 'winston';
it('redacts nested credentials without mutating the input',()=>{
 const input={password:'secret',nested:[{confirmPassword:'secret',fcmToken:'device',email:'user@example.com',token:'opaque'}],userId:'123'};
 expect(JSON.stringify(redact(input))).not.toMatch(/secret|device|user@example.com|opaque/);
 expect(input.password).toBe('secret');
 expect((redact(input) as any).userId).toBe('123');
});
it('preserves error stacks and handles cycles',()=>{
 const error=new Error('Failure token=opaque user@example.com');
 const output=redact(error) as any;
 expect(output.stack).toContain('logging.test.ts');
 expect(output.stack).not.toContain('opaque');
 const cycle:any={};cycle.self=cycle;
 expect((redact(cycle) as any).self).toBe('[Circular]');
});
it('redacts request URLs, bearer values and push tokens',()=>{
 expect(redactText('DELETE /api/v1/users/me/deletion-requests/opaque?email=person@example.com 200')).not.toContain('opaque');
 expect(redactText('Bearer abcdef ExpoPushToken[device]')).not.toMatch(/abcdef|device/);
});
it('renders safe JSON without ANSI or pre-rendered secret messages',()=>{
 const format=winston.format.combine(safeLogFormat(),winston.format.json());
 const info:any={level:'info',message:'\u001b[31mhello',password:'secret',[Symbol.for('level')]:'info',[Symbol.for('message')]:'secret'};
 const result=format.transform(info,format.options) as any;
 const rendered=result[Symbol.for('message')];
 expect(JSON.parse(rendered).password).toBe('[REDACTED]');
 expect(rendered).not.toMatch(/secret|\\u001b/);
});
