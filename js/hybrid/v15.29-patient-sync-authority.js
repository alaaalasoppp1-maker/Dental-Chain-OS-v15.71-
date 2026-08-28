'use strict';
/* v15.29 — authoritative patient sync + persistent cloud tombstones.
   Prevents a deleted patient from being recreated by a stale browser/device. */
(function(){
  const VERSION='15.29';
  const H=()=>window.DCOS_HYBRID||{};
  const arr=v=>Array.isArray(v)?v:[];
  const safe=v=>String(v||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_')||'unknown';
  const clinicId=()=>safe(H().clinic?.id||new URLSearchParams(location.search).get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic');
  const scopedKey=()=>`dcos_v1513_patients_${clinicId()}`;
  const tombCacheKey=()=>`dcos_v1529_patient_tombstones_${clinicId()}`;
  const now=()=>new Date().toISOString();
  const clone=v=>JSON.parse(JSON.stringify(v));

  function aliases(p){
    return [...new Set([
      p?.id,p?.uid,p?.fileNo,p?.fileNumber,
      p?.name&&p?.phone?`${p.name}__${p.phone}`:null
    ].filter(Boolean).map(x=>String(x).trim()))];
  }
  function canonical(p){return safe(p?.id||p?.uid||p?.fileNo||p?.fileNumber||(p?.name&&p?.phone?`${p.name}__${p.phone}`:p?.name));}
  function same(a,b){
    const aa=aliases(a), bb=new Set(aliases(b));
    return aa.some(x=>bb.has(x));
  }
  function readTombs(){
    try{return new Set(arr(JSON.parse(localStorage.getItem(tombCacheKey())||'[]')).map(String))}catch(e){return new Set()}
  }
  function writeTombs(set){localStorage.setItem(tombCacheKey(),JSON.stringify([...set]));}
  function isDeleted(p,set=readTombs()){return aliases(p).some(x=>set.has(String(x)));}
  function writeLocal(list){
    const clean=arr(list).filter(Boolean);
    localStorage.setItem(scopedKey(),JSON.stringify(clean));
    localStorage.setItem('patients',JSON.stringify(clean));
    return clean;
  }
  function refreshUI(){
    try{
      const patientView=!!document.querySelector('.patient-main-card,.patient-file-layout');
      if(window.patient){
        const fresh=arr(window.getPatients?.()).find(p=>same(p,window.patient));
        if(fresh)window.patient=fresh;
        else{
          window.patient=null;window.clearPatientFields?.();
          if(patientView&&typeof window.renderDashboard==='function')window.renderDashboard();
          return;
        }
      }
      if(document.getElementById('list')&&typeof window.renderPatients==='function'){
        window.renderPatients(window.getPatients());
        return;
      }
      if(patientView||document.querySelector('.modal,.appointments-manager,.dcos-reception-finance-panel')){
        document.dispatchEvent(new CustomEvent('dcos:data-updated',{detail:{scope:'patients'}}));
        return;
      }
      if(document.querySelector('.dashboard-home,.stats-grid,.clinic-dashboard')&&typeof window.renderDashboard==='function')window.renderDashboard();
    }catch(e){console.warn('patient authority UI refresh',e)}
  }

  let ready=false, applyingRemote=false, patientsReady=false, tombsReady=false;
  let remotePatients=[], tombstones=new Set();
  let unsubPatients=null, unsubTombs=null;
  let originalSave=null;
  let flushingPending=false;
  const pendingWrites=new Map();

  function patientChanged(a,b){
    try{return JSON.stringify(a)!==JSON.stringify(b)}catch(e){return true}
  }
  function rememberPending(before,after){
    arr(after).forEach(p=>{
      if(!p||isDeleted(p,tombstones.size?tombstones:readTombs()))return;
      const old=arr(before).find(x=>same(x,p));
      if(!old||patientChanged(old,p)) pendingWrites.set(canonical(p),clone(p));
    });
  }
  async function flushPending(){
    if(flushingPending||!ready||!pendingWrites.size||!window.DCOS?.Store)return;
    flushingPending=true;
    try{
      await DCOS.Store.init();
      for(const [key,p] of [...pendingWrites.entries()]){
        if(isDeleted(p,tombstones)){pendingWrites.delete(key);continue;}
        const id=String(p.id||canonical(p));
        await DCOS.Store.set(`clinics/${clinicId()}/patients/${id}`,{...p,id,clinicId:clinicId(),updatedAt:p.updatedAt||now()});
        pendingWrites.delete(key);
      }
    }catch(e){console.error('pending patient save',e)}
    finally{flushingPending=false;}
  }

  function reconcile(){
    if(!patientsReady||!tombsReady)return;
    const merged=remotePatients.filter(p=>!isDeleted(p,tombstones));
    for(const p of pendingWrites.values()){
      if(isDeleted(p,tombstones))continue;
      const idx=merged.findIndex(x=>same(x,p));
      if(idx>=0)merged[idx]={...merged[idx],...p};
      else merged.push(p);
    }
    applyingRemote=true;
    try{writeLocal(merged);}finally{applyingRemote=false;}
    ready=true;
    refreshUI();
    flushPending();
  }

  async function purgeResurrected(){
    if(!window.DCOS?.Store?.db||!tombstones.size)return;
    const bad=remotePatients.filter(p=>isDeleted(p,tombstones));
    for(const p of bad){
      try{await window.DCOS.Store.del(`clinics/${clinicId()}/patients/${p.id||canonical(p)}`);}catch(e){console.warn('purge resurrected patient',e)}
    }
  }

  function installSaveGuard(){
    if(window.__dcos1529SaveGuard)return;
    originalSave=window.savePatients;
    if(typeof originalSave!=='function')return;
    window.savePatients=function(list){
      const before=arr(window.getPatients?.()).map(clone);
      const clean=arr(list).filter(p=>!isDeleted(p,tombstones.size?tombstones:readTombs()));
      if(applyingRemote)return writeLocal(clean);
      rememberPending(before,clean);
      const localResult=writeLocal(clean);
      if(ready){
        originalSave.call(this,clean);
        flushPending();
      }
      return localResult;
    };
    try{savePatients=window.savePatients}catch(e){}
    window.__dcos1529SaveGuard=true;
  }

  async function subscribe(){
    if(!window.DCOS?.Store)return;
    await window.DCOS.Store.init();
    const db=window.DCOS.Store.db;
    if(!db)return;
    try{unsubPatients?.();unsubTombs?.();}catch(e){}
    const base=db.collection('clinics').doc(clinicId());
    unsubPatients=base.collection('patients').onSnapshot(async snap=>{
      remotePatients=[]; snap.forEach(d=>remotePatients.push({id:d.id,...d.data()}));
      patientsReady=true;
      await purgeResurrected();
      reconcile();
    },e=>console.error('patient realtime listener',e));
    unsubTombs=base.collection('patientDeletes').onSnapshot(async snap=>{
      const next=new Set();
      snap.forEach(d=>{const x={id:d.id,...d.data()};next.add(String(d.id));arr(x.aliases).forEach(a=>next.add(String(a)));});
      tombstones=next; writeTombs(next); tombsReady=true;
      await purgeResurrected();
      reconcile();
    },e=>console.error('patient delete listener',e));
  }

  function activePatient(){
    try{const p=window.DCOS_activePatient?.();if(p)return p}catch(e){}
    if(window.patient)return window.patient;
    const file=String(document.getElementById('fileNo')?.value||'').trim();
    const name=String(document.getElementById('name')?.value||'').trim();
    const phone=String(document.getElementById('phone')?.value||'').trim();
    return arr(window.getPatients?.()).find(p=>(file&&[p.fileNo,p.fileNumber,p.id].map(String).includes(file))||(name&&String(p.name||'').trim()===name)||(phone&&String(p.phone||'').trim()===phone))||null;
  }

  async function authoritativeDelete(p){
    if(!window.DCOS?.Store)throw new Error('خدمة Firebase غير جاهزة');
    await window.DCOS.Store.init();
    const id=canonical(p), als=aliases(p);
    pendingWrites.delete(id);
    als.forEach(a=>pendingWrites.delete(safe(a)));
    // Tombstone is written first. Any stale upload after this point is rejected/purged by clients on v15.29+.
    await window.DCOS.Store.set(`clinics/${clinicId()}/patientDeletes/${id}`,{
      id,aliases:als,patientName:p.name||'',fileNo:p.fileNo||p.fileNumber||'',deletedAt:now(),
      deletedBy:H().account?.email||H().account?.name||'system',clinicId:clinicId()
    });
    als.forEach(a=>tombstones.add(String(a))); tombstones.add(id); writeTombs(tombstones);
    const rows=await window.DCOS.Store.list(`clinics/${clinicId()}/patients`);
    const matches=arr(rows).filter(x=>same(x,p));
    const ids=new Set(matches.map(x=>x.id).filter(Boolean)); if(p.id)ids.add(p.id); ids.add(id);
    for(const docId of ids)await window.DCOS.Store.del(`clinics/${clinicId()}/patients/${docId}`);
    const next=arr(window.getPatients?.()).filter(x=>!same(x,p));
    applyingRemote=true; try{writeLocal(next);}finally{applyingRemote=false;}
    await window.DCOS.Audit?.log(clinicId(),'delete_patient_authoritative',{patientId:id,fileNo:p.fileNo||'',name:p.name||'',tombstone:true},H().account||{});
    refreshUI();
  }

  function installDelete(){
    if(window.__dcos1529DeleteGuard)return;
    window.deletePatient=async function(){
      const p=activePatient();
      if(!p)return alert('لا يوجد مريض محدد');
      if(!confirm('حذف المريض نهائيًا من جميع أجهزة العيادة؟'))return;
      const btn=document.activeElement;
      if(btn?.tagName==='BUTTON'){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='جارٍ الحذف...';}
      try{
        await authoritativeDelete(p);
        window.clearPatientFields?.();
        alert('تم حذف المريض نهائيًا وتثبيت الحذف على السحابة');
      }catch(e){console.error('authoritative patient delete',e);alert('تعذر تثبيت الحذف على السحابة: '+(e.message||e));}
      finally{if(btn?.tagName==='BUTTON'){btn.disabled=false;btn.textContent=btn.dataset.oldText||'🗑 حذف';}}
    };
    window.__dcos1529DeleteGuard=true;
  }

  async function boot(){
    installSaveGuard(); installDelete();
    // Wait for clinic login/context, then attach the authoritative realtime source.
    for(let i=0;i<80&&!H().account;i++)await new Promise(r=>setTimeout(r,100));
    await subscribe();
    document.documentElement.dataset.patientSync='authoritative-v15.29';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,50));else setTimeout(boot,50);
  window.addEventListener('beforeunload',()=>{try{unsubPatients?.();unsubTombs?.();}catch(e){}});
})();
