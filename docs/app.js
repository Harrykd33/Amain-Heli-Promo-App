import {STAGES,LABELS,STATUSES,PROGRESS,PEOPLE,blank,completion,filtered,validate,csvCell,safeLinks,isCompleted,promotionToday,facebookLink} from './model.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={plane:'↗',products:'▦',team:'♧',brands:'◇',contacts:'◎',meetings:'≡',plus:'+',search:'⌕',arrow:'↗',refresh:'↻'};
const cfg=window.FLIGHT_TEAM_CONFIG||{};
let db,session,products=[],manufacturers=[],view=(location.hash.slice(1).split('/')[0]||'products'),filters={},demo=false,loading=false,lastSync=null,syncError='',loadVersion=0,authorized=false;
let lastPromotionDay=promotionToday();
let presenceChannel=null,presenceReady=false,onlineEmails=new Set();
let teammates=[],canManageTeam=false,teamError='';
const peopleNames=()=>[...new Set([...PEOPLE,...teammates.map(m=>m.display_name).filter(Boolean),...products.map(p=>p.assigned).filter(Boolean)])].sort();
let meetings=[],extensionError='',installPrompt;
let editing=null,initialForm='',saving=false,focusReturn;
const color=s=>({'On track':'green','In progress':'amber','Blocked':'red','On hold':'gray'}[s]||'gray');
const date=d=>d?new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Not set';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),5000);}
const option=(v,label,selected)=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(label??v)}</option>`;
function brand(){return '<div class="brand"><picture><source media="(prefers-color-scheme: dark)" srcset="./header-night.png"><img class="brand-logo" src="./header-day.png" alt="AMain Hobbies Flight Team Promotions" width="2172" height="724"></picture></div>';}
const activeProducts=()=>products.filter(p=>!isCompleted(p));
function renderGate(message='',denied=false){
 $('#app').innerHTML=`<main class="gate">${brand()}<div class="gate-card"><span class="eyebrow">THE TEAM’S FLIGHT DECK</span><h1>Great content.<br>One shared workspace.</h1><p>From the first unboxing to the final post. Keep your products, people, and progress together.</p>${!db?'<div class="notice">Shared storage is not connected yet. Add your Supabase settings to enable team sign-in.</div><button class="primary" id="demo">Explore the demo <span>↗</span></button><p class="fine">Demo uses fictional products and cannot save changes.</p>':denied?`<div class="notice error">This email has not been granted access to the Flight Team. Ask the project owner to add it to the team list.</div><button id="signout" class="secondary">Sign out</button>`:`<form id="login"><label>Team email<input type="email" name="email" placeholder="you@example.com" autocomplete="email" required></label><button class="primary" type="submit">Email me a sign-in link <span>↗</span></button></form><p class="fine">Access is limited to approved team email addresses.</p>`}<p id="auth-message" role="status">${esc(message)}</p></div><p class="gate-footer">PRODUCT INTAKE <span>→</span> PRODUCTION <span>→</span> SOCIAL PUBLISHING</p></main>`;
 $('#demo')?.addEventListener('click',startDemo);$('#signout')?.addEventListener('click',signout);
 $('#login')?.addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const {error}=await db.auth.signInWithOtp({email:new FormData(e.target).get('email').trim(),options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;$('#auth-message').textContent='Check your email for a sign-in link. Open it to enter the team workspace.';}catch(err){$('#auth-message').textContent=err.message;}finally{b.disabled=false;}});
}
function startDemo(){demo=true;meetings=[{id:'sample',title:'Content planning / November',meeting_date:'2026-11-10',attendees:'Kevin, Frank, Jason, Danthell',notes:'Review the current product pipeline and plan the next round of flight videos. Focus on clear setup footage, helpful comparisons, and short social clips.',actions:'Kevin - Finish the Falcon build footage.\nFrank - Draft the radio review outline.\nJason - Follow up on replacement hardware.'}];const sample=[['AeroWorks','Falcon 700','Helicopter kit','Kevin','On track'],['Skyline RC','Pilot X12','Radio transmitter','Frank','In progress'],['RotorLab','Velocity blades','Rotor blades','Jason','Blocked']];products=sample.map((a,i)=>({...blank(),id:'demo-'+i,manufacturer:a[0],product:a[1],description:a[2],assigned:a[3],status:a[4],fb:i===0?'Done':'',ig:i===0?'In progress':'',unbox:'Done',build:i?'N/A':'In progress',review:i===1?'In progress':'',notes:i===2?'Waiting for replacement hardware.':'',revision:1,updated_by:'Demo',updated_at:new Date().toISOString()}));products.push({...products[0],id:'demo-completed',product:'Falcon 550 - completed promotion',promotion_expires_on:'2026-01-01'});manufacturers=sample.map(a=>({name:a[0],category:'Demo brand',notes:'Sample partner notes. Discuss upcoming products and content opportunities.',discount:'',contact_name:'Demo partner',email:'partner@example.com',phone:'',website:'https://example.com',contacts:[{name:'Demo partner',email:'partner@example.com',phone:'',website:'https://example.com',facebook:'https://www.facebook.com/AMainHobbies',notes:'Product launches and content planning.'},{name:'Media team',email:'media@example.com',facebook:'https://www.facebook.com/AMainHobbies',notes:'Photos, brand assets, and social coordination.'}],revision:1}));render();}
function shell(){
 const sidebarScrollTop=$('.sidebar')?.scrollTop||0;
 const navScrollLeft=$('nav[aria-label="Main navigation"]')?.scrollLeft||0;
 const nav=[['products','Products','Product tracker'],['team','Team','Team overview'],['meetings','Team Notes','Team Notes'],['contacts','Brands & Contacts','Brands & Contacts'],['completed','Completed','Completed promotions']];
 $('#app').innerHTML=`<aside class="sidebar">${brand()}<div class="workspace-label">TEAM WORKSPACE</div><nav aria-label="Main navigation">${nav.map(([id,label])=>`<button data-nav="${id}" class="nav-item ${view===id?'active':''}"><span aria-hidden="true">${icons[id]||'+'}</span>${label}${id==='products'?`<small>${activeProducts().length}</small>`:''}</button>`).join('')}</nav><div class="side-bottom"><div class="team-avatars">${teamAvatarMarkup()}</div><b>Made for the flight team.</b><p>Better tracking<br>Better Promotions</p></div></aside><div class="workspace"><header class="topbar"><span>Workspace <span class="slash">/</span> <b>${nav.find(n=>n[0]===view)?.[2]||'Product tracker'}</b></span><div class="account"><button class="secondary install-app" id="install-app">Install app</button><span class="sync-dot ${syncError?'bad':''}"></span><span id="sync-label">${demo?'Demo preview':syncError?'Sync failed':loading?'Syncing…':'Shared workspace'}</span><button class="icon-button" id="refresh" aria-label="Refresh shared data" ${loading?'disabled':''}>↻</button><button id="signout" class="avatar" title="${esc(session?.user?.email||'Exit demo')}" aria-label="${demo?'Exit demo':'Sign out'}">${esc((session?.user?.email||'FT').slice(0,2).toUpperCase())}</button></div></header><main id="main"></main><footer class="workspace-footer">AMAIN HOBBIES · FLIGHT TEAM <span>${demo?'Read-only demo':lastSync?'Updated '+lastSync.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}):''}</span></footer></div>`;
 $('.sidebar').scrollTop=sidebarScrollTop;
 $('nav[aria-label="Main navigation"]').scrollLeft=navScrollLeft;
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{navigate(b.dataset.nav);});$('#install-app').onclick=installApp;$('#signout').onclick=signout;$('#refresh').onclick=()=>demo?toast('This is a read-only demo.'):load(true);
}
function render(){shell();if(view==='products'||view==='completed')renderProducts();else if(view==='team')renderTeam();else if(view==='meetings')renderMeetings();else renderBrands(true);}
function heading(kicker,title,description,action){return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}<span class="orange-dot">.</span></h1>${description?`<p>${description}</p>`:''}</div>${action||''}</div>${demo?'<div class="demo-banner"><b>Demo workspace</b> · Fictional sample data. Connect Supabase to use your imported workbook with the team.</div>':''}${syncError?`<div class="notice error" role="alert">${esc(syncError)} <button id="retry-load">Retry</button></div>`:''}`;}
function renderProducts(){
 const pool=activeProducts(),archived=view==='completed';
 const total=pool.length,active=pool.filter(p=>p.status==='In progress').length,blocked=pool.filter(p=>p.status==='Blocked').length,published=pool.filter(p=>['fb','ig','yt'].some(k=>p[k]==='Done')).length;
 $('#main').innerHTML=heading('FROM ARRIVAL TO AIRTIME',archived?'Completed promotions':filters.summary&&filters.summary!=='all'?summaryTitle():'Product launch pad',(archived?'Past promotions, with every product detail and published link preserved.':{progress:'Products moving through production. Open a card to update the next stage.',attention:'Products under embargo. Open a card for notes and next steps.',social:'Products posted to at least one social channel. Open a card for links and publishing details.'}[filters.summary]||''),archived?'':`<button class="primary" id="add-product">+ <span>Add product</span></button>`)+` ${archived?'':`<section class="stats" aria-label="Workspace summary"><button class="stat-card" data-summary="all"><span>On the launch pad</span><strong>${total.toString().padStart(2,'0')}</strong><small>Products in the pipeline</small></button><button class="stat-card" data-summary="progress"><span><i class="dot amber"></i> In progress</span><strong>${active.toString().padStart(2,'0')}</strong><small>Moving through production</small></button><button class="stat-card" data-summary="attention"><span><i class="dot red"></i> Embargo</span><strong>${blocked.toString().padStart(2,'0')}</strong><small>Products under embargo</small></button><button class="stat-card" data-summary="social"><span><i class="dot green"></i> Socially active</span><strong>${published.toString().padStart(2,'0')}</strong><small>Posted to at least one channel</small></button></section>`}<section class="product-section"><div class="section-top"><h2>${summaryTitle()} <span id="result-count">${total}</span></h2><button class="text-button" id="export">Export CSV ↓</button></div><div class="filters"><select id="filter-status" aria-label="Filter by status">${option('','All statuses',filters.status)}${STATUSES.map(s=>option(s,s,filters.status)).join('')}</select><select id="filter-assigned" aria-label="Filter by teammate">${option('','Everyone',filters.assigned)}${peopleNames().map(p=>option(p,p,filters.assigned)).join('')}${option('__unassigned','Unassigned',filters.assigned)}</select><select id="filter-manufacturer" aria-label="Filter by brand">${option('','All brands',filters.manufacturer)}${[...new Set(products.map(p=>p.manufacturer))].sort().map(p=>option(p,p,filters.manufacturer)).join('')}</select></div><div class="filter-chips">${['',...STATUSES].map(s=>`<button data-status="${s}" class="chip ${s===(filters.status||'')?'selected':''}">${s?`<i class="dot ${color(s)}"></i>`:''}${s||'All products'}</button>`).join('')}</div><div id="product-grid" class="product-grid"></div><p class="hint">Open a product to update details, production stages, and social posts.</p></section>`;
 document.querySelectorAll('[data-summary]').forEach(b=>{b.setAttribute('aria-pressed',String((filters.summary||'all')===b.dataset.summary));b.onclick=()=>{filters={summary:b.dataset.summary};navigate('products',b.dataset.summary);};});
 $('#add-product')?.addEventListener('click',()=>openEditor());$('#export').onclick=exportCSV;$('#retry-load')?.addEventListener('click',()=>load(true));

 ['status','assigned','manufacturer'].forEach(k=>$('#filter-'+k).onchange=e=>{filters[k]=e.target.value;if(k==='status')updateChips();renderCards();});
 document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{if(!b.dataset.status){filters={};navigate(view==='completed'?'completed':'products');return;}filters.status=b.dataset.status;$('#filter-status').value=filters.status;updateChips();renderCards();});renderCards();
}
function updateChips(){document.querySelectorAll('[data-status]').forEach(b=>b.classList.toggle('selected',b.dataset.status===(filters.status||'')));}
function renderCards(){
 const list=visibleProducts();$('#result-count').textContent=list.length;
 $('#product-grid').innerHTML=list.length?list.map(p=>{
 const c=completion(p);const percent=c.total?Math.round(c.done/c.total*100):100;
 return `<article class="product-card"><div class="card-top"><span class="manufacturer">${esc(p.manufacturer)}</span><span class="badge ${isCompleted(p)?'blue':color(p.status)}"><i class="dot ${isCompleted(p)?'blue':color(p.status)}"></i>${isCompleted(p)?'Completed':esc(p.status)}</span></div><button class="product-title" data-edit="${esc(p.id)}"><h3>${esc(p.product)}</h3><span aria-hidden="true">↗</span></button><p class="promotion-date ${isCompleted(p)?'expired':''}">${p.promotion_expires_on?`${isCompleted(p)?'Promotion ended':'Promotion ends'} ${esc(date(p.promotion_expires_on))}`:'No promotion expiration'}</p><p class="description">${esc(p.description||'No description yet')}</p><div class="card-meta"><span class="person-badge">${esc((p.assigned||'?').slice(0,1))}</span><b>${esc(p.assigned||'Unassigned')}</b><span class="arrival">${p.received?'Received':'ETA'} <strong>${esc(date(p.received||p.eta))}</strong></span></div><div class="progress-heading"><span>Content progress</span><b>${c.done} / ${c.total} done</b></div><div class="progress-track" role="progressbar" aria-label="Content complete" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><div style="width:${percent}%"></div></div><div class="stage-list">${STAGES.slice(0,6).filter(k=>p[k]!=='N/A').map(k=>`<span class="mini-stage ${p[k]==='Done'?'done':p[k]==='In progress'?'working':p[k]==='N/A'?'na':''}" title="${LABELS[k]}: ${esc(p[k]||'Not set')}"><i>${p[k]==='Done'?'✓':p[k]==='N/A'?'–':p[k]==='In progress'?'◐':'○'}</i>${{unbox:'Unbox',build:'Build',flights:'Flights',review:'Review vid/Blog',tutorial:'Tutorial',editing:'Edit'}[k]}</span>`).join('')}</div><div class="card-footer"><div class="socials">${['fb','ig','yt'].map(k=>`<span class="social ${k} ${p[k]==='Done'?'done':p[k]==='In progress'?'working':''}" title="${LABELS[k]}: ${esc(p[k]||'Not set')}">${k.toUpperCase()} ${p[k]==='Done'?'✓':p[k]==='In progress'?'◐':''}</span>`).join('')}</div><button class="text-button" data-share="${esc(p.id)}">Share plan</button><button class="text-button" data-edit="${esc(p.id)}">View & edit →</button></div></article>`;
 }).join(''):`<div class="empty"><span>⌕</span><h3>${view==='completed'?'No completed promotions':products.length?'No matching products':'Your launch pad is ready'}</h3><p>${view==='completed'?'Expired promotions appear here automatically. Try clearing any filters.':products.length?'Try another status or clear the filters.':'Add your first product to get the team moving.'}</p>${products.length?'<button id="clear-filters" class="secondary">Clear filters</button>':''}</div>`;
 document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>openProductShare(products.find(p=>p.id===b.dataset.share)));
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(products.find(p=>p.id===b.dataset.edit)));$('#clear-filters')?.addEventListener('click',()=>{filters={};renderProducts();});
}
function renderTeam(){
 const people=[...new Set([...peopleNames(),...activeProducts().map(p=>p.assigned||'Unassigned')])];
 $('#main').innerHTML=heading('MANY HANDS. ONE TEAM.','The flight crew','See who’s working on what, and where a hand could help.',`<button class="primary" id="add-teammate" ${!demo&&!canManageTeam?'disabled':''}>+ Add teammate</button>`)+(teamError?`<div class="notice">${esc(teamError)}</div>`:!demo&&!canManageTeam?'<p class="notice">A team administrator can add teammates and grant sign-in access.</p>':'')+`<div class="team-grid">${people.map(name=>{const items=activeProducts().filter(p=>(p.assigned||'Unassigned')===name);return `<article class="team-card"><div class="crew-heading"><span class="crew-avatar">${esc(name[0])}</span><div><h2>${esc(name)}</h2><p>${items.length} assigned product${items.length===1?'':'s'}</p></div></div>${items.length?items.map(p=>`<button class="crew-product" data-open="${esc(p.id)}"><span><small>${esc(p.manufacturer)}</small><b>${esc(p.product)}</b></span><span class="dot ${color(p.status)}" title="${esc(p.status)}"></span><span class="sr-only">${esc(p.status)}</span></button>`).join(''):'<p class="muted">A clear runway. No products assigned.</p>'}</article>`;}).join('')}</div>`;$('#add-teammate').onclick=openTeammate;document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openEditor(products.find(p=>p.id===b.dataset.open)));
}
function openTeammate(){
 showDialog(`<form id="teammate-form"><div class="dialog-heading"><h2 id="editor-title">Add teammate</h2><button type="button" class="close" data-close aria-label="Close">&times;</button></div><div class="dialog-content"><p class="notice">This grants access to shared products, contacts, and meeting notes. The teammate can sign in using this email; no invitation email is sent automatically.</p>${demo?'<p class="notice">Read-only demo. Adding teammates is disabled.</p>':''}<div class="form-grid">${field('display_name','Teammate name *','text','','required maxlength="100"')}${field('email','Sign-in email *','email','','required maxlength="254"')}</div><p id="form-error" role="alert"></p></div><div class="dialog-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary" ${demo?'disabled':''}>Add teammate</button></div></form>`);
 $('#teammate-form').onsubmit=async e=>{e.preventDefault();if(saving||demo||!canManageTeam)return;saving=true;const b=e.target.querySelector('[type=submit]');b.disabled=true;
 try{const data=new FormData(e.target);const {error}=await db.rpc('add_team_member',{member_name:data.get('display_name').trim(),member_email:data.get('email').trim().toLowerCase()});if(error)throw error;$('#editor').close();focusReturn?.focus();toast('Teammate added. They can now sign in with their email.');await load();}
 catch(err){$('#form-error').textContent=err.code==='23505'?'That email or teammate name already exists.':err.message;}finally{saving=false;b.disabled=false;}};
}
function brandContacts(m){return Array.isArray(m?.contacts)?m.contacts:(m&&(m.contact_name||m.email||m.phone||m.website)?[{name:m.contact_name||'',email:m.email||'',phone:m.phone||'',website:m.website||'',facebook:m.facebook||'',notes:''}]:[]);}
function contactLinks(c){const fb=facebookLink(c.facebook);const web=safeLinks(c.website||'')[0];return `<div class="contact-links">${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:''}${c.phone?`<span>${esc(c.phone)}</span>`:''}${web?`<a href="${esc(web)}" target="_blank" rel="noopener noreferrer">Website &nearr;</a>`:''}${fb?`<a href="${esc(fb)}" target="_blank" rel="noopener noreferrer" class="facebook-link">Facebook &nearr;</a>`:''}</div>`;}
function renderBrands(contacts=false){
 $('#main').innerHTML=heading('OUR PARTNERS IN FLIGHT','Brands & Contacts',contacts?'Your people at every brand. Contact details, Facebook pages, and notes together.':'Your brand directory and partnership notes.',`<button id="add-brand" class="primary">+ Add brand</button>`)+extensionNotice()+`<div class="brand-grid">${manufacturers.map((m,i)=>{const people=brandContacts(m);return `<article class="brand-card" data-brand="${i}"><h2>${esc(m.name)}</h2>${contacts?`${people.length?people.map(c=>`<section class="contact-summary"><h3>${esc(c.name||'Brand contact')}</h3>${contactLinks(c)}${c.notes?`<p>${esc(c.notes)}</p>`:''}</section>`).join(''):'<p>No contacts yet. Add your first contact below.</p>'}<button type="button" class="secondary add-contact-card" data-add-contact="${i}">+ Add contact</button>`:`<p>${esc(m.notes||'Ready for the next collaboration.')}</p>`}<button class="text-button">${contacts?'Open contacts & notes':'View brand'} &rarr;</button></article>`;}).join('')||'<div class="empty"><h3>No brands yet</h3><p>Add a brand to start your contact directory.</p></div>'}</div>`;
 $('#add-brand').onclick=()=>openBrand();document.querySelectorAll('[data-brand]').forEach(b=>b.onclick=e=>{if(e.target.closest('a'))return;openBrand(manufacturers[Number(b.dataset.brand)]);});
 document.querySelectorAll('[data-add-contact]').forEach(b=>b.onclick=e=>{e.stopPropagation();openBrand(manufacturers[Number(b.dataset.addContact)],true);});
}
function extensionNotice(){return extensionError?`<div class="notice error">${esc(extensionError)}</div>`:'';}
function renderMeetings(){
 $('#main').innerHTML=heading('ALIGN. CREATE. TAKE FLIGHT.','Team Notes','Keep the conversation, decisions, and next steps together.',`<div class="notes-actions"><button class="secondary" id="add-note">+ Add note</button><button class="primary" id="add-meeting">+ Add meeting</button></div>`)+extensionNotice()+`<div class="meeting-grid">${meetings.map((m,i)=>`<article class="meeting-card"><span class="eyebrow">${esc(date(m.meeting_date))}</span><h2>${esc(m.title)}</h2><p class="muted">${esc(m.attendees||'Team note')}</p><p class="note-preview">${esc(m.notes||'No notes yet.')}</p><div class="meeting-next"><b>Next steps</b><p>${esc(m.actions||'No action items recorded.')}</p></div><button class="text-button" data-meeting="${i}">Open notes &rarr;</button></article>`).join('')||'<div class="empty"><h3>A place for your next big idea</h3><p>Add a note or meeting to capture ideas, decisions, and action items.</p></div>'}</div>`;
 $('#add-note').onclick=()=>openMeeting(null,true);$('#add-meeting').onclick=()=>openMeeting();document.querySelectorAll('[data-meeting]').forEach(b=>b.onclick=()=>openMeeting(meetings[Number(b.dataset.meeting)]));
}
function openMeeting(m,note=false){
 showDialog(`<form id="meeting-form"><div class="dialog-heading"><div><span class="eyebrow">TEAM NOTES</span><h2 id="editor-title">${m?'Note details':note?'New team note':'New team meeting'}</h2></div><button type="button" data-close class="close" aria-label="Close">&times;</button></div><div class="dialog-content">${demo?'<div class="notice">Read-only sample meeting.</div>':''}<div class="form-grid">${field('title',note?'Note title *':'Title *','text',m?.title||'','required maxlength="500"')}${field('meeting_date','Date *','date',m?.meeting_date||localDate(),'required')}${note?'<input type="hidden" name="attendees" value="">':field('attendees','Attendees','text',m?.attendees||'','maxlength="500"')}</div><label>${note?'Note':'Notes & decisions'}<textarea name="notes" rows="8" maxlength="12000">${esc(m?.notes||'')}</textarea></label><label>Action items & owners<textarea name="actions" rows="5" maxlength="6000" placeholder="Owner / next step / due date">${esc(m?.actions||'')}</textarea></label><p id="form-error" role="alert"></p></div><div class="dialog-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary" ${demo?'disabled':''}>${note?'Save note':'Save changes'}</button></div></form>`);
 $('#meeting-form').onsubmit=e=>saveRecord(e,'marketing_meetings',m);
}
function localDate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
async function saveRecord(e,table,record){
 e.preventDefault();if(saving||demo)return;saving=true;const b=e.target.querySelector('[type=submit]');b.disabled=true;
 try{const data=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,v.trim()]));let q;
 if(record){delete data.name;q=db.from(table).update(data).eq(table==='manufacturers'?'name':'id',table==='manufacturers'?record.name:record.id).eq('revision',record.revision);}else q=db.from(table).insert(data);
 const {data:rows,error}=await q.select();if(error)throw error;if(!rows.length)throw Error('A teammate updated this record. Copy your changes, then reopen it to load the latest version.');
 $('#editor').close();focusReturn?.focus();toast('Saved to the team workspace.');await load();
 }catch(err){$('#form-error').textContent=err.message;}finally{saving=false;b.disabled=false;}
}
function field(key,label,type='text',value='',extra=''){return `<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
function select(key,label,values,value){return `<label>${label}<select name="${key}" aria-label="${esc(label)}" ${key==='manufacturer'?'required':''}>${values.map(v=>option(v,v||(key==='assigned'?'Unassigned':key==='manufacturer'?'Choose brand':'Not set'),value)).join('')}</select></label>`;}
function showDialog(html){focusReturn=document.activeElement;const d=$('#editor');d.innerHTML=html;d.showModal();d.querySelector('input,select,button')?.focus();d.oncancel=e=>{e.preventDefault();closeDialog();};d.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDialog);initialForm=JSON.stringify([...new FormData(d.querySelector('form'))]);}
function closeDialog(){if(saving)return;if(JSON.stringify([...new FormData($('#editor form'))])!==initialForm&&!confirm('Discard your unsaved changes?'))return;$('#editor').close();focusReturn?.focus();editing=null;}
function openEditor(p){
 editing=p?{...blank(),...p}:{...blank()};const x=editing;
 showDialog(`<form id="product-form" class="compact-product-form"><div class="dialog-heading"><div><span class="eyebrow">${p?'PRODUCT DETAILS':'NEW TO THE LAUNCH PAD'}</span><h2 id="editor-title">${p?esc(p.product):'Add a product'}</h2></div><button type="button" data-close class="close" aria-label="Close product">×</button></div><div class="dialog-content">${demo?'<div class="notice">Read-only demo. Explore the fields; saving is disabled.</div>':''}<h3>01 <span>The essentials</span></h3><div class="form-grid">${field('product','Product / item *','text',x.product,'required maxlength="500"')}${select('manufacturer','Brand *',['',...new Set([...manufacturers.map(m=>m.name),x.manufacturer].filter(Boolean))].sort(),x.manufacturer)}<label class="full">Short description<input name="description" value="${esc(x.description)}" maxlength="500"></label>${select('status','Overall status',STATUSES,x.status)}${select('assigned','Assigned to',['',...new Set([...peopleNames(),x.assigned].filter(Boolean))],x.assigned)}${field('eta','Estimated arrival','date',x.eta)}${field('received','Received on','date',x.received)}<label class="full">Promotion expiration date<input name="promotion_expires_on" type="date" value="${esc(x.promotion_expires_on)}"><small>Active through this date (Eastern time). Moves to Completed the following day. Leave blank for no expiration. Change or clear the date to return a completed promotion to the tracker.</small></label></div><h3>02 <span>Production checklist</span></h3><div class="form-grid">${STAGES.slice(0,6).map(k=>select(k,LABELS[k],PROGRESS,x[k])).join('')}</div><h3>03 <span>Out in the world</span></h3><div class="form-grid">${STAGES.slice(6).map(k=>select(k,LABELS[k],PROGRESS,x[k])).join('')}<label class="full">Published links<textarea name="links" rows="3" maxlength="6000" placeholder="https://… — one link per line">${esc(x.links)}</textarea><small>Full web addresses, separated by spaces or new lines.</small></label></div>${safeLinks(x.links).length?`<div class="link-list">${safeLinks(x.links).map((l,i)=>`<a href="${esc(l)}" target="_blank" rel="noopener noreferrer">Open published post ${i+1} ↗</a>`).join('')}</div>`:''}<h3>04 <span>Team notes</span></h3><label>Notes and handoffs<textarea name="notes" rows="4" maxlength="6000" placeholder="Anything the next teammate should know?">${esc(x.notes)}</textarea></label>${x.updated_at?`<p class="fine">Last updated ${esc(new Date(x.updated_at).toLocaleString())}<br>by ${esc(x.updated_by||'Workbook import')}</p>`:''}<p id="form-error" role="alert"></p></div><div class="dialog-actions"><button type="button" data-close class="secondary">Cancel</button><button type="submit" class="primary" ${demo?'disabled':''}>${p?'Save changes':'Add product'} <span>↗</span></button></div></form>`);
 $('#product-form').onsubmit=saveProduct;
}
async function saveProduct(e){
 e.preventDefault();if(demo||saving)return;const data={...blank(),...Object.fromEntries(new FormData(e.target))};for(const k of Object.keys(data))data[k]=data[k].trim();const error=validate(data);if(error){$('#form-error').textContent=error;return;}
 saving=true;const button=e.target.querySelector('[type=submit]');button.disabled=true;button.textContent='Saving…';$('#form-error').textContent='';
 try{
  let result;
  const payload={...data,eta:data.eta||null,received:data.received||null,promotion_expires_on:data.promotion_expires_on||null};
  if(editing.id)result=await db.from('products').update(payload).eq('id',editing.id).eq('revision',editing.revision).select('id');else result=await db.from('products').insert(payload).select('id');
  if(result.error)throw result.error;if(!result.data.length)throw new Error('Another teammate changed this product. Copy any notes you need, then close and reopen the product to load their changes.');
  saving=false;$('#editor').close();focusReturn?.focus();editing=null;toast('Saved to the team workspace.');await load();
 }catch(err){$('#form-error').textContent=err.message||'Unable to save. Your changes are still here; please retry.';}finally{saving=false;button.disabled=false;button.textContent='Save changes ↗';}
}
function contactFields(c={},index=0){return `<fieldset class="contact-fields"><legend>Contact ${index+1}</legend><div class="form-grid">${field('contact_name','Contact name','text',c.name||'','maxlength="500"')}${field('contact_email','Contact email','email',c.email||'','maxlength="500"')}${field('contact_phone','Phone','tel',c.phone||'','maxlength="500"')}${field('contact_website','Website','url',c.website||'','maxlength="500" placeholder="https://"')}${field('contact_facebook','Facebook','text',c.facebook||'','maxlength="500" placeholder="https://www.facebook.com/yourpage"')}<label class="full">Contact notes<textarea name="contact_notes" rows="2" maxlength="6000">${esc(c.notes||'')}</textarea></label></div>${contactLinks(c)}</fieldset>`;}
function openBrand(m,addContact=false){
 const contactsMode=true,people=[...brandContacts(m)],hadContacts=people.length>0;if(!people.length)people.push({});
 showDialog(`<form id="brand-form"><div class="dialog-heading"><h2 id="editor-title">${m?esc(m.name):'Add brand'}</h2><button type="button" class="close" data-close aria-label="Close">&times;</button></div><div class="dialog-content">${demo?'<div class="notice">Read-only demo. Contact details below are fictional.</div>':''}<h3>01 <span>Brand</span></h3><div class="form-grid">${field('name','Brand name *','text',m?.name||'',`required maxlength="500" ${m?'readonly':''}`)}</div><h3>02 <span>People & contact details</span></h3><div id="brand-contacts">${people.map(contactFields).join('')}</div><button type="button" id="add-contact" class="secondary">+ Add another contact</button><h3>03 <span>Conversation & notes</span></h3><label>Brand notes<textarea name="notes" rows="4" maxlength="6000">${esc(m?.notes||'')}</textarea></label><p id="form-error" role="alert"></p></div><div class="dialog-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary" ${demo?'disabled':''}>${m?'Save contact':'Add brand'}</button></div></form>`);
 const appendContact=()=>{const count=$('#brand-contacts').children.length;if(count>=30){toast('You can add up to 30 contacts per brand.');return;}$('#brand-contacts').insertAdjacentHTML('beforeend',contactFields({},count));$('#brand-contacts').lastElementChild.querySelector('input').focus();};
 $('#add-contact').onclick=appendContact;if(addContact&&hadContacts)appendContact();
 $('#brand-form').onsubmit=async e=>{e.preventDefault();if(saving||demo)return;
 const people=[...e.target.querySelectorAll('.contact-fields')].map(el=>{const value=name=>el.querySelector(`[name="contact_${name}"]`).value.trim();return {name:value('name'),email:value('email'),phone:value('phone'),website:value('website'),facebook:value('facebook'),notes:value('notes')};}).filter(c=>Object.values(c).some(Boolean));
 for(const c of people){if(c.facebook&&!facebookLink(c.facebook)){$('#form-error').textContent='Use a Facebook page link on facebook.com, fb.com, or fb.me.';return;}if(c.facebook)c.facebook=facebookLink(c.facebook);}
 const data={name:e.target.elements.name.value.trim(),notes:e.target.elements.notes.value.trim(),contacts:people};
 saving=true;const b=e.target.querySelector('[type=submit]');b.disabled=true;
 try{let q;if(m){delete data.name;q=db.from('manufacturers').update(data).eq('name',m.name).eq('revision',m.revision);}else q=db.from('manufacturers').insert(data);const {data:rows,error}=await q.select();if(error)throw error;if(!rows.length)throw Error('A teammate changed this brand. Copy your changes and reopen it to load the latest version.');$('#editor').close();focusReturn?.focus();toast('Brand contacts saved.');await load();}catch(err){$('#form-error').textContent=err.message;}finally{saving=false;b.disabled=false;}
 };
}
function exportCSV(){
 const keys=Object.keys(blank());const rows=[keys.map(k=>LABELS[k]||k),...visibleProducts().map(p=>keys.map(k=>p[k]))];const text='\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='flight-team-products-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const workspaceData=()=>JSON.stringify([products,manufacturers,teammates,canManageTeam,teamError,meetings,extensionError,syncError]);
async function load(notify=false){
 if(demo||!session||!authorized||loading||$('#editor').open)return;loading=true;const version=++loadVersion;const previous=workspaceData();
 try{
  const [p,m]=await Promise.all([db.from('products').select('*').order('updated_at',{ascending:false}),db.from('manufacturers').select('*').order('name')]);if(p.error)throw p.error;if(m.error)throw m.error;
  if(version!==loadVersion||!session)return;products=p.data;manufacturers=m.data;
  const [directory,admin]=await Promise.all([db.from('team_members').select('email,display_name').order('display_name'),db.rpc('is_team_admin')]);
  if(version!==loadVersion||!session)return;teammates=directory.data||[];canManageTeam=admin.data===true;teamError=directory.error||admin.error?'Team management needs supabase/05-team-management.sql applied in Supabase.':'';
  const meetingResult=await db.from('marketing_meetings').select('*').order('meeting_date',{ascending:false});
  if(version!==loadVersion||!session)return;extensionError=meetingResult.error?(['42P01','PGRST205'].includes(meetingResult.error.code)?'Contacts and meeting notes require the database upgrade: run supabase/03-workspace-upgrade.sql in Supabase.':'Could not load team notes. '+meetingResult.error.message):'';meetings=meetingResult.data||[];lastSync=new Date();syncError='';
  if($('#editor').open)return;
  if(!$('#main')||previous!==workspaceData()){const scrollY=window.scrollY;render();window.scrollTo({top:scrollY,behavior:'instant'});}if(notify)toast('You?re up to date.');
 }catch(err){syncError='Could not refresh shared data. '+(products.length?'Showing the last loaded version. ':'')+err.message;if($('#main')&&!$('#editor').open&&previous!==workspaceData())render();else if(!$('#main'))renderGate(syncError);if(notify)toast(syncError);}finally{loading=false;const label=$('#sync-label');if(label)label.textContent=syncError?'Sync failed':'Shared workspace';$('#refresh')?.removeAttribute('disabled');}
}
async function enter(next){
 stopPresence();session=next;authorized=false;if(!session){teammates=[];canManageTeam=false;products=[];manufacturers=[];renderGate();return;}
 const {data,error}=await db.from('team_members').select('email').eq('email',session.user.email.toLowerCase()).maybeSingle();
 if(error){renderGate('Unable to verify access: '+error.message);return;}if(!data){renderGate('',true);return;}authorized=true;await load();startPresence();
}
async function signout(){if(demo){demo=false;products=[];manufacturers=[];renderGate();return;}if($('#editor').open)return;loadVersion++;const {error}=await db.auth.signOut();if(error){toast(error.message);return;}stopPresence();session=null;products=[];manufacturers=[];renderGate();}
async function boot(){
 if(new URLSearchParams(location.search).has('demo')){startDemo();return;}
 if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){renderGate();return;}
 try{
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl))throw new Error('Check the Supabase project URL in config.js.');
  if(cfg.supabasePublishableKey.startsWith('sb_secret_'))throw new Error('Use the publishable key, never a secret key.');
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.8');db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{global:{fetch:async(url,options={})=>{const controller=new AbortController();const abort=()=>controller.abort();if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,15000);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}}}});
  const {data,error}=await db.auth.getSession();if(error)throw error;await enter(data.session);
  db.auth.onAuthStateChange((event,next)=>{if(['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED'].includes(event))setTimeout(()=>{if(next?.user?.id!==session?.user?.id)enter(next);else session=next;},0);});
 }catch(err){renderGate('Connection error: '+err.message);}
}
window.addEventListener('focus',()=>load());window.addEventListener('online',()=>load());setInterval(()=>{if(!document.hidden){const today=promotionToday();if(today!==lastPromotionDay){lastPromotionDay=today;if((demo||authorized)&&!$('#editor').open)render();}load();}},60000);
window.addEventListener('beforeunload',e=>{if($('#editor').open&&JSON.stringify([...new FormData($('#editor form'))])!==initialForm){e.preventDefault();e.returnValue='';}});
function summaryTitle(){if(view==='completed')return 'Completed promotions';return {progress:'In progress',attention:'Embargo',social:'Socially active'}[filters.summary]||'All products';}
function visibleProducts(){return filtered(products.filter(p=>isCompleted(p)===(view==='completed')),filters).filter(p=>filters.summary==='progress'?p.status==='In progress':filters.summary==='attention'?p.status==='Blocked':filters.summary==='social'?['fb','ig','yt'].some(k=>p[k]==='Done'):true);}
function navigate(next,summary){view=next;filters=next==='products'?{summary:summary||'all'}:{};const hash=next+(summary&&summary!=='all'?'/'+summary:'');if(location.hash.slice(1)!==hash)history.pushState(null,'','#'+hash);render();window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',()=>{const [next,summary]=location.hash.slice(1).split('/');view=next==='brands'?'contacts':['products','completed','team','contacts','meetings'].includes(next)?next:'products';filters={summary:summary||'all'};if(demo||authorized)render();});
if(view==='brands')view='contacts';
filters.summary=location.hash.split('/')[1]||'all';
async function installApp(){if(installPrompt){await installPrompt.prompt();installPrompt=null;}else toast('Install from your browser menu, or on iPhone: Share > Add to Home Screen.');}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.addEventListener('appinstalled',()=>toast('Flight Team installed.'));
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
boot();

function openProductShare(p){
 if(!p)return;
 const included=value=>Boolean(value&&value!=='N/A'&&value!=='Not set');
 const stages=STAGES.filter(k=>included(p[k]));
 const headerUrl=new URL(matchMedia('(prefers-color-scheme: dark)').matches?'./header-night.png':'./header-day.png',location.href).href;
 const details=[['Brand',p.manufacturer],['Status',isCompleted(p)?'Completed':p.status],['Assigned to',p.assigned||'Unassigned'],['Estimated arrival',date(p.eta)],['Received',date(p.received)],['Promotion ends',p.promotion_expires_on?date(p.promotion_expires_on):'No expiration']].filter(([,value])=>included(value));
 const text=[p.product+' - Promotion Plan',...details.map(([k,v])=>k+': '+v),p.description,'','PRODUCTION & PUBLISHING',...stages.map(k=>LABELS[k]+': '+(p[k]||'Not set')),'',p.notes?'TEAM NOTES\n'+p.notes:'',p.links?'PUBLISHED LINKS\n'+p.links:''].filter(v=>v!==undefined).join('\n');
 const filename=(p.product.replace(/[^a-z0-9_-]+/gi,'-').slice(0,80)||'product')+'-plan.png';
 showDialog(`<form id="share-plan-form"><div class="dialog-heading"><h2 id="editor-title">Promotion Plan</h2><button type="button" class="close" data-close aria-label="Close">&times;</button></div><div class="dialog-content"><p class="fine">This image includes saved product details and team notes. Preview it before sharing.</p><div id="plan-preview" aria-busy="true"></div><p id="share-status" role="status">Generating image...</p></div><div class="dialog-actions share-actions"><button type="button" class="secondary" id="copy-plan">Copy text</button><button type="button" class="secondary" id="download-plan" disabled>Download PNG</button><button type="button" class="primary" id="share-plan" disabled>Share image</button></div></form>`);
 const status=message=>$('#share-status').textContent=message;
 const download=blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 $('#copy-plan').onclick=async()=>{try{await navigator.clipboard.writeText(text);status('Plan copied.');}catch{status('Clipboard unavailable. Download the image instead.');}};
 const form=$('#share-plan-form');
 createPlanImage(p,headerUrl,details,stages).then(blob=>{
 if(!form.isConnected)return;
 const previewUrl=URL.createObjectURL(blob);const img=new Image();img.src=previewUrl;img.alt=p.product+' promotion plan';img.className='plan-screenshot';$('#plan-preview').replaceChildren(img);$('#plan-preview').setAttribute('aria-busy','false');img.onload=()=>URL.revokeObjectURL(previewUrl);
 const file=new File([blob],filename,{type:'image/png'});
 $('#download-plan').disabled=false;$('#share-plan').disabled=false;status('Image ready to share.');
 $('#download-plan').onclick=()=>{download(blob);status('PNG downloaded. Attach it to your message or post.');};
 $('#share-plan').onclick=async()=>{try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({title:p.product+' - Promotion Plan',files:[file]});status('Image shared.');}else{download(blob);status('PNG downloaded. Attach it to your message or post.');}}catch(err){if(err.name!=='AbortError')status('Could not share. Use Download PNG to save the image.');}};
 }).catch(()=>{if(form.isConnected)status('Could not generate the image. Close the preview and try again.');});
}

async function createPlanImage(p,headerUrl,details,stages){
 const header=new Image();header.src=headerUrl;await header.decode();
 // Render one fixed-width grid so the preview and shared PNG match on every device.
 const canvas=document.createElement('canvas');canvas.width=1000;
 let ctx=canvas.getContext('2d');const commands=[];let y=0;
 const rect=(x,top,w,h,color)=>commands.push(()=>{ctx.fillStyle=color;ctx.fillRect(x,top,w,h);});
 const label=(value,x,top,width,size=32,bold=false,color='#173447')=>{
 ctx.font=`${bold?'700':'400'} ${size}px Arial, sans-serif`;
 const lines=[];
 for(const paragraph of String(value||'').split('\n')){
 let line='';for(const char of paragraph){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line='';}line+=char;}lines.push(line);
 }
 commands.push(()=>{ctx.font=`${bold?'700':'400'} ${size}px Arial, sans-serif`;ctx.fillStyle=color;ctx.textBaseline='top';lines.forEach((line,i)=>ctx.fillText(line,x,top+i*size*1.4));});
 return lines.length*size*1.4;
 };
 const headerHeight=1000*header.naturalHeight/header.naturalWidth;
 commands.push(()=>ctx.drawImage(header,0,0,1000,headerHeight));y=headerHeight+32;
 y+=label('AMAIN FLIGHT TEAM \u00b7 PROMOTION PLAN',40,y,920,24,true,'#647884')+18;
 y+=label(p.product,40,y,920,44,true)+12;
 if(p.description)y+=label(p.description,40,y,920)+24;
 const grid=items=>{for(let i=0;i<items.length;i+=2){const top=y;let height=0;items.slice(i,i+2).forEach(([key,value],col)=>{const x=40+col*468;const start=commands.length;const h=label(key,x+18,top+16,412,26,false,'#536875')+8;const content=h+label(value,x+18,top+16+h,412,34,true)+32;height=Math.max(height,content);commands.splice(start,0,()=>{ctx.fillStyle='#f0f4f6';ctx.fillRect(x,top,452,height);});});y+=height+16;}};
 grid(details);y+=12;
 if(stages.length){y+=label('Production & publishing',40,y,920,36,true)+18;grid(stages.map(k=>[LABELS[k],p[k]]));}
 for(const [title,value] of [['Team notes',p.notes],['Published links',p.links]])if(value){y+=20;y+=label(title,40,y,920,36,true)+12;y+=label(value,40,y,920);}
 canvas.height=Math.ceil(y+40);ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1000,canvas.height);commands.forEach(draw=>draw());
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed')),'image/png'));
}

function teamAvatarMarkup(){
 const members=teammates.length?teammates:PEOPLE.map(display_name=>({display_name,email:''}));
 return members.map(m=>{const name=m.display_name||m.email?.split('@')[0]||'Teammate';const online=presenceReady&&onlineEmails.has((m.email||'').toLowerCase());const status=online?'Online':presenceReady?'Offline':'Presence unavailable';return `<span class="${online?'online':''}" title="${esc(name)} ? ${status}" aria-label="${esc(name)} ? ${status}">${esc(name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase())}</span>`;}).join('');
}
function updatePresenceAvatars(){const el=$('.team-avatars');if(el)el.innerHTML=teamAvatarMarkup();}
function stopPresence(){const old=presenceChannel;presenceChannel=null;presenceReady=false;onlineEmails.clear();if(old)db.removeChannel(old);updatePresenceAvatars();}
function startPresence(){
 if(!db?.channel||!authorized||!session||presenceChannel)return;
 const channel=db.channel('flight-team-online',{config:{private:true,presence:{key:session.user.id}}});presenceChannel=channel;
 channel.on('presence',{event:'sync'},()=>{if(presenceChannel!==channel)return;onlineEmails=new Set(Object.values(channel.presenceState()).flat().map(p=>(p.email||'').toLowerCase()));updatePresenceAvatars();}).subscribe(async status=>{
  if(presenceChannel!==channel)return;
  presenceReady=status==='SUBSCRIBED';if(!presenceReady)onlineEmails.clear();updatePresenceAvatars();
  if(presenceReady&&!document.hidden)await channel.track({email:session.user.email.toLowerCase()});
 });
}
document.addEventListener('visibilitychange',()=>{if(!presenceChannel||!presenceReady)return;if(document.hidden)presenceChannel.untrack();else if(session)presenceChannel.track({email:session.user.email.toLowerCase()});});
window.addEventListener('offline',()=>{presenceReady=false;onlineEmails.clear();updatePresenceAvatars();});
