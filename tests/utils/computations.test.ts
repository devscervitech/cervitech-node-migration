import {it,expect} from 'vitest';
import {getCraniumVertebralAngleFromNeckAngle} from '../../src/utils/computations';
import TransactionRecord from '../../src/models/TransactionRecord';
it('clamps the cranium angle at zero below its baseline',()=>{
 for(const [input,expected] of [[-10,0],[0,0],[39.5,0],[40,0],[65.5,25.5]])expect(getCraniumVertebralAngleFromNeckAngle(input)).toBe(expected);
});
it('maintains the existing transaction timestamp field names',()=>{
 expect(TransactionRecord.schema.options.timestamps).toEqual({createdAt:'createdOn',updatedAt:'updatedOn'});
 expect(TransactionRecord.schema.path('createdAt')).toBeUndefined();
 expect(TransactionRecord.schema.path('updatedAt')).toBeUndefined();
 expect(TransactionRecord.schema.path('updatedOn')).toBeDefined();
});
