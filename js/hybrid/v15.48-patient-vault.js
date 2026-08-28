'use strict';
/* Dental Chain OS v15.69.1 — Offline-first patient store
   One full local patient copy per clinic + a small delta sync queue.
   Legacy duplicate keys are migrated once, then removed.
*/
(function(){
  const VERSION='15.69.1-single-local-copy';
  const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch(e){return v}};
  const arr=v=>Array.isArray(v)?v:[];
  const safe=v=>String(v||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_')||'taher-main-clinic';
  const clinicId=safe(new URLSearchParams(location.search).get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic');
  const K={
    patients:`dcos_v1513_patients_${clinicId}`,
    legacy:'patients',
    oldCanonical:`dcos_v1553_patients_${clinicId}`,
    oldVault:`dcos_v1548_patient_vault_${clinicId}`,
    oldBackup:`dcos_v1553_backup_${clinicId}`,
    queue:`dcos_v1553_sync_queue_${clinicId}`,
    state:`dcos_v1553_state_${clinicId}`
  };
  const read=(k,f)=>{try{const raw=localStorage.getItem(k);if(raw==null)return f;const x=JSON.parse(raw);return x==null?f:x}catch(e){return f}};
  const write=(k,v)=>{localStorage.setItem(k,JSON.stringify(v));return v};
  const now=()=>new Date().toISOString();
  const idOf=(p,i=0)=>safe(p?.id||p?.uid||p?.fileNo||p?.fileNumber||(p?.name&&p?.phone?`${p.name}_${p.phone}`:`patient_${Date.now()}_${i}`));
  const keyOf=p=>String(p?.id||p?.uid||p?.fileNo||p?.fileNumber||(p?.name&&p?.phone?`${p.name}__${p.phone}`:''));
  const genderOf=v=>{v=String(v||'').toLowerCase();return v==='male'||v==='female'?v:''};
  function comparable(p){const x=clone(p||{});delete x.updatedAt;delete x.syncMeta;delete x.clinicId;return JSON.stringify(x)}
  function normalize(list,previous=[]){
    const prev=new Map(arr(previous).map(p=>[keyOf(p),p]));
    return arr(list).filter(Boolean).map((p,i)=>{
      const x={...clone(p)};
      x.id=x.id||idOf(x,i);x.clinicId=clinicId;x.gender=genderOf(x.gender);
      x.createdAt=x.createdAt||prev.get(keyOf(x))?.createdAt||now();
      const old=prev.get(keyOf(x));
      x.updatedAt=old&&comparable(old)===comparable(x)?(old.updatedAt||old.createdAt||x.createdAt):now();
      return x;
    });
  }
  function dedupe(lists){
    const out=[];const pos=new Map();
    for(const list of lists)for(const p of arr(list)){
      const k=keyOf(p)||idOf(p,out.length),i=pos.get(k);
      if(i==null){pos.set(k,out.length);out.push(clone(p));continue}
      const a=Date.parse(out[i]?.updatedAt||0)||0,b=Date.parse(p?.updatedAt||0)||0;
      if(b>a)out[i]={...out[i],...clone(p)};
    }
    return out;
  }
  function removeDuplicateFullCopies(){
    [K.legacy,K.oldCanonical,K.oldVault,K.oldBackup].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
    // Old multi-snapshot backup was another complete copy of all patients.
    try{
      const old=read('clinicAutoBackupsV5',[]);
      if(Array.isArray(old)&&old.length>1) write('clinicAutoBackupsV5',old.slice(0,1));
    }catch(e){}
  }
  const migrated=dedupe([
    read(K.patients,[]),read(K.oldCanonical,[]),read(K.oldVault,[]),
    read(K.oldBackup,null)?.patients,read(K.legacy,[])
  ]);
  // Free duplicated space before committing the one authoritative local copy.
  removeDuplicateFullCopies();
  let cache=normalize(migrated);
  try{write(K.patients,cache)}catch(e){console.error('patient local migration failed',e)}

  let flushing=false;
  function diff(prev,next){
    const a=new Map(arr(prev).map(p=>[keyOf(p),p])),b=new Map(arr(next).map(p=>[keyOf(p),p]));
    const upserts=[];for(const [k,p] of b){const old=a.get(k);if(!old||comparable(old)!==comparable(p))upserts.push(p)}
    const deletes=[];for(const [k,p] of a)if(!b.has(k))deletes.push(p);
    return {upserts,deletes};
  }
  function enqueue(changes){
    if(!changes.upserts.length&&!changes.deletes.length)return;
    const q=arr(read(K.queue,[]));
    q.push({id:'q_'+Date.now(),at:now(),upserts:clone(changes.upserts),deletes:clone(changes.deletes)});
    write(K.queue,q.slice(-50));setTimeout(flush,20);
  }
  async function flush(){
    if(flushing||!window.DCOS?.Store||!navigator.onLine)return;flushing=true;
    try{
      await DCOS.Store.init();let q=arr(read(K.queue,[]));
      while(q.length){const item=q[0];
        for(const p of arr(item.upserts))await DCOS.Store.set(`clinics/${clinicId}/patients/${p.id}`,p);
        for(const p of arr(item.deletes)){const id=p?.id||idOf(p);if(id)await DCOS.Store.del(`clinics/${clinicId}/patients/${id}`)}
        q.shift();write(K.queue,q);
      }
      write(K.state,{version:VERSION,clinicId,count:cache.length,status:'synced',at:now()});
    }catch(e){write(K.state,{version:VERSION,clinicId,count:cache.length,status:'queued',error:String(e?.message||e),at:now()});console.warn('patient sync',e)}
    finally{flushing=false}
  }
  function getPatientsFast(){return cache}
  function savePatientsFast(list){
    const previous=cache,next=normalize(list,previous),changes=diff(previous,next);cache=next;
    try{write(K.patients,cache)}catch(e){
      console.error('patient local save failed',e);
      if(e?.name==='QuotaExceededError') alert('تعذر الحفظ المحلي بسبب امتلاء مساحة المتصفح. لم يتم إنشاء نسخ إضافية؛ يرجى حذف ملفات موقع قديمة غير لازمة.');
      throw e;
    }
    enqueue(changes);
    try{write(K.state,{version:VERSION,clinicId,count:cache.length,status:'local-saved',changed:changes.upserts.length,deleted:changes.deletes.length,at:now()})}catch(e){}
    document.dispatchEvent(new CustomEvent('dcos:data-updated',{detail:{scope:'patients'}}));
    return cache;
  }
  async function mergeCloud(){
    try{
      if(!window.DCOS?.Store||!navigator.onLine)return;
      await DCOS.Store.init();const remote=await DCOS.Store.list(`clinics/${clinicId}/patients`);
      const merged=normalize(dedupe([cache,remote]),cache),changes=diff(remote,merged);cache=merged;write(K.patients,cache);
      if(changes.upserts.length)enqueue(changes);
      document.dispatchEvent(new CustomEvent('dcos:patients-ready',{detail:{count:cache.length}}));
    }catch(e){console.warn('patient cloud merge',e)}
  }
  function install(){window.getPatients=getPatientsFast;window.savePatients=savePatientsFast;try{getPatients=getPatientsFast;savePatients=savePatientsFast}catch(e){}document.documentElement.dataset.patientStorage='offline-single-v15.69.1'}
  install();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install();setTimeout(install,300);setTimeout(mergeCloud,700)},{once:true});else setTimeout(mergeCloud,400);
  window.addEventListener('online',()=>{flush();mergeCloud()});
  setInterval(()=>{install();if(arr(read(K.queue,[])).length)flush()},15000);
  window.DCOS_PATIENT_VAULT={version:VERSION,clinicId:()=>clinicId,read:getPatientsFast,save:savePatientsFast,flush,diagnostics:()=>({version:VERSION,clinicId,count:cache.length,queue:arr(read(K.queue,[])).length,state:read(K.state,null),key:K.patients})};
})();
