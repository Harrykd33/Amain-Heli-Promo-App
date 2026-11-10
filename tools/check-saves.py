"""Exercise shared contact and meeting saves against a local Supabase API double."""
from playwright.sync_api import sync_playwright
import json
mock=r'''
export function createClient(){
 const tables={team_members:[{email:'kevndrc@gmail.com'}],products:[],manufacturers:[{name:'Test brand',category:'Helicopter',notes:'',discount:'',contact_name:'',email:'',phone:'',website:'',revision:1}],marketing_meetings:[]};
 window.testTables=tables;
 return {rpc:async(name,args)=>{if(name==='is_team_admin')return {data:true};tables.team_members.push({email:args.member_email,display_name:args.member_name});return {data:null};},auth:{getSession:async()=>({data:{session:{user:{id:'team',email:'kevndrc@gmail.com'}}}}),onAuthStateChange(){}},from(table){
 let op='read',payload,conditions=[];
 const q={select(){return q},order(){return q},eq(k,v){conditions.push([k,v]);return q},maybeSingle(){return Promise.resolve({data:tables[table][0]})},insert(v){op='insert';payload=v;return q},update(v){op='update';payload=v;return q},then(resolve,reject){
 const matches=tables[table].filter(row=>conditions.every(([k,v])=>row[k]===v));
 let data=matches;
 if(op==='insert'){data=[{...payload,id:'record-'+Date.now(),revision:1}];tables[table].push(...data);}
 if(op==='update')data=matches.map(row=>Object.assign(row,payload,{revision:row.revision+1}));
 return Promise.resolve({data:structuredClone(data),error:null}).then(resolve,reject);
 }};return q;
 }};
}
'''
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 page=browser.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://esm.sh/**',lambda r:r.fulfill(content_type='text/javascript',body=mock))
 page.goto('http://127.0.0.1:8090/')
 page.locator('[data-nav=contacts]').click()
 page.locator('[data-brand="0"]').click()
 page.get_by_label('Contact name',exact=True).fill('Alex Partner')
 page.get_by_label('Contact email').fill('alex@example.com')
 page.get_by_label('Manufacturer notes').fill('Follow up on the launch.')
 page.get_by_role('button',name='Save contact').click()
 page.wait_for_function('!document.querySelector("dialog").open')
 assert page.evaluate('testTables.manufacturers[0].contact_name')=='Alex Partner'
 assert page.evaluate('testTables.manufacturers[0].revision')==2
 page.locator('[data-brand="0"]').click()
 assert page.get_by_label('Contact email').input_value()=='alex@example.com'
 page.get_by_role('button',name='Cancel',exact=True).click()
 page.locator('[data-nav=meetings]').click()
 page.get_by_role('button',name='Add meeting').click()
 page.get_by_label('Meeting title *').fill('Weekly marketing')
 page.get_by_label('Discussion & decisions').fill('Prioritize the flight review.')
 page.get_by_label('Action items & owners').fill('Kevin: film the intro.')
 page.get_by_role('button',name='Save meeting').click()
 page.wait_for_function('!document.querySelector("dialog").open')
 assert page.locator('.meeting-card').count()==1
 page.locator('[data-meeting="0"]').click()
 page.get_by_label('Discussion & decisions').fill('Updated decisions.')
 page.get_by_role('button',name='Save meeting').click()
 page.wait_for_function('!document.querySelector("dialog").open')
 assert page.evaluate('testTables.marketing_meetings[0].notes')=='Updated decisions.'
 assert page.evaluate('testTables.marketing_meetings[0].revision')==2
 page.locator('[data-nav=team]').click()
 page.get_by_role('button',name='Add teammate').click()
 page.get_by_label('Teammate name *').fill('New Pilot')
 page.get_by_label('Sign-in email *').fill('pilot@example.com')
 page.get_by_role('button',name='Add teammate',exact=True).last.click()
 page.wait_for_function('!document.querySelector("dialog").open')
 assert 'New Pilot' in page.locator('.team-grid').inner_text()
 page.locator('[data-nav=products]').click()
 page.get_by_role('button',name='Add product',exact=False).click()
 assert 'New Pilot' in page.get_by_label('Assigned to').inner_text()
 page.get_by_label('Product / item *').fill('Promotion test')
 page.get_by_label('Manufacturer *').select_option('Test brand')
 page.get_by_label('Promotion expiration date').fill('2026-01-01')
 page.get_by_role('button',name='Add product',exact=False).last.click()
 page.wait_for_function('!document.querySelector("dialog").open')
 assert page.locator('.product-card').count()==0
 page.locator('[data-nav=completed]').click()
 assert page.locator('.product-card').count()==1
 page.get_by_role('button',name='View & edit').click()
 page.get_by_label('Promotion expiration date').fill('')
 page.get_by_role('button',name='Save changes').click()
 page.wait_for_function('!document.querySelector("dialog").open')
 assert page.locator('.product-card').count()==0
 page.locator('[data-nav=products]').click()
 assert page.locator('.product-card').count()==1
 assert not errors,errors
 print(json.dumps({'contact_save_and_reopen':'passed','meeting_create_and_update':'passed','browser_errors':errors}))
 browser.close()
