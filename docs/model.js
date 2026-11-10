export const STAGES=['unbox','build','flights','review','editing','fb','ig','yt'];
export const LABELS={unbox:'Unboxing',build:'Build video',flights:'Flights',review:'Review',editing:'Editing',fb:'Facebook',ig:'Instagram',yt:'YouTube'};
export const STATUSES=['On track','In progress','Blocked','On hold'];
export const PROGRESS=['','Not started','In progress','Done','N/A'];
export const PEOPLE=['Jason','Frank','Kevin','Danthell'];
export function blank(){return {status:'On track',manufacturer:'',product:'',description:'',eta:'',received:'',assigned:'',unbox:'',build:'',flights:'',review:'',editing:'',fb:'',ig:'',yt:'',links:'',notes:''};}
export function completion(p){const s=STAGES.filter(k=>p[k]!=='N/A');return {done:s.filter(k=>p[k]==='Done').length,total:s.length};}
export function filtered(products,{query='',status='',assigned='',manufacturer=''}={}){const q=query.toLowerCase().trim();return products.filter(p=>(!q||[p.product,p.manufacturer,p.description,p.assigned,p.notes].join(' ').toLowerCase().includes(q))&&(!status||p.status===status)&&(!assigned||(assigned==='__unassigned'?!p.assigned:p.assigned===assigned))&&(!manufacturer||p.manufacturer===manufacturer));}
export function validate(p){
 if(!p.product?.trim()||!p.manufacturer?.trim())return 'Add a product name and manufacturer.';
 if(!STATUSES.includes(p.status)||STAGES.some(k=>!PROGRESS.includes(p[k])))return 'Choose a valid status for every stage.';
 for(const [key,value] of Object.entries(p))if(typeof value==='string'&&value.length>(['links','notes'].includes(key)?6000:500))return `${key} is too long.`;
 for(const k of ['eta','received'])if(p[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(p[k])||new Date(p[k]+'T00:00:00Z').toISOString().slice(0,10)!==p[k]))return 'Choose valid arrival dates.';
 if(p.links.split(/\s+/).filter(Boolean).some(l=>{try{return !['https:','http:'].includes(new URL(l).protocol);}catch{return true;}}))return 'Use complete http or https links, separated by spaces or new lines.';
 return '';
}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function safeLinks(value){return value.split(/\s+/).filter(s=>{try{return ['http:','https:'].includes(new URL(s).protocol);}catch{return false;}});}
