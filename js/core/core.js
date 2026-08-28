'use strict';
window.DCOS_VERSION='15.29';
window.DCOS_CONFIG={apiKey:'AIzaSyBmrVHcHiKMBFBrGy6tclLTWJNqT1vpdUg',authDomain:'dr-taher-dental-chain.firebaseapp.com',projectId:'dr-taher-dental-chain',storageBucket:'dr-taher-dental-chain.firebasestorage.app',messagingSenderId:'774632785801',appId:'1:774632785801:web:53402df65a051a85434358',measurementId:'G-DX7JFR4W18'};
window.ADMIN_PASS='DTDC2026';
const LS_PREFIX='dcos_v15_';
function $(id){return document.getElementById(id)}
function qs(k){return new URLSearchParams(location.search).get(k)}
function safeId(v){return String(v||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_')}
function uid(){return 'id_'+Date.now()+'_'+Math.random().toString(16).slice(2)}
function now(){return new Date().toISOString()}
function today(){return new Date().toLocaleDateString('en-GB')}
function toast(msg){let d=document.createElement('div');d.className='toast';d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),2500)}
function setStatus(txt){let s=$('status'); if(s)s.textContent=txt}
function money(n){return Number(n||0).toLocaleString('en-US')+' ل.س'}
function localGet(path, fallback){try{return JSON.parse(localStorage.getItem(LS_PREFIX+path)||JSON.stringify(fallback))}catch(e){return fallback}}
function localSet(path, val){localStorage.setItem(LS_PREFIX+path,JSON.stringify(val));return val}
function pathToKey(path){return path.replace(/\//g,'__')}
const Store={db:null,online:false, async init(){try{if(window.firebase){try{firebase.app('dcos-v15')}catch(e){firebase.initializeApp(DCOS_CONFIG,'dcos-v15')}this.db=firebase.app('dcos-v15').firestore();this.online=true;setStatus('متصل');}}catch(e){this.online=false;setStatus('وضع محلي')}}, async get(path, fallback=null){if(this.db){try{let snap=await this.db.doc(path).get(); if(snap.exists)return snap.data()}catch(e){console.warn('get fail',path,e)}}return localGet(pathToKey(path),fallback)}, async set(path,data){let clean=JSON.parse(JSON.stringify(data||{}));localSet(pathToKey(path),clean); if(this.db){try{await this.db.doc(path).set(clean,{merge:true})}catch(e){console.warn('set fail',path,e)}} return clean}, async del(path){localStorage.removeItem(LS_PREFIX+pathToKey(path)); if(this.db){try{await this.db.doc(path).delete()}catch(e){console.warn('del fail',path,e)}}}, async list(colPath){if(this.db){try{let snap=await this.db.collection(colPath).get();let arr=[];snap.forEach(d=>arr.push({id:d.id,...d.data()}));return arr}catch(e){console.warn('list fail',colPath,e)}} let prefix=LS_PREFIX+pathToKey(colPath+'/');let out=[];for(let i=0;i<localStorage.length;i++){let k=localStorage.key(i); if(k&&k.startsWith(prefix)){try{let id=k.slice(prefix.length).split('__')[0];out.push({id,...JSON.parse(localStorage.getItem(k))})}catch(e){}}}return out}, async add(colPath,data,id=null){id=safeId(id||data.id||uid());data={...data,id};await this.set(colPath+'/'+id,data);return data}};
const Audit={async log(clinicId,action,details,user){let row={id:uid(),clinicId:clinicId||'network',action,details:details||'',user:user?.email||user?.name||'system',at:now()};await Store.add((clinicId?'clinics/'+clinicId+'/audit':'network/audit'),row,row.id);}};
const Session={key:'dcos_v15_session',get(){return localGet(this.key,null)},set(s){localSet(this.key,s)},clear(){localStorage.removeItem(LS_PREFIX+this.key)}};
async function getClinics(){let arr=await Store.list('network/clinics'); if(!arr.length){let c={id:'taher-main-clinic',name:'عيادة أ.د. طاهر الأجا',city:'طرطوس',phone:'',createdAt:now()}; await Store.add('network/clinics',c,c.id); arr=[c]} return arr}
async function getClinic(id){if(!id)return null;let c=await Store.get('network/clinics/'+safeId(id),null);return c}
async function getAccountsAll(){let network=await Store.list('network/accounts');let clinics=await getClinics();let all=[...network];for(const c of clinics){let a=await Store.list('clinics/'+c.id+'/accounts');a.forEach(x=>all.push({...x,clinicId:c.id,clinicName:c.name}))}let by={};all.forEach(a=>{by[(a.email||a.id||uid()).toLowerCase()]=a});return Object.values(by)}
async function findAccount(email,clinicId){email=String(email||'').trim().toLowerCase();let n=await Store.get('network/accounts/'+safeId(email),null); if(n&&n.email)return n;if(clinicId){let a=await Store.get('clinics/'+safeId(clinicId)+'/accounts/'+safeId(email),null); if(a&&a.email)return a}return null}
async function saveAccount(acc){acc.email=String(acc.email||'').trim().toLowerCase();acc.id=safeId(acc.email);acc.updatedAt=now(); if(acc.role==='super_owner')return Store.set('network/accounts/'+acc.id,acc); if(!acc.clinicId)throw new Error('الحساب يحتاج عيادة'); return Store.set('clinics/'+safeId(acc.clinicId)+'/accounts/'+acc.id,acc)}
async function deleteAccount(acc){if(acc.role==='super_owner')await Store.del('network/accounts/'+safeId(acc.email));else await Store.del('clinics/'+safeId(acc.clinicId)+'/accounts/'+safeId(acc.email));}

// v15.5 lightweight diagnostics — no UI flicker, opened only by Ctrl+Alt+D
window.DCOS_ERRORS=[];
(function(){
  const push=(type,args)=>{try{window.DCOS_ERRORS.push({type,at:new Date().toLocaleString(),text:[...args].map(x=>x&&x.stack?x.stack:(typeof x==='object'?JSON.stringify(x):String(x))).join(' ')}); if(window.DCOS_ERRORS.length>120)window.DCOS_ERRORS.shift();}catch(e){}};
  const oldErr=console.error; console.error=function(){push('console.error',arguments); oldErr.apply(console,arguments)};
  window.addEventListener('error',e=>push('error',[e.message,e.filename+':'+e.lineno]));
  window.addEventListener('unhandledrejection',e=>push('promise',[e.reason]));
})();
function adminCheck(label='كلمة سر الإدارة'){let p=prompt(label+':');return p===window.ADMIN_PASS;}
window.DCOS_openErrorLog=function(){let rows=(window.DCOS_ERRORS||[]).slice().reverse();let html=`<h2>سجل الأخطاء</h2><p class="muted">يفتح بالاختصار Ctrl + Alt + D</p><div class="dev-tool ltr" style="max-height:55vh;overflow:auto;white-space:pre-wrap">${rows.length?rows.map(r=>`[${r.at}] ${r.type}\n${String(r.text).replace(/[<>&]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}`).join('\n\n'):'No errors recorded.'}</div><br><button onclick="window.DCOS_clearErrorLog&&window.DCOS_clearErrorLog()">مسح السجل</button><button onclick="document.getElementById('modalRoot').innerHTML=''">إغلاق</button>`;let r=document.getElementById('modalRoot')||document.createElement('div');r.id='modalRoot';document.body.appendChild(r);r.innerHTML=`<div class="modal-back"><div class="modal">${html}</div></div>`};
window.DCOS_clearErrorLog=function(){window.DCOS_ERRORS=[];window.DCOS_openErrorLog()};

window.DCOS={Store,Audit,Session,$,qs,safeId,uid,now,today,toast,setStatus,money,getClinics,getClinic,getAccountsAll,findAccount,saveAccount,deleteAccount,adminCheck};
