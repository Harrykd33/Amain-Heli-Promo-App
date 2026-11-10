import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,completion,filtered,validate,csvCell,safeLinks} from '../docs/model.js';
test('N/A stages are excluded while blank stages remain incomplete',()=>{const p={...blank(),unbox:'Done',build:'N/A'};assert.deepEqual(completion(p),{done:1,total:7});});
test('search combines with status and unassigned filters',()=>{const ps=[{...blank(),product:'Radio',manufacturer:'FrSky',assigned:'Kevin'},{...blank(),product:'Kit',manufacturer:'Goosky',status:'Blocked'}];assert.equal(filtered(ps,{query:'frsky',assigned:'Kevin'}).length,1);assert.equal(filtered(ps,{status:'Blocked',assigned:'__unassigned'})[0].product,'Kit');assert.equal(filtered(ps,{query:'radio',status:'Blocked'}).length,0);});
test('validation rejects unsafe links and accepts multiline published URLs',()=>{const p={...blank(),product:'Radio',manufacturer:'FrSky'};assert.equal(validate(p),'');assert.match(validate({...p,links:'javascript:alert(1)'}),/http/);assert.equal(validate({...p,links:'https://youtube.com/watch?v=1\nhttps://instagram.com/p/123'}),'');assert.equal(safeLinks('javascript:alert(1) https://example.com').length,1);});
test('validation rejects dates that would silently roll to the next month',()=>{assert.match(validate({...blank(),product:'Kit',manufacturer:'Brand',eta:'2026-02-30'}),/date/);});
test('CSV escapes quotes, line breaks, and spreadsheet formulas',()=>{assert.equal(csvCell('a"b\nc'),'"a""b\nc"');assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(csvCell('  +SUM(A1)'),'"\'  +SUM(A1)"');});
