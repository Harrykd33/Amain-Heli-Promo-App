import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,completion,filtered,validate,csvCell,safeLinks,isCompleted,promotionToday,facebookLink} from '../docs/model.js';
test('N/A stages are excluded while blank stages remain incomplete',()=>{const p={...blank(),unbox:'Done',build:'N/A'};assert.deepEqual(completion(p),{done:1,total:8});});
test('search combines with status and unassigned filters',()=>{const ps=[{...blank(),product:'Radio',manufacturer:'FrSky',assigned:'Kevin'},{...blank(),product:'Kit',manufacturer:'Goosky',status:'Blocked'}];assert.equal(filtered(ps,{query:'frsky',assigned:'Kevin'}).length,1);assert.equal(filtered(ps,{status:'Blocked',assigned:'__unassigned'})[0].product,'Kit');assert.equal(filtered(ps,{query:'radio',status:'Blocked'}).length,0);});
test('validation rejects unsafe links and accepts multiline published URLs',()=>{const p={...blank(),product:'Radio',manufacturer:'FrSky'};assert.equal(validate(p),'');assert.match(validate({...p,links:'javascript:alert(1)'}),/http/);assert.equal(validate({...p,links:'https://youtube.com/watch?v=1\nhttps://instagram.com/p/123'}),'');assert.equal(safeLinks('javascript:alert(1) https://example.com').length,1);});
test('validation rejects dates that would silently roll to the next month',()=>{assert.match(validate({...blank(),product:'Kit',manufacturer:'Brand',eta:'2026-02-30'}),/date/);});
test('CSV escapes quotes, line breaks, and spreadsheet formulas',()=>{assert.equal(csvCell('a"b\nc'),'"a""b\nc"');assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(csvCell('  +SUM(A1)'),'"\'  +SUM(A1)"');});

test('promotions stay active through their final day and archive afterward',()=>{
 assert.equal(isCompleted({promotion_expires_on:'2026-11-10'},'2026-11-10'),false);
 assert.equal(isCompleted({promotion_expires_on:'2026-11-10'},'2026-11-11'),true);
 assert.equal(isCompleted({promotion_expires_on:null},'2026-11-11'),false);
 assert.equal(isCompleted({},'2026-11-11'),false);
 assert.equal(isCompleted({promotion_expires_on:'2026-12-01'},'2026-11-11'),false);
 assert.equal(promotionToday(new Date('2026-11-11T04:59:59Z')),'2026-11-10');
 assert.equal(promotionToday(new Date('2026-11-11T05:00:00Z')),'2026-11-11');
 assert.match(validate({...blank(),product:'Kit',manufacturer:'Brand',promotion_expires_on:'2026-02-30'}),/date/);
});

test('Facebook links open only valid Facebook destinations',()=>{
 assert.equal(facebookLink('www.facebook.com/AMainHobbies'),'https://www.facebook.com/AMainHobbies');
 assert.equal(facebookLink('http://fb.me/page'),'https://fb.me/page');
 for(const value of ['https://facebook.com.evil.example/page','javascript:alert(1)','https://example.com','https://evil@facebook.com','https://facebook.com:8443/page'])assert.equal(facebookLink(value),'');
});
