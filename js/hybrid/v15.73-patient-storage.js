'use strict';
/* Dental Chain OS v15.73 — durable patient storage
   Browser: IndexedDB. Desktop: Electron/SQLite bridge.
   localStorage is used only as a one-time migration source and for tiny status data.
*/
(function(){
  const VERSION='15.73-durable-store';
  const DB_NAME='dcos-patient-store-v15';
  const DB_VERSION=1;
  const RECORDS='clinic-records';
  const STATUS_KEY='dcos_v1573_patient_store_status';
  const clone=value=>{try{return JSON.parse(JSON.stringify(value))}catch{return value}};
  const array=value=>Array.isArray(value)?value:[];
  const safe=value=>String(value||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_')||'taher-main-clinic';
  const clinicId=safe(new URLSearchParams(location.search).get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic');
  const scopedKey=`dcos_v1513_patients_${clinicId}`;
  const legacyKeys=[
    scopedKey,
    'patients',
    `dcos_v1553_patients_${clinicId}`,
    `dcos_v1548_patient_vault_${clinicId}`,
    `dcos_v1553_backup_${clinicId}`,
    'clinicAutoBackupsV5'
  ];
  let cache=[];
  let backups=[];
  let backend='initializing';
  let lastError='';
  let writeChain=Promise.resolve();
  let dirty=false;
  let migrationComplete=false;

  function parseLocal(key,fallback=null){
    try{
      const raw=localStorage.getItem(key);
      return raw==null?fallback:JSON.parse(raw);
    }catch{return fallback}
  }
  function patientKey(patient,index=0){
    return String(patient?.id||patient?.uid||patient?.fileNo||patient?.fileNumber||
      (patient?.name&&patient?.phone?`${patient.name}__${patient.phone}`:`patient_${index}`));
  }
  function timestamp(patient){
    const raw=patient?.syncMeta?.updatedAt||patient?.updatedAt||patient?.createdAt||0;
    if(typeof raw==='number')return raw;
    const parsed=Date.parse(raw);
    return Number.isFinite(parsed)?parsed:0;
  }
  function mergePatientLists(primary,...others){
    const result=[];
    const positions=new Map();
    const add=(patient,index,preferExisting)=>{
      if(!patient)return;
      const key=patientKey(patient,index);
      const at=positions.get(key);
      if(at==null){positions.set(key,result.length);result.push(clone(patient));return}
      const current=result[at];
      const nextTime=timestamp(patient),currentTime=timestamp(current);
      if(nextTime>currentTime || (!preferExisting&&nextTime===currentTime))result[at]={...current,...clone(patient)};
    };
    array(primary).forEach((patient,index)=>add(patient,index,true));
    others.forEach(list=>array(list).forEach((patient,index)=>add(patient,index,true)));
    return result;
  }
  function migrationPayload(){
    const oldBackup=parseLocal(`dcos_v1553_backup_${clinicId}`,null);
    const autoBackups=array(parseLocal('clinicAutoBackupsV5',[]));
    const patientLists=[
      parseLocal(scopedKey,[]),
      parseLocal('patients',[]),
      parseLocal(`dcos_v1553_patients_${clinicId}`,[]),
      parseLocal(`dcos_v1548_patient_vault_${clinicId}`,[]),
      oldBackup?.patients
    ];
    const patients=patientLists.reduce((merged,list)=>mergePatientLists(merged,list),[]);
    return {patients,backups:autoBackups.slice(0,1)};
  }
  function updateStatus(extra={}){
    try{
      localStorage.setItem(STATUS_KEY,JSON.stringify({
        version:VERSION,clinicId,backend,count:cache.length,dirty,migrationComplete,
        lastError:lastError||undefined,updatedAt:new Date().toISOString(),...extra
      }));
    }catch{}
  }
  function openDatabase(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error('IndexedDB غير متاح'));
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(RECORDS))request.result.createObjectStore(RECORDS,{keyPath:'clinicId'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('تعذر فتح قاعدة المرضى المحلية'));
    });
  }
  async function idbLoad(){
    const db=await openDatabase();
    return new Promise((resolve,reject)=>{
      const request=db.transaction(RECORDS,'readonly').objectStore(RECORDS).get(clinicId);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error('تعذر قراءة قاعدة المرضى'));
    });
  }
  async function idbSave(record){
    const db=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(RECORDS,'readwrite');
      tx.objectStore(RECORDS).put({clinicId,...clone(record),updatedAt:new Date().toISOString()});
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>reject(tx.error||new Error('تعذر حفظ قاعدة المرضى'));
      tx.onabort=()=>reject(tx.error||new Error('أُلغي حفظ قاعدة المرضى'));
    });
  }
  function desktopBridge(){return window.DCOSDesktop?.patientStore||null}
  async function loadDurable(){
    const desktop=desktopBridge();
    if(desktop?.load){backend='sqlite';return await desktop.load(clinicId)}
    backend='indexeddb';
    return await idbLoad();
  }
  async function saveDurable(record){
    const desktop=desktopBridge();
    if(desktop?.save)return await desktop.save(clinicId,clone(record));
    return await idbSave(record);
  }
  function cleanupLegacy(){
    for(const key of legacyKeys){try{localStorage.removeItem(key)}catch{}}
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const key=localStorage.key(i)||'';
        if(/^dcos_v15(?:48_patient_vault|53_patients|53_backup)_/.test(key))localStorage.removeItem(key);
      }
    }catch{}
  }
  async function persist(){
    const record={schema:'dcos-patient-store-v1',patients:clone(cache),backups:clone(backups.slice(0,1))};
    await saveDurable(record);
    dirty=false;
    lastError='';
    updateStatus({savedAt:new Date().toISOString()});
    return true;
  }
  function schedulePersist(){
    dirty=true;
    updateStatus();
    writeChain=writeChain.catch(()=>false).then(persist).catch(error=>{
      dirty=true;
      lastError=String(error?.message||error);
      updateStatus();
      console.error('Durable patient save failed',error);
      document.dispatchEvent(new CustomEvent('dcos:patient-storage-error',{detail:{message:lastError}}));
      return false;
    });
    return writeChain;
  }
  function getPatients(){return cache}
  function setPatients(list){
    cache=array(list);
    schedulePersist().catch(()=>{});
    document.dispatchEvent(new CustomEvent('dcos:data-updated',{detail:{scope:'patients',backend}}));
    return cache;
  }
  function getBackups(){return backups}
  function setBackups(list){backups=array(list).slice(0,1);schedulePersist().catch(()=>{});return backups}
  async function flush(){await writeChain;if(dirty)await persist();return true}

  const migrated=migrationPayload();
  cache=migrated.patients;
  backups=migrated.backups;
  const ready=(async()=>{
    try{
      const durable=await loadDurable();
      cache=mergePatientLists(array(durable?.patients),migrated.patients);
      backups=array(durable?.backups).length?array(durable.backups).slice(0,1):migrated.backups;
      await persist();
      // Large localStorage copies are removed only after the durable write succeeds.
      cleanupLegacy();
      migrationComplete=true;
      updateStatus({readyAt:new Date().toISOString()});
      try{if(navigator.storage?.persist)await navigator.storage.persist()}catch{}
      document.dispatchEvent(new CustomEvent('dcos:patients-ready',{detail:{count:cache.length,backend}}));
      return cache;
    }catch(error){
      backend='memory-fallback';
      lastError=String(error?.message||error);
      updateStatus();
      console.error('Patient store initialization failed',error);
      // Keep the legacy data untouched so a failed migration is always recoverable.
      return cache;
    }
  })();

  window.DCOSPatientStore={
    version:VERSION,clinicId,ready,get:getPatients,set:setPatients,flush,
    getBackups,setBackups,
    diagnostics:()=>({version:VERSION,clinicId,backend,count:cache.length,backupCount:backups.length,dirty,migrationComplete,lastError})
  };
  document.documentElement.dataset.patientStorage='durable-v15.73';
})();
