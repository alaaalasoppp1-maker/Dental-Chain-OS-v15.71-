
(function(){
"use strict";
const VERSION="Dental Chain OS v13 Clean UI Permissions";
const CONFIG_KEY="dcos_v9_firebase_config";
const LEGACY_KEYS=["clinic_v8_firebase_config","clinicFirebaseConfig","firebaseConfig"];
const DEVICE_KEY="dcos_v9_device_id";
const MODE_KEY="dcos_v9_sync_mode";
const DELETED_KEY="dcos_v9_deleted_patient_ids";
const TRASH_KEY="dcos_v9_deleted_patients";
const AUDIT_KEY="dcos_v9_audit_log";
const DIRTY_KEY="dcos_v10_sync_dirty";
const LAST_SYNC_KEY="dcos_v10_last_sync";
const CLINIC_KEY="dcos_v9_clinic_id";
const LOCAL_ONLY_KEYS=["media","images","xrays","photos","attachments","files","localImages","localMedia"];
let fbApp=null, db=null, unsubscribe=null, isApplyingRemote=false;
let lastRemoteCount="-", lastStatus="غير متصل", lastError="";

function $(id){return document.getElementById(id)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function deviceId(){let id=localStorage.getItem(DEVICE_KEY); if(!id){id="DEV-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); localStorage.setItem(DEVICE_KEY,id)} return id}
function nowIso(){return new Date().toISOString()}
function clinicId(){return localStorage.getItem(CLINIC_KEY)||"default"}

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(e){return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function getPatientsSafe(){try{if(typeof getPatients==="function")return getPatients()||[]}catch(e){} return readJson("patients",[])}
function savePatientsSafe(list){try{if(typeof savePatients==="function")return savePatients(list||[])}catch(e){} writeJson("patients",list||[])}
function patientId(p,i){return String((p&&(p.id||p.fileNo||p.phone||p.name))||("patient-"+i)).replace(/[\/#?[\]]/g,"_").slice(0,140)}
function parseConfigText(text){if(!text)return null; try{let t=text.trim().replace(/^const\s+firebaseConfig\s*=\s*/,"").replace(/^var\s+firebaseConfig\s*=\s*/,"").replace(/^let\s+firebaseConfig\s*=\s*/,"").replace(/;$/,""); let o=JSON.parse(t); return o&&o.apiKey?o:null}catch(e){} try{let m=text.match(/\{[\s\S]*\}/); if(m){let o=Function("return ("+m[0]+")")(); return o&&o.apiKey?o:null}}catch(e){} return null}
function getConfig(){try{let raw=localStorage.getItem(CONFIG_KEY); if(raw){let c=JSON.parse(raw); if(c&&c.apiKey)return c}}catch(e){} for(const k of LEGACY_KEYS){try{let raw=localStorage.getItem(k); if(raw){let c=JSON.parse(raw); if(c&&c.apiKey){saveConfig(c); return c}}}catch(e){}} try{if(typeof clinicV8GetConfig==="function"){let c=clinicV8GetConfig(); if(c&&c.apiKey){saveConfig(c); return c}}}catch(e){} return null}
function saveConfig(c){localStorage.setItem(CONFIG_KEY,JSON.stringify(c)); try{localStorage.setItem("clinic_v8_firebase_config",JSON.stringify(c))}catch(e){} try{if(typeof clinicV8SaveConfig==="function")clinicV8SaveConfig(c)}catch(e){}}
function initFirebase(c){if(!window.firebase)throw new Error("Firebase لم يتم تحميله بعد"); if(!c||!c.apiKey)throw new Error("إعدادات Firebase غير صحيحة"); try{fbApp=firebase.app("dcos-v10")}catch(e){fbApp=firebase.initializeApp(c,"dcos-v10")} db=firebase.firestore(fbApp); return db}
function patientsRef(){if(!db)initFirebase(getConfig()); return db.collection("clinics").doc(clinicId()).collection("patients")}
function metaRef(){if(!db)initFirebase(getConfig()); return db.collection("clinics").doc(clinicId()).collection("_meta").doc("sync")}

function auditLog(action,details){try{let list=readJson(AUDIT_KEY,[]); list.push({id:"AUD-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),at:nowIso(),action,device:deviceId(),details:details||{},version:VERSION}); writeJson(AUDIT_KEY,list.slice(-700))}catch(e){}}
function markDirty(reason){if(isApplyingRemote)return; localStorage.setItem(DIRTY_KEY,JSON.stringify({dirty:true,reason:reason||"local-save",at:nowIso(),device:deviceId()})); auditLog("local_dirty",{reason:reason||"local-save"})}
function clearDirty(){localStorage.setItem(DIRTY_KEY,JSON.stringify({dirty:false,at:nowIso(),device:deviceId()}))}
function dirtyInfo(){return readJson(DIRTY_KEY,{dirty:false})}

function stripLocalOnlyFields(obj){
  if(!obj||typeof obj!=="object")return obj;
  if(Array.isArray(obj))return obj.map(stripLocalOnlyFields);
  let out={};
  Object.keys(obj).forEach(k=>{
    if(LOCAL_ONLY_KEYS.includes(k))return;
    let v=obj[k];
    if(v instanceof File || v instanceof Blob)return;
    if(v&&typeof v==="object"&&typeof v.arrayBuffer==="function")return;
    out[k]=stripLocalOnlyFields(v);
  });
  return out;
}
function localMediaPatch(p){let out={}; LOCAL_ONLY_KEYS.forEach(k=>{if(p&&Object.prototype.hasOwnProperty.call(p,k))out[k]=p[k]}); return out}
function normalizePatient(p,i,stamp){
  let c=stripLocalOnlyFields(JSON.parse(JSON.stringify(p||{})));
  c.id=patientId(c,i);
  c.deleted=false;
  c.deletedAt=null;
  c.snapshot=null;
  c.updatedAt=stamp||c.updatedAt||nowIso();
  c.updatedBy=deviceId();
  c.syncVersion="v10.4";
  return c;
}
function deletedSet(){return new Set(readJson(DELETED_KEY,[]))}
function saveDeletedSet(set){writeJson(DELETED_KEY,Array.from(set||[]))}
function trashRecords(){return readJson(TRASH_KEY,[])}
function saveTrashRecords(list){writeJson(TRASH_KEY,list||[])}
function upsertTrashRecord(id,patient,deletedAt){let list=trashRecords(); let idx=list.findIndex(x=>x.id===id); let rec={id,patient:patient||null,deletedAt:deletedAt||nowIso(),deletedBy:deviceId()}; if(idx>=0)list[idx]={...list[idx],...rec,patient:rec.patient||list[idx].patient}; else list.push(rec); saveTrashRecords(list)}
function markDeletedPatients(items){let set=deletedSet(); (items||[]).forEach(x=>{let id=x.id||patientId(x.patient||x,0); if(id){set.add(id); upsertTrashRecord(id,x.patient||x,x.deletedAt)}}); saveDeletedSet(set); markDirty("delete")}
function unmarkDeletedId(id){let set=deletedSet(); set.delete(id); saveDeletedSet(set); saveTrashRecords(trashRecords().filter(x=>x.id!==id)); markDirty("restore")}

function mergePatients(local,remote){
  let del=deletedSet(), map=new Map(), localMap=new Map();
  (local||[]).forEach((p,i)=>{let id=patientId(p,i); localMap.set(id,p); if(!del.has(id))map.set(id,p)});
  (remote||[]).forEach((p,i)=>{
    let id=patientId(p,i);
    if(p&&p.deleted){
      let localOld=localMap.get(id);
      let localTime=new Date(localOld?.updatedAt||0).getTime();
      let delTime=new Date(p.deletedAt||p.updatedAt||0).getTime();
      if(!localOld || delTime>=localTime){
        del.add(id); upsertTrashRecord(id,p.snapshot||p.patient||localOld||null,p.deletedAt||p.updatedAt); map.delete(id);
      }
    }
  });
  saveDeletedSet(del);
  (remote||[]).forEach((p,i)=>{
    let id=patientId(p,i);
    if((p&&p.deleted)||del.has(id))return;
    let localOld=localMap.get(id);
    let current=map.get(id);
    let remoteClean={...p,...localMediaPatch(localOld)};
    if(!current) map.set(id,remoteClean);
    else{
      let a=new Date(current.updatedAt||current.syncMeta?.updatedAt||0).getTime();
      let b=new Date(p.updatedAt||p.syncMeta?.updatedAt||0).getTime();
      map.set(id,b>=a?{...current,...remoteClean}:current);
    }
  });
  return Array.from(map.values());
}

async function pushPatients(reason="manual"){
  let c=getConfig(); if(!c)throw new Error("لا توجد إعدادات Firebase"); initFirebase(c);
  let stamp=nowIso();
  let local=getPatientsSafe();
  let active=local.map((p,i)=>normalizePatient(p,i,stamp));
  let batch=db.batch();
  let localIds=new Set(active.map(p=>p.id));
  let del=deletedSet(), trash=trashRecords();
  active.forEach(p=>batch.set(patientsRef().doc(p.id),p,{merge:false}));
  del.forEach(id=>{
    if(!localIds.has(id)){
      let rec=trash.find(x=>x.id===id)||{};
      batch.set(patientsRef().doc(id),{id,deleted:true,snapshot:stripLocalOnlyFields(rec.patient||null),deletedAt:rec.deletedAt||stamp,updatedAt:stamp,updatedBy:deviceId(),syncVersion:"v10.4"},{merge:false});
    }
  });
  batch.set(metaRef(),{lastPushAt:stamp,lastPushBy:deviceId(),reason,count:active.length,deleteSync:true,localOnlyMediaExcluded:true,syncVersion:"v10.4"},{merge:true});
  await batch.commit();
  try{
    let patched=local.map((p,i)=>({...p,id:active[i].id,updatedAt:active[i].updatedAt,updatedBy:active[i].updatedBy,syncVersion:"v10.4"}));
    isApplyingRemote=true; savePatientsSafe(patched); isApplyingRemote=false;
  }catch(e){isApplyingRemote=false}
  clearDirty();
  auditLog("sync_push",{reason,count:active.length,localOnlyMediaExcluded:true});
  lastRemoteCount=active.length; lastStatus="متصل"; updateFab();
  return active.length;
}

async function pullPatients(show=false){
  let c=getConfig(); if(!c)throw new Error("لا توجد إعدادات Firebase"); initFirebase(c);
  let snap=await patientsRef().get(), remote=[];
  snap.forEach(d=>remote.push(d.data()));
  let activeCount=remote.filter(p=>!p.deleted).length;
  lastRemoteCount=activeCount;
  isApplyingRemote=true;
  let merged=mergePatients(getPatientsSafe(),remote);
  savePatientsSafe(merged);
  isApplyingRemote=false;
  auditLog("sync_pull",{count:activeCount,show,localMediaPreserved:true});
  lastStatus="متصل"; updateFab();
  if(show)alert("تم تنزيل المرضى: "+activeCount);
  try{if(typeof renderDashboard==="function")renderDashboard()}catch(e){}
  return activeCount;
}

async function runGlobalSync(reason="floating"){
  showSyncOverlay("جارٍ حفظ البيانات محلياً...");
  try{
    if(!getConfig()){hideSyncOverlay(); openSyncScreen(); return;}
    try{if(typeof saveAll==="function")saveAll()}catch(e){console.warn("saveAll before sync failed",e)}
    updateSyncOverlay("جارٍ رفع كل التحديثات إلى السحابة...");
    lastStatus="جارٍ الرفع"; updateFab();
    let pushed=await pushPatients(reason);
    updateSyncOverlay("تم رفع "+pushed+" ملف. جارٍ تنزيل آخر نسخة...");
    lastStatus="جارٍ التنزيل"; updateFab();
    let pulled=await pullPatients(false);
    localStorage.setItem(LAST_SYNC_KEY,JSON.stringify({at:nowIso(),pushed,pulled,reason,device:deviceId()}));
    updateSyncOverlay("تمت المزامنة بنجاح");
    lastStatus="متصل"; updateFab();
    try{if(typeof renderDashboard==="function")renderDashboard()}catch(e){}
    setTimeout(hideSyncOverlay,450);
    showToast("تم رفع التحديثات وتنزيل آخر البيانات");
  }catch(e){
    hideSyncOverlay(); isApplyingRemote=false;
    lastError=explain(e); lastStatus="خطأ"; updateFab();
    alert("فشلت المزامنة: "+lastError);
  }
}
function quickRefresh(){return runGlobalSync("floating-button")}

function showSyncOverlay(msg){let old=$("dcosSyncOverlay"); if(old)old.remove(); let d=document.createElement("div"); d.id="dcosSyncOverlay"; d.innerHTML='<div class="dcos-sync-box"><div class="dcos-spinner"></div><b>'+esc(msg||"جارٍ المزامنة...")+'</b><small>يتم الحفظ محليًا أولاً ثم الرفع ثم التنزيل</small></div>'; document.body.appendChild(d)}
function updateSyncOverlay(msg){let d=$("dcosSyncOverlay"); if(d){let b=d.querySelector("b"); if(b)b.textContent=String(msg||"جارٍ المزامنة...")}}
function hideSyncOverlay(){let d=$("dcosSyncOverlay"); if(d)d.remove()}
function showToast(msg){let old=$("v9Toast"); if(old)old.remove(); let t=document.createElement("div"); t.id="v9Toast"; t.className="v9-toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2200)}
function explain(e){return (e&&e.message)||String(e)||"خطأ غير معروف"}
function updateFab(){let fab=$("v9SyncFab"); if(fab){fab.title="رفع التحديثات ثم تنزيل آخر البيانات - "+(lastStatus||""); fab.dataset.status=lastStatus||""}}

function buildPairLink(){let cfg=getConfig()||parseConfigText($("v9ConfigText")?.value||""); if(!cfg)return""; let payload={type:"DentalChainOSPair",v:10,app:"Dental Chain OS",url:location.origin+location.pathname,config:cfg}; return location.origin+location.pathname+"#pair="+btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}
function applyPairHash(){try{let h=location.hash||""; if(!h.includes("pair="))return; let raw=h.split("pair=")[1].split("&")[0]; let payload=JSON.parse(decodeURIComponent(escape(atob(raw)))); if(payload&&payload.config&&payload.config.apiKey){saveConfig(payload.config); history.replaceState(null,"",location.pathname+location.search); alert("تم ربط الجهاز بالمزامنة.")}}catch(e){}}
function renderQr(){let box=$("v9QrBox"), input=$("v9PairLink"); if(!box)return; let link=buildPairLink(); box.innerHTML=""; if(input)input.value=link||""; if(!link){box.innerHTML="<p>احفظ إعدادات Firebase أولاً حتى يظهر QR.</p>";return} try{if(window.QRCode)new QRCode(box,{text:link,width:180,height:180}); else box.textContent=link}catch(e){box.textContent=link}}
function copyPairLink(){let link=buildPairLink(); if(!link){alert("لا يوجد رابط. احفظ إعدادات Firebase أولاً.");return} navigator.clipboard?.writeText(link); alert("تم نسخ رابط الربط")}
async function testConnection(){try{let cfg=getConfig()||parseConfigText($("v9ConfigText")?.value||""); if(!cfg){alert("أدخل إعدادات Firebase أولاً");return} saveConfig(cfg); initFirebase(cfg); await metaRef().set({testAt:nowIso(),device:deviceId(),version:VERSION},{merge:true}); lastStatus="متصل"; lastError=""; alert("الاتصال ناجح")}catch(e){lastError=explain(e);alert("فشل الاختبار: "+lastError)} openSyncScreen()}
async function saveConfigFromUI(){try{let cfg=parseConfigText($("v9ConfigText")?.value||""); if(!cfg){alert("الكود غير صحيح");return} saveConfig(cfg); initFirebase(cfg); await metaRef().set({savedAt:nowIso(),device:deviceId(),version:VERSION},{merge:true}); lastStatus="متصل"; openSyncScreen(); alert("تم حفظ الإعدادات")}catch(e){lastError=explain(e);openSyncScreen();alert("فشل الحفظ: "+lastError)}}

function localCount(){return getPatientsSafe().length}
async function remoteCount(){try{if(!getConfig())return "-"; initFirebase(getConfig()); let snap=await patientsRef().where("deleted","==",false).get(); return snap.size}catch(e){return lastRemoteCount||"-"}}
function openSyncScreen(){
  let cfg=getConfig(), dirty=dirtyInfo(), last=readJson(LAST_SYNC_KEY,null);
  let output=$("output"); if(!output)return;
  output.innerHTML=`
  <div class="card dcos-sync-screen">
    <span class="sync-status-badge">${esc(lastStatus)}</span>
    <h2>☁️ مزامنة Dental Chain OS v11.0.2 LTS</h2>
    <p>الحفظ المحلي تلقائي دائمًا. الزر العائم يرفع كل التحديثات ثم ينزل آخر البيانات.</p>
    <div class="sync-stats-grid">
      <div><small>الجهاز</small><b>${esc(deviceId())}</b></div>
      <div><small>المرضى المحليون</small><b>${localCount()}</b></div>
      <div><small>على السحابة</small><b id="v10RemoteCount">${esc(lastRemoteCount)}</b></div>
      <div><small>حالة محلية</small><b>${dirty&&dirty.dirty?"توجد تغييرات":"متزامن"}</b></div>
    </div>
    <div class="sync-config-box">
      <h3>Firebase إعداد</h3>
      <textarea id="v9ConfigText">${esc(cfg?JSON.stringify(cfg,null,2):"")}</textarea>
      <div class="sync-actions">
        <button onclick="dcosV9.saveConfig()">💾 حفظ</button>
        <button onclick="dcosV9.test()">🧪 اختبار</button>
        <button onclick="dcosV9.refresh()">🔄 مزامنة الآن</button>
        <button onclick="dcosV9.push()">⬆️ رفع فقط</button>
        <button onclick="dcosV9.pull()">⬇️ تنزيل فقط</button>
        <button onclick="dcosV9.trash()">🗑 سلة المحذوفات</button>
        <button onclick="dcosV9.audit()">🧾 سجل النشاط</button>
      </div>
    </div>
    <div class="sync-config-box">
      <h3>📱 ربط هاتف أو تابلت عبر QR</h3>
      <p>احفظ إعدادات Firebase أولاً، ثم امسح QR من الجهاز الثاني.</p>
      <div id="v9QrBox"></div>
      <input id="v9PairLink" readonly>
      <button onclick="dcosV9.copyPair()">📋 نسخ رابط الربط</button>
    </div>
    ${last?`<p class="sync-last">آخر مزامنة: ${esc(last.at||"")} - رفع ${esc(last.pushed)} / تنزيل ${esc(last.pulled)}</p>`:""}
    <button onclick="backToHome()">رجوع</button>
  </div>`;
  let backBtn=$("backBtn"); if(backBtn)backBtn.style.display="block";
  renderQr();
  remoteCount().then(n=>{lastRemoteCount=n; let el=$("v10RemoteCount"); if(el)el.textContent=n; updateFab();});
}
function openTrashScreen(){let rows=trashRecords().slice().reverse(); let output=$("output"); if(!output)return; output.innerHTML=`<div class="card"><h2>🗑 سلة المحذوفات</h2>${rows.length?rows.map(r=>`<div class="audit-log-item"><b>${esc(r.patient?.name||r.id)}</b><small>${esc(r.deletedAt||"")}</small><button onclick="dcosV9.restore('${esc(r.id)}')">استرجاع</button></div>`).join(""):"<p>لا توجد عناصر.</p>"}<button onclick="dcosV9.open()">رجوع</button></div>`}
function openAuditScreen(){let rows=readJson(AUDIT_KEY,[]).slice().reverse().slice(0,120); let output=$("output"); if(!output)return; output.innerHTML=`<div class="card"><h2>🧾 سجل النشاط</h2>${rows.map(r=>`<div class="audit-log-item"><b>${esc(r.action)}</b><small>${esc(r.at)} - ${esc(r.device)}</small></div>`).join("")||"<p>لا يوجد سجل.</p>"}<button onclick="dcosV9.open()">رجوع</button></div>`}
async function restorePatientFromTrash(id){let rec=trashRecords().find(x=>x.id===id); if(!rec||!rec.patient){alert("لا توجد بيانات كافية للاستعادة");return} let list=getPatientsSafe(); if(!list.some((p,i)=>patientId(p,i)===id))list.push({...rec.patient,deleted:false,restoredAt:nowIso(),updatedAt:nowIso()}); unmarkDeletedId(id); savePatientsSafe(list); await runGlobalSync("restore"); openTrashScreen()}

function makeCountersClickable(){document.querySelectorAll(".stats-grid .stat-card").forEach(card=>{const label=(card.querySelector("small")?.textContent||"").trim(); card.classList.add("stat-card-btn"); card.setAttribute("role","button"); card.setAttribute("tabindex","0"); card.style.cursor="pointer"; if(label==="المرضى")card.onclick=()=>{if(typeof showPatients==="function")showPatients()}; if(label==="مواعيد اليوم")card.onclick=()=>{if(typeof openAppointmentsManager==="function")openAppointmentsManager()}; if(label==="الوصفات")card.onclick=()=>{if(typeof openRxLibraryManager==="function")openRxLibraryManager()}; if(label==="الرصيد المتبقي")card.onclick=()=>{if(typeof openFinanceSummaryFromDashboard==="function")openFinanceSummaryFromDashboard()};});}
function installUI(){let fab=$("v9SyncFab"); if(fab){fab.onclick=quickRefresh; fab.setAttribute("title","رفع التحديثات ثم تنزيل آخر البيانات")} document.querySelectorAll("button").forEach(btn=>{let txt=btn.textContent||"", on=btn.getAttribute("onclick")||""; if((txt.includes("المزامنة")||on.includes("openClinicV8SyncCenter"))&&!txt.includes("القديمة")){btn.onclick=openSyncScreen; btn.setAttribute("onclick","dcosV9.open()")}}); makeCountersClickable(); if(typeof renderDashboard==="function"&&!window.__dcosV10RenderWrapped){let old=renderDashboard; window.renderDashboard=function(){let r=old.apply(this,arguments); setTimeout(makeCountersClickable,60); return r}; window.__dcosV10RenderWrapped=true}}

function installSaveWrapper(){if(window.__dcosV10SaveWrapped||typeof window.savePatients!=="function")return; window.__dcosV10SaveWrapped=true; const old=window.savePatients; window.savePatients=function(list){let before=getPatientsSafe(); let result=old.apply(this,arguments); if(!isApplyingRemote){try{detectDeletes(before,list||getPatientsSafe()); markDirty("savePatients")}catch(e){console.warn("save wrapper failed",e)}} return result}}
function detectDeletes(before,after){let afterIds=new Set((after||[]).map((p,i)=>patientId(p,i))); let removed=[]; (before||[]).forEach((p,i)=>{let id=patientId(p,i); if(!afterIds.has(id))removed.push({id,patient:p,deletedAt:nowIso()})}); if(removed.length)markDeletedPatients(removed)}
function installDeleteWrapper(){if(window.__dcosV10DeleteWrapped||typeof window.deletePatient!=="function")return; window.__dcosV10DeleteWrapped=true; const old=window.deletePatient; window.deletePatient=function(){let before=getPatientsSafe(); let result=old.apply(this,arguments); try{detectDeletes(before,getPatientsSafe())}catch(e){} return result}}

function mode(){return localStorage.getItem(MODE_KEY)||"economical"} function setMode(m){localStorage.setItem(MODE_KEY,m==="live"?"live":"economical")}
function startLive(){let c=getConfig(); if(!c)throw new Error("لا توجد إعدادات Firebase"); initFirebase(c); if(unsubscribe)unsubscribe(); unsubscribe=patientsRef().onSnapshot(s=>{let remote=[]; s.forEach(d=>remote.push(d.data())); lastRemoteCount=remote.filter(p=>!p.deleted).length; isApplyingRemote=true; savePatientsSafe(mergePatients(getPatientsSafe(),remote)); isApplyingRemote=false; lastStatus="متصل مباشر"; updateFab(); try{if(typeof renderDashboard==="function")renderDashboard()}catch(e){}},err=>{lastError=explain(err);lastStatus="خطأ";updateFab();console.error(err)})}
function stopLive(){try{unsubscribe&&unsubscribe()}catch(e){} unsubscribe=null}

function boot(){
  applyPairHash();
  window.dcosV9={open:openSyncScreen,refresh:quickRefresh,saveConfig:saveConfigFromUI,test:testConnection,push:async()=>{try{let n=await pushPatients("manual-push-only");alert("تم رفع المرضى: "+n);openSyncScreen()}catch(e){lastError=explain(e);alert(lastError);openSyncScreen()}},pull:async()=>{try{await pullPatients(true);openSyncScreen()}catch(e){lastError=explain(e);alert(lastError);openSyncScreen()}},copyPair:copyPairLink,trash:openTrashScreen,audit:openAuditScreen,restore:(id)=>restorePatientFromTrash(id),economical:()=>{setMode("economical");stopLive();lastStatus="متصل - اقتصادي";openSyncScreen()},live:()=>{setMode("live");try{startLive();lastStatus="متصل مباشر"}catch(e){lastError=explain(e);alert(lastError)}openSyncScreen()}};
  window.clinicV8OpenSync=openSyncScreen;
  window.openClinicV8SyncCenter=openSyncScreen;
  installSaveWrapper();
  installDeleteWrapper();
  try{auditLog("boot",{patients:getPatientsSafe().length})}catch(e){}
  let cfg=getConfig(); if(cfg){try{initFirebase(cfg)}catch(e){lastError=explain(e)}}
  installUI(); setTimeout(installUI,800);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot); else boot();
})();
