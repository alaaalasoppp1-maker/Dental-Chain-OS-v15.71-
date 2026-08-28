const CLINIC_V8_MODE_KEY = "clinic_v8_sync_mode";
/* =========================================================
   Dental Chain OS v8 - Real Firestore Patient Sync Engine
   - Syncs patients as separate Firestore documents.
   - Keeps localStorage as offline/cache fallback.
   - No manual code editing: paste firebaseConfig inside the app.
========================================================= */

const CLINIC_V8_VERSION = "8.0.0-live-patient-sync";
const CLINIC_V8_CONFIG_KEY = "clinic_v8_firebase_config";
const CLINIC_V8_DEVICE_KEY = "clinic_v8_device_id";
const CLINIC_V8_STATE_KEY = "clinic_v8_sync_state";
const CLINIC_V8_CLINIC_ID_KEY = "clinic_v8_clinic_id";
const CLINIC_V8_DEFAULT_CLINIC = "default";

window.CLINIC_V8 = window.CLINIC_V8 || {
  app:null,
  db:null,
  enabled:false,
  listening:false,
  applyingRemote:false,
  pushTimer:null,
  unsubscribePatients:null,
  status:"offline",
  lastError:"",
  lastPushAt:0,
  lastPullAt:0,
  lastRemoteCount:0
};

function clinicV8ClinicId(){
  let id = localStorage.getItem(CLINIC_V8_CLINIC_ID_KEY);
  if(!id){
    id = CLINIC_V8_DEFAULT_CLINIC;
    localStorage.setItem(CLINIC_V8_CLINIC_ID_KEY, id);
  }
  return String(id || CLINIC_V8_DEFAULT_CLINIC).replace(/[^a-zA-Z0-9_-]/g,"_");
}

function clinicV8DeviceId(){
  let id = localStorage.getItem(CLINIC_V8_DEVICE_KEY);
  if(!id){
    id = "DEV-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    localStorage.setItem(CLINIC_V8_DEVICE_KEY, id);
  }
  return id;
}

function clinicV8Now(){ return Date.now(); }

function clinicV8ExplainError(e){
  const raw = (e && (e.message || e.code)) ? String(e.message || e.code) : String(e || "");
  const low = raw.toLowerCase();
  if(low.includes("permission") || low.includes("insufficient")){
    return "صلاحيات Firestore تمنع القراءة/الكتابة. افتح Firebase > Firestore Database > Rules واجعلها Test mode مؤقتاً أثناء التجربة. التفاصيل: " + raw;
  }
  if(low.includes("not-found") || low.includes("project")){
    return "تحقق من firebaseConfig، وخاصة projectId. التفاصيل: " + raw;
  }
  if(low.includes("network") || low.includes("offline") || low.includes("failed to fetch")){
    return "لا يوجد اتصال ثابت بالإنترنت أو تعذر الوصول إلى Firebase. سيتم الحفظ محلياً والمحاولة لاحقاً. التفاصيل: " + raw;
  }
  if(low.includes("firebase") || low.includes("sdk")){
    return "تعذر تحميل Firebase SDK. افتح البرنامج عبر Live Server أو الرابط المنشور وليس من ملف محلي إذا استمر الخطأ، وتأكد من الإنترنت. التفاصيل: " + raw;
  }
  if(low.includes("undefined")){
    return "كانت هناك قيمة غير صالحة داخل البيانات. تم تفعيل تنظيف البيانات في v8، أعد المحاولة. التفاصيل: " + raw;
  }
  return raw;
}


function clinicV8GetMode(){
  return localStorage.getItem(CLINIC_V8_MODE_KEY) || "economical";
}
function clinicV8SetMode(mode){
  localStorage.setItem(CLINIC_V8_MODE_KEY, mode === "live" ? "live" : "economical");
}

function clinicV8SetStatus(status, text){
  CLINIC_V8.status = status;
  const label = text || (status === "online" ? "☁️ متصل" : status === "syncing" ? "☁️ تتم المزامنة" : status === "pending" ? "☁️ محفوظ محلياً" : "☁️ غير متصل");
  const badge = document.getElementById("clinicV8CloudBadge");
  if(badge){
    badge.className = "clinic-v8-cloud-badge " + status;
    badge.textContent = label;
  }
  try{ localStorage.setItem(CLINIC_V8_STATE_KEY, JSON.stringify({status, text:label, at:clinicV8Now()})); }catch(e){}
}

function clinicV8GetConfig(){
  try{ return JSON.parse(localStorage.getItem(CLINIC_V8_CONFIG_KEY) || "null"); }catch(e){ return null; }
}
function clinicV8SaveConfig(config){ localStorage.setItem(CLINIC_V8_CONFIG_KEY, JSON.stringify(config)); }

function clinicV8ParseConfigText(text){
  if(!text) return null;
  const keys = ["apiKey","authDomain","projectId","storageBucket","messagingSenderId","appId","measurementId"];
  const config = {};
  keys.forEach(k=>{
    const re = new RegExp(k + "\\s*:\\s*[\"']([^\"']+)[\"']");
    const m = text.match(re);
    if(m) config[k] = m[1];
  });
  if(config.apiKey && config.projectId && config.appId) return config;
  try{
    const cleaned = text
      .replace(/const\s+firebaseConfig\s*=\s*/g, "")
      .replace(/;\s*$/g, "")
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    const parsed = JSON.parse(cleaned);
    if(parsed.apiKey && parsed.projectId && parsed.appId) return parsed;
  }catch(e){}
  return null;
}

function clinicV8EnsureFirebase(config){
  if(!window.firebase) throw new Error("لم يتم تحميل Firebase SDK. تأكد من الإنترنت ثم أعد فتح الصفحة.");
  if(!CLINIC_V8.app){
    try{ CLINIC_V8.app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(config); }
    catch(e){ if(firebase.apps && firebase.apps.length) CLINIC_V8.app = firebase.app(); else throw e; }
  }
  if(!CLINIC_V8.db){
    CLINIC_V8.db = firebase.firestore();
    try{ CLINIC_V8.db.enablePersistence({synchronizeTabs:true}).catch(()=>{}); }catch(e){}
  }
  CLINIC_V8.enabled = true;
  return CLINIC_V8.db;
}

function clinicV8PatientsCollection(){
  return CLINIC_V8.db.collection("clinics").doc(clinicV8ClinicId()).collection("patients");
}

function clinicV8MetaDoc(){
  return CLINIC_V8.db.collection("clinics").doc(clinicV8ClinicId()).collection("meta").doc("state");
}

function clinicV8DocIdFromPatient(p){
  const raw = (p && (p.fileNo || p.id || p.name)) ? String(p.fileNo || p.id || p.name) : String(Date.now());
  return raw.replace(/[\/#?\[\]\s]+/g,"_").slice(0,120) || ("P_" + Date.now());
}

function clinicV8CleanData(value, depth=0){
  if(depth > 20) return null;
  if(value === undefined) return null;
  if(value === null) return null;
  if(typeof value === "function") return null;
  if(typeof value === "number") return isFinite(value) ? value : 0;
  if(typeof value === "string" || typeof value === "boolean") return value;
  if(value instanceof Date) return value.toISOString();
  if(Array.isArray(value)){
    return value.map(v=>clinicV8CleanData(v, depth+1)).filter(v=>v !== null && v !== undefined);
  }
  if(typeof value === "object"){
    const out = {};
    Object.keys(value).forEach(k=>{
      if(k.startsWith("__")) return;
      const v = clinicV8CleanData(value[k], depth+1);
      if(v !== null && v !== undefined) out[k] = v;
    });
    return out;
  }
  return String(value);
}

function clinicV8PreparePatient(p, reason){
  const base = clinicV8CleanData(p || {}) || {};
  base.fileNo = base.fileNo || (typeof ensurePatientFileNo === "function" ? ensurePatientFileNo(base).fileNo : ("P-" + Date.now()));
  base.syncMeta = base.syncMeta || {};
  base.syncMeta.updatedAt = clinicV8Now();
  base.syncMeta.updatedAtText = typeof nowDateTime === "function" ? nowDateTime() : new Date().toLocaleString();
  base.syncMeta.updatedBy = clinicV8DeviceId();
  base.syncMeta.version = CLINIC_V8_VERSION;
  base.syncMeta.reason = reason || "save";
  base.syncMeta.doctor = typeof getActiveDoctor === "function" ? getActiveDoctor() : (document.getElementById("activeDoctor")?.value || "غير محدد");
  return base;
}

function clinicV8MergePatients(localList, remoteList){
  const map = new Map();
  (localList || []).forEach(p=>{
    const id = clinicV8DocIdFromPatient(p);
    map.set(id, p);
  });
  (remoteList || []).forEach(r=>{
    const id = clinicV8DocIdFromPatient(r);
    const l = map.get(id);
    const lt = Number(l?.syncMeta?.updatedAt || 0);
    const rt = Number(r?.syncMeta?.updatedAt || 0);
    if(!l || rt >= lt) map.set(id, r);
  });
  return Array.from(map.values()).sort((a,b)=>String(a.fileNo||"").localeCompare(String(b.fileNo||""), undefined, {numeric:true}));
}

async function clinicV8PushPatients(list, reason="savePatients", previousList=null){
  if(!CLINIC_V8.enabled || !CLINIC_V8.db || CLINIC_V8.applyingRemote) return;
  try{
    clinicV8SetStatus("syncing","☁️ رفع المرضى");
    const col = clinicV8PatientsCollection();
    const batch = CLINIC_V8.db.batch();
    const cleanList = (Array.isArray(list) ? list : (typeof getPatients === "function" ? getPatients() : [])).map(p=>clinicV8PreparePatient(p, reason));
    cleanList.forEach(p=> batch.set(col.doc(clinicV8DocIdFromPatient(p)), p, {merge:false}));

    if(Array.isArray(previousList)){
      const nextIds = new Set(cleanList.map(p=>clinicV8DocIdFromPatient(p)));
      previousList.forEach(old=>{
        const oldId = clinicV8DocIdFromPatient(old);
        if(oldId && !nextIds.has(oldId)) batch.delete(col.doc(oldId));
      });
    }

    batch.set(clinicV8MetaDoc(), {
      version:CLINIC_V8_VERSION,
      updatedAt:clinicV8Now(),
      updatedAtText: typeof nowDateTime === "function" ? nowDateTime() : new Date().toLocaleString(),
      updatedBy:clinicV8DeviceId(),
      patientsCount:cleanList.length,
      reason
    }, {merge:true});

    await batch.commit();
    CLINIC_V8.lastPushAt = clinicV8Now();
    clinicV8SetStatus("online",`☁️ متصل - ${cleanList.length} مريض`);
  }catch(e){
    CLINIC_V8.lastError = clinicV8ExplainError(e);
    clinicV8SetStatus("pending","☁️ محفوظ محلياً - بانتظار الرفع");
    console.error("Dental Chain OS v8 push failed", e);
  }
}

function clinicV8SchedulePush(list, reason, previousList=null){
  if(!CLINIC_V8.enabled || CLINIC_V8.applyingRemote) return;
  clearTimeout(CLINIC_V8.pushTimer);
  const snapshot = Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : null;
  const previous = Array.isArray(previousList) ? JSON.parse(JSON.stringify(previousList)) : null;
  CLINIC_V8.pushTimer = setTimeout(()=>clinicV8PushPatients(snapshot || getPatients(), reason, previous), 650);
}

async function clinicV8PullAllOnce(showAlert=true){
  if(!CLINIC_V8.enabled){
    const cfg = clinicV8GetConfig();
    if(!cfg){ if(showAlert) alert("احفظ إعدادات Firebase أولاً"); return; }
    await clinicV8Connect(cfg, {pushLocal:false});
  }
  try{
    clinicV8SetStatus("syncing","☁️ تنزيل المرضى");
    const snap = await clinicV8PatientsCollection().get();
    const remote = [];
    snap.forEach(doc=>remote.push(doc.data()));
    clinicV8ApplyRemotePatients(remote);
    clinicV8SetStatus("online",`☁️ متصل - ${remote.length} مريض`);
    if(showAlert) alert("تم تنزيل بيانات المرضى من السحابة.");
  }catch(e){
    CLINIC_V8.lastError = clinicV8ExplainError(e);
    clinicV8SetStatus("offline","☁️ تعذر التنزيل");
    if(showAlert) alert("تعذر التنزيل: " + CLINIC_V8.lastError);
  }
}

function clinicV8ApplyRemotePatients(remotePatients){
  if(!Array.isArray(remotePatients)) return;
  const localPatients = typeof getPatients === "function" ? getPatients() : [];
  const merged = clinicV8MergePatients(localPatients, remotePatients);
  const before = JSON.stringify(localPatients);
  const after = JSON.stringify(merged);
  if(before === after) return;

  CLINIC_V8.applyingRemote = true;
  try{
    localStorage.setItem("patients", JSON.stringify(merged));
    if(window.patient && patient.fileNo){
      const fresh = merged.find(p => (p.fileNo || "") === (patient.fileNo || ""));
      if(fresh) window.patient = fresh;
    }
    clinicV8RefreshCurrentView();
  }finally{
    CLINIC_V8.applyingRemote = false;
  }
}

function clinicV8RefreshCurrentView(){
  try{
    if(window.patient && document.querySelector(".patient-file-layout") && typeof openPatient === "function"){
      const fresh = getPatients().find(p => (p.fileNo || "") === (patient.fileNo || ""));
      openPatient(fresh || window.patient);
      return;
    }
    if(document.getElementById("list") && typeof renderPatients === "function"){
      renderPatients(getPatients());
      return;
    }
    if(typeof renderDashboard === "function" && document.querySelector(".dashboard-hero")){
      renderDashboard();
    }
  }catch(e){ console.warn("Dental Chain OS v8 refresh skipped", e); }
}

function clinicV8StartPatientsListener(){
  if(!CLINIC_V8.enabled || !CLINIC_V8.db || CLINIC_V8.listening) return;

  // v8.4 default: economical sync. It pulls once on open and uploads on save,
  // without keeping an always-on listener. Live mode remains optional.
  if(clinicV8GetMode() !== "live"){
    clinicV8PullAllOnce(false);
    clinicV8SetStatus("online","☁️ متصل - وضع اقتصادي");
    return;
  }

  CLINIC_V8.listening = true;
  CLINIC_V8.unsubscribePatients = clinicV8PatientsCollection().onSnapshot(snapshot=>{
    const remote = [];
    snapshot.forEach(doc=>remote.push(doc.data()));
    CLINIC_V8.lastRemoteCount = remote.length;
    CLINIC_V8.lastPullAt = clinicV8Now();
    clinicV8ApplyRemotePatients(remote);
    clinicV8SetStatus("online",`☁️ متصل مباشر - ${remote.length} مريض`);
  }, err=>{
    CLINIC_V8.lastError = clinicV8ExplainError(err);
    clinicV8SetStatus("offline","☁️ خطأ بالمزامنة");
    console.error("Dental Chain OS v8 listener failed", err);
  });
}

function clinicV8WrapStorage(){
  if(window.__clinicV8StorageWrapped) return;
  window.__clinicV8StorageWrapped = true;
  const originalSavePatients = window.savePatients || savePatients;
  window.__clinicV8OriginalSavePatients = originalSavePatients;
  window.savePatients = function(list){
    const previous = (()=>{ try{return JSON.parse(localStorage.getItem("patients") || "[]");}catch(e){return [];} })();
    originalSavePatients(list);
    clinicV8SchedulePush(list, "savePatients", previous);
  };
  try{ savePatients = window.savePatients; }catch(e){}
}

async function clinicV8Connect(config, options={}){
  clinicV8SaveConfig(config);
  clinicV8SetStatus("syncing","☁️ تشغيل المزامنة");
  clinicV8EnsureFirebase(config);
  clinicV8WrapStorage();

  // v8.1: auto-bootstrap. If this is the first device and cloud is empty,
  // upload local patients once. If cloud already has patients, listener will pull/merge them.
  try{
    const local = (typeof getPatients === "function" ? getPatients() : []);
    const snap = await clinicV8PatientsCollection().limit(1).get();
    if((options.pushLocal || (snap.empty && local.length > 0)) && local.length > 0){
      await clinicV8PushPatients(local, options.pushLocal ? "manual-initial-push" : "auto-bootstrap-first-device", []);
    }
  }catch(e){
    // Continue to listener; rules/errors will be shown there too.
    console.warn("Dental Chain OS v8.1 bootstrap skipped", e);
  }

  clinicV8StartPatientsListener();
  clinicV8SetStatus("online","☁️ متصل");
}

async function clinicV8InitFromSavedConfig(){
  const config = clinicV8GetConfig();
  if(!config){ clinicV8SetStatus("offline","☁️ غير مفعّل"); return; }
  try{ await clinicV8Connect(config, {pushLocal:false}); }
  catch(e){
    CLINIC_V8.lastError = clinicV8ExplainError(e);
    clinicV8SetStatus("offline","☁️ غير متصل - حفظ محلي");
    console.warn("Dental Chain OS v8 auto init failed", e);
  }
}

function clinicV8SavedState(){
  try{return JSON.parse(localStorage.getItem(CLINIC_V8_STATE_KEY)||"{}");}catch(e){return {};}
}

function openClinicV8SyncCenter(){
  const config = clinicV8GetConfig();
  const status = CLINIC_V8.status || "offline";
  const last = clinicV8SavedState();
  const output = document.getElementById("output");
  if(!output) return;
  output.innerHTML = `
  <div class="card clinic-v8-panel">
    <div class="clinic-v8-header">
      <div>
        <h2>☁️ Dental Chain OS v8.4.1 Mobile Sync Fix</h2>
        <p>مزامنة تلقائية للمرضى عبر Firebase Firestore. بعد حفظ الإعدادات، أي إضافة أو تعديل على المرضى يُرفع ويظهر على باقي الأجهزة تلقائياً.</p>
      </div>
      <div class="clinic-v8-status ${status}">${status === "online" ? "متصل" : status === "syncing" ? "تتم المزامنة" : status === "pending" ? "محفوظ محلياً" : "غير متصل"}</div>
    </div>

    <div class="clinic-v8-info-grid">
      <div><small>الجهاز</small><b>${clinicV8DeviceId().slice(0,18)}</b></div>
      <div><small>Clinic ID</small><b>${clinicV8ClinicId()}</b></div>
      <div><small>المرضى المحليون</small><b>${(getPatients?.() || []).length}</b></div>
      <div><small>المرضى على السحابة</small><b>${CLINIC_V8.lastRemoteCount || "-"}</b></div>
      <div><small>آخر حالة</small><b>${last.text || "-"}</b></div>
    </div>

    <div class="clinic-v8-setup">
      <h3>إعداد Firebase</h3>
      <p>الصق كود <b>firebaseConfig</b> مرة واحدة. لا تعدّل أي ملف.</p>
      <textarea id="clinicV8ConfigText" placeholder="الصق هنا كود firebaseConfig من Firebase">${config ? JSON.stringify(config,null,2) : ""}</textarea>
      <div class="clinic-v8-mode-box">
        <b>وضع المزامنة الحالي:</b>
        <span>${clinicV8GetMode() === "live" ? "مباشر لحظي" : "اقتصادي عند الفتح/الحفظ"}</span>
        <small>الوضع الاقتصادي يقلل قراءات Firestore، وهو الأنسب الآن لتجنب الاستهلاك الزائد.</small>
      </div>
      <div class="clinic-v8-actions">
        <button onclick="clinicV8SaveConfigFromUI()">💾 حفظ وتشغيل المزامنة</button>
        <button onclick="clinicV8UseEconomicalMode()">🌿 وضع اقتصادي</button>
        <button onclick="clinicV8UseLiveMode()">⚡ وضع مباشر</button>
        <button onclick="clinicV8TestConnection()">🧪 اختبار الاتصال</button>
        <button onclick="clinicV8CopyConfig()">📋 نسخ إعدادات هذا الجهاز</button>
        <button onclick="clinicV8DownloadConfigFile()">⬇️ ملف إعدادات للجهاز الآخر</button>
        <button onclick="clinicV8DisableSync()">إيقاف المزامنة على هذا الجهاز</button>
      </div>
      <details class="clinic-v8-advanced">
        <summary>أدوات متقدمة</summary>
        <div class="clinic-v8-actions">
          <button onclick="clinicV8PushPatients(getPatients(),'manual-push',[]) ">⬆️ رفع مرضى هذا الجهاز الآن</button>
          <button onclick="clinicV8PullAllOnce(true)">⬇️ تنزيل المرضى من السحابة</button>
          <button onclick="clinicV8ShowRulesHelp()">🛡️ قواعد Firestore للتجربة</button>
        </div>
      </details>
    </div>

    <div class="clinic-v8-note">
      <b>v8.1:</b> بعد حفظ إعدادات Firebase تعمل مزامنة المرضى تلقائياً. أزرار الرفع والتنزيل اليدوية أصبحت داخل أدوات متقدمة فقط.
    </div>

    ${CLINIC_V8.lastError ? `<div class="clinic-v8-error"><b>تفاصيل الخطأ:</b><br>${typeof escapeHtml === "function" ? escapeHtml(CLINIC_V8.lastError) : CLINIC_V8.lastError}</div>` : ""}
    <button onclick="backToHome()">رجوع</button>
  </div>`;
  const backBtn = document.getElementById("backBtn");
  if(backBtn) backBtn.style.display = "block";
}

async function clinicV8SaveConfigFromUI(){
  const txt = document.getElementById("clinicV8ConfigText")?.value || "";
  const cfg = clinicV8ParseConfigText(txt);
  if(!cfg){ alert("لم أستطع قراءة إعدادات Firebase. تأكد أنك لصقت كود firebaseConfig كامل."); return; }
  try{
    await clinicV8Connect(cfg, {pushLocal:false});
    alert("تم حفظ الإعدادات وتشغيل المزامنة التلقائية.");
    openClinicV8SyncCenter();
  }catch(e){
    CLINIC_V8.lastError = clinicV8ExplainError(e);
    alert("فشل الاتصال: " + CLINIC_V8.lastError);
    openClinicV8SyncCenter();
  }
}

async function clinicV8TestConnection(){
  const cfg = clinicV8GetConfig() || clinicV8ParseConfigText(document.getElementById("clinicV8ConfigText")?.value || "");
  if(!cfg){ alert("أدخل إعدادات Firebase أولاً"); return; }
  try{
    await clinicV8Connect(cfg, {pushLocal:false});
    await clinicV8MetaDoc().set({testAt:clinicV8Now(), testBy:clinicV8DeviceId(), version:CLINIC_V8_VERSION}, {merge:true});
    const snap = await clinicV8PatientsCollection().limit(3).get();
    alert("الاتصال ناجح. Firestore يقرأ ويكتب. عدد عينات المرضى المقروءة: " + snap.size);
    openClinicV8SyncCenter();
  }catch(e){
    CLINIC_V8.lastError = clinicV8ExplainError(e);
    alert("فشل الاختبار: " + CLINIC_V8.lastError);
    openClinicV8SyncCenter();
  }
}



function clinicV8UseEconomicalMode(){
  clinicV8SetMode("economical");
  try{ CLINIC_V8.unsubscribePatients && CLINIC_V8.unsubscribePatients(); }catch(e){}
  CLINIC_V8.listening = false;
  clinicV8PullAllOnce(false).finally(()=>openClinicV8SyncCenter());
}
function clinicV8UseLiveMode(){
  if(!confirm("الوضع المباشر يستهلك قراءات أكثر لأنه يبقى مستمعاً للتغييرات. هل تريد تفعيله؟")) return;
  clinicV8SetMode("live");
  try{ CLINIC_V8.unsubscribePatients && CLINIC_V8.unsubscribePatients(); }catch(e){}
  CLINIC_V8.listening = false;
  const cfg = clinicV8GetConfig();
  if(cfg){ clinicV8Connect(cfg,{pushLocal:false}).finally(()=>openClinicV8SyncCenter()); }
  else openClinicV8SyncCenter();
}

async function clinicV8CopyConfig(){
  const cfg = clinicV8GetConfig() || clinicV8ParseConfigText(document.getElementById("clinicV8ConfigText")?.value || "");
  if(!cfg){ alert("لا توجد إعدادات محفوظة بعد."); return; }
  const text = JSON.stringify(cfg, null, 2);
  try{
    await navigator.clipboard.writeText(text);
    alert("تم نسخ إعدادات Firebase. الصقها على الجهاز الآخر داخل شاشة المزامنة.");
  }catch(e){
    prompt("انسخ إعدادات Firebase:", text);
  }
}

function clinicV8DownloadConfigFile(){
  const cfg = clinicV8GetConfig() || clinicV8ParseConfigText(document.getElementById("clinicV8ConfigText")?.value || "");
  if(!cfg){ alert("لا توجد إعدادات محفوظة بعد."); return; }
  const payload = {
    type:"DentalChainOSFirebaseConfig",
    version:CLINIC_V8_VERSION,
    exportedAt:clinicV8Now(),
    config:cfg
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dental-chain-os-firebase-config.json";
  a.click();
  URL.revokeObjectURL(url);
}

function clinicV8ShowRulesHelp(){
  alert(`قواعد تجريبية مؤقتة في Firestore > Rules:\n\nrules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}\n\nاستخدمها فقط أثناء التجربة. لاحقاً نضيف تسجيل دخول وصلاحيات.`);
}

function clinicV8DisableSync(){
  if(!confirm("إيقاف المزامنة على هذا الجهاز فقط؟")) return;
  try{ CLINIC_V8.unsubscribePatients && CLINIC_V8.unsubscribePatients(); }catch(e){}
  CLINIC_V8.enabled = false;
  CLINIC_V8.listening = false;
  localStorage.removeItem(CLINIC_V8_CONFIG_KEY);
  clinicV8SetStatus("offline","☁️ متوقف");
  openClinicV8SyncCenter();
}

function clinicV8AppendBadge(){
  const topbar = document.querySelector(".brand-topbar");
  if(topbar && !document.getElementById("clinicV8CloudBadge")){
    topbar.insertAdjacentHTML("beforeend", `<div id="clinicV8CloudBadge" class="clinic-v8-cloud-badge offline">☁️ غير مفعّل</div>`);
  }
}

function clinicV8AppendDashboardButtons(){
  let quick = document.querySelector(".quick-actions");
  if(quick && !quick.querySelector(".clinic-v8-firebase-btn")){
    quick.insertAdjacentHTML("beforeend", `<button class="clinic-v8-firebase-btn" onclick="openClinicV8SyncCenter()">☁️ المزامنة</button><button class="clinic-v8-install-btn" onclick="openClinicInstallHelp()">📱 تثبيت التطبيق</button>`);
  }
}


function openClinicInstallHelp(){
  const output = document.getElementById("output");
  if(!output) return;
  output.innerHTML = `
  <div class="card clinic-install-help">
    <h2>📱 تثبيت Dental Chain OS على الأجهزة</h2>
    <div class="install-grid">
      <div>
        <h3>على اللابتوب / الكمبيوتر</h3>
        <ol>
          <li>افتح الرابط: <b>https://dr-taher-dental-chain.web.app</b></li>
          <li>من Chrome اضغط زر التثبيت إذا ظهر بجانب شريط العنوان.</li>
          <li>أو من القائمة ⋮ اختر <b>Install app</b>.</li>
          <li>سيظهر اختصار على سطح المكتب.</li>
        </ol>
      </div>
      <div>
        <h3>على Android</h3>
        <ol>
          <li>افتح الرابط من Chrome.</li>
          <li>اضغط ⋮ أعلى المتصفح.</li>
          <li>اختر <b>Add to Home screen</b>.</li>
          <li>افتح البرنامج من الأيقونة وليس من ملف index.html.</li>
        </ol>
      </div>
    </div>
    <div class="clinic-v8-note">
      لا تفتح البرنامج من ملفات الهاتف بصيغة content:// أو file:// لأن Firebase والخطوط لا تعمل بشكل صحيح. استخدم الرابط فقط.
    </div>
    <button onclick="backToHome()">رجوع</button>
  </div>`;
  const backBtn = document.getElementById("backBtn");
  if(backBtn) backBtn.style.display = "block";
}


function clinicV8OpenFromHashIfNeeded(){
  if(location.hash === "#sync" || location.hash === "#firebase"){
    setTimeout(()=>{ try{ openClinicV8SyncCenter(); }catch(e){} }, 300);
  }
}

setTimeout(()=>{
  clinicV8DeviceId();
  clinicV8WrapStorage();
  clinicV8AppendBadge();
  clinicV8InitFromSavedConfig();
  if(typeof renderDashboard === "function" && !window.__clinicV8RenderDashboardWrapped){
    window.__clinicV8RenderDashboardWrapped = true;
    const oldRenderDashboard = renderDashboard;
    renderDashboard = function(){ oldRenderDashboard(); clinicV8AppendDashboardButtons(); clinicV8AppendBadge(); };
    try{ clinicV8AppendDashboardButtons(); }catch(e){}
  }
  if("serviceWorker" in navigator){ navigator.serviceWorker.register("service-worker.js").catch(()=>{}); }
  console.log("Dental Chain OS v8.1 Firebase auto patient sync ready", CLINIC_V8_VERSION);
  clinicV8OpenFromHashIfNeeded();
}, 700);


/* v14.3 clinic isolation sync override */
(function(){
  function qClinic(){try{return new URLSearchParams(location.search).get("clinic")||localStorage.getItem("dcos_v14_active_branch")||"taher-main-clinic";}catch(e){return "taher-main-clinic";}}
  function clean(id){return String(id||"taher-main-clinic").replace(/[^a-zA-Z0-9_-]/g,"_");}
  window.clinicV8ClinicId=function(){
    var id=clean(qClinic());
    localStorage.setItem("clinic_v8_clinic_id",id);
    localStorage.setItem("dcos_v9_clinic_id",id);
    localStorage.setItem("dcos_v14_active_branch",id);
    return id;
  };
  try{clinicV8ClinicId=window.clinicV8ClinicId;}catch(e){}
})();
