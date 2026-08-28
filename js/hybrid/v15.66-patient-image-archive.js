(function(){
  'use strict';

  const VERSION='15.69.2-filesystem-image-explorer';
  const DB_NAME='dcos-local-directory-handles';
  const DB_STORE='handles';
  const HANDLE_KEY='patient-image-archive';
  const ENABLED_KEY='dcos_patient_archive_enabled';
  const NAME_KEY='dcos_patient_archive_name';
  const UNIFIED_ROOT_NAME='Dental Chain Patients';

  let directoryHandle=null;
  let dbPromise=null;

  const categoryFolders={
    panorama:'01 - صور بانوراما',
    xray:'02 - صور أشعة وسينسور',
    before:'03 - صور قبل العلاج',
    after:'04 - صور بعد العلاج',
    intra:'05 - صور داخل الفم',
    photo:'06 - صور فوتوغرافية',
    other:'07 - صور أخرى'
  };

  function safeName(value,fallback='بدون اسم'){
    const cleaned=String(value||'').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/\s+/g,' ').replace(/[. ]+$/g,'').slice(0,100);
    return cleaned||fallback;
  }
  function patientCode(p){return safeName(p?.fileNo||p?.fileNumber||p?.id||'بدون رقم','بدون رقم')}
  function patientFolderName(p){return `${patientCode(p)} - ${safeName(p?.name,'مريض')}`}
  function archiveCategory(type,category){
    const key=String(category||(type==='xrays'?'xray':'photo')).toLowerCase();
    return categoryFolders[key]||categoryFolders.other;
  }
  function stamp(date=new Date()){
    const pad=n=>String(n).padStart(2,'0');
    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error('IndexedDB غير متاح'));
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(DB_STORE))request.result.createObjectStore(DB_STORE)};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('تعذر فتح التخزين المحلي'));
    });
    return dbPromise;
  }
  async function storeHandle(handle){
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,'readwrite');
      tx.objectStore(DB_STORE).put(handle,HANDLE_KEY);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
  async function loadHandle(){
    if(directoryHandle)return directoryHandle;
    try{
      const db=await openDb();
      directoryHandle=await new Promise((resolve,reject)=>{
        const request=db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(HANDLE_KEY);
        request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);
      });
    }catch{}
    return directoryHandle;
  }
  async function hasWritePermission(handle,request=false){
    if(!handle)return false;
    const options={mode:'readwrite'};
    try{
      if((await handle.queryPermission(options))==='granted')return true;
      if(request&&(await handle.requestPermission(options))==='granted')return true;
    }catch{}
    return false;
  }
  async function requireHandle(requestPermission=false){
    const handle=await loadHandle();
    if(!handle)return null;
    if(!await hasWritePermission(handle,requestPermission))return null;
    return await archiveRoot(handle);
  }

  async function writeFile(parent,name,data){
    const file=await parent.getFileHandle(safeName(name,'file'),{create:true});
    const writable=await file.createWritable();
    await writable.write(data);
    await writable.close();
  }
  async function readJsonFile(parent,name){
    try{
      const handle=await parent.getFileHandle(name);
      const file=await handle.getFile();
      return JSON.parse(await file.text());
    }catch{return null}
  }
  function comparable(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s_\-–—]+/g,' ').trim()}
  function sameValue(a,b){return Boolean(a&&b&&comparable(a)===comparable(b))}
  async function archiveRoot(handle){
    if(!handle)return null;
    const name=comparable(handle.name);
    if(name===comparable(UNIFIED_ROOT_NAME))return handle;
    if(name==='documents'||name==='المستندات')return await handle.getDirectoryHandle(UNIFIED_ROOT_NAME,{create:true});
    return handle;
  }
  async function findExistingPatientDirectory(root,p){
    const wanted={
      patientId:String(p?.id||p?.patientId||''),
      fileNo:String(p?.fileNo||p?.fileNumber||''),
      fullName:String(p?.name||p?.fullName||'')
    };
    let best=null;
    try{
      for await(const entry of root.values()){
        if(entry.kind!=='directory')continue;
        const manifest=(await readJsonFile(entry,'patient.json'))||(await readJsonFile(entry,'_patient.json'))||(await readJsonFile(entry,'.dtdc-patient.json'));
        if(!manifest)continue;
        let score=0;
        if(wanted.fileNo&&sameValue(wanted.fileNo,manifest.fileNo||manifest.fileNumber))score+=120;
        if(wanted.patientId&&sameValue(wanted.patientId,manifest.patientId||manifest.id))score+=100;
        if(wanted.fullName&&sameValue(wanted.fullName,manifest.fullName||manifest.name))score+=30;
        if(score>=100&&(!best||score>best.score))best={handle:entry,manifest,score};
      }
    }catch{}
    if(best)return best;
    const expected=patientFolderName(p);
    try{return {handle:await root.getDirectoryHandle(expected),manifest:null,score:10}}catch{return null}
  }
  function clinicIdentity(){
    const query=new URLSearchParams(location.search),hybrid=window.Hybrid||{};
    return {
      clinicId:String(hybrid.clinic?.id||query.get('clinic')||localStorage.getItem('dcos_v9_clinic_id')||'default'),
      clinicName:String(hybrid.clinic?.name||localStorage.getItem('dcos_current_clinic_name')||'عيادة د. طاهر')
    };
  }
  async function writeRootManifest(handle){
    const clinic=clinicIdentity();
    await writeFile(handle,'_DentalChain_Archive.json',JSON.stringify({
      schema:'dcos-patient-image-archive-v1',
      product:'Dental Chain OS',
      clinicId:clinic.clinicId,
      clinicName:clinic.clinicName,
      updatedAt:new Date().toISOString()
    },null,2));
  }
  async function patientDirectory(handle,p){
    const root=await archiveRoot(handle);
    const existing=await findExistingPatientDirectory(root,p);
    const folder=existing?.handle||await root.getDirectoryHandle(patientFolderName(p),{create:true});
    const previous=existing?.manifest||{};
    const clinic=clinicIdentity();
    const manifest={
      ...previous,
      schema:'dtdc-patient-archive-v3',
      patientId:String(p?.id||p?.patientId||previous.patientId||p?.fileNo||p?.fileNumber||''),
      fileNo:String(p?.fileNo||p?.fileNumber||previous.fileNo||''),
      name:String(p?.name||p?.fullName||previous.name||previous.fullName||''),
      fullName:String(p?.name||p?.fullName||previous.fullName||previous.name||''),
      firstName:String(p?.name||p?.fullName||previous.firstName||'').trim().split(/\s+/)[0]||'',
      gender:String(p?.gender||previous.gender||''),
      doctorName:String(p?.doctorName||previous.doctorName||''),
      clinicId:clinic.clinicId,
      clinicName:clinic.clinicName,
      updatedAt:new Date().toISOString()
    };
    await writeFile(folder,'patient.json',JSON.stringify(manifest,null,2));
    await writeFile(folder,'_patient.json',JSON.stringify(manifest,null,2));
    return folder;
  }
  async function archiveBlobs(p,type,category,items,updateRoot=true){
    const handle=await requireHandle(false);
    if(!handle)return {saved:0,skipped:items.length,permission:false};
    const patientDir=await patientDirectory(handle,p);
    const categoryDir=await patientDir.getDirectoryHandle(archiveCategory(type,category),{create:true});
    let saved=0;
    for(let i=0;i<items.length;i++){
      const item=items[i];
      const original=safeName(item.name||`image-${i+1}.jpg`,`image-${i+1}.jpg`);
      const unique=`${Date.now().toString(36)}-${String(i+1).padStart(2,'0')}`;
      const name=item.archiveName
        ?safeName(item.archiveName,`legacy-${original}`)
        :`${stamp()}-${unique} - ${original}`;
      await writeFile(categoryDir,name,item.blob);
      saved++;
    }
    if(updateRoot)await writeRootManifest(handle);
    return {saved,skipped:items.length-saved,permission:true};
  }
  async function archiveSelectedFiles(p,type,category,files){
    if(localStorage.getItem(ENABLED_KEY)!=='1'||!files.length)return;
    try{
      const result=await archiveBlobs(p,type,category,files.map(file=>({name:file.name,blob:file})));
      if(!result.permission&&localStorage.getItem('dcos_patient_archive_permission_warned')!=='1'){
        localStorage.setItem('dcos_patient_archive_permission_warned','1');
        alert('تعذر نسخ الصورة إلى أرشيف المرضى. افتح Data Manager واضغط إعادة تفعيل المجلد. بقيت الصورة محفوظة داخل ملف المريض كالمعتاد.');
      }
    }catch(error){
      console.error('Patient archive copy failed',error);
      alert('تم حفظ الصورة داخل ملف المريض، لكن تعذر إنشاء النسخة المحلية: '+(error.message||error));
    }
  }

  function activePatient(){
    try{if(typeof patient!=='undefined'&&patient)return patient}catch{}
    try{return window.DCOS_getActivePatient?.()||window.DCOS_activePatient?.()||null}catch{return null}
  }
  function categoryKey(type,category){
    return String(category||(type==='xrays'?'xray':'photo')).toLowerCase();
  }
  function categoryLabel(type,category){
    const key=categoryKey(type,category);
    return ({panorama:'أشعة بانوراما',xray:'أشعة وسينسور',before:'صور قبل العلاج',after:'صور بعد العلاج',intra:'صور داخل الفم',photo:'صور فوتوغرافية',other:'صور أخرى'})[key]||'صور';
  }
  function extensionOf(name,type='image/jpeg'){
    const match=String(name||'').match(/(\.[a-zA-Z0-9]{2,8})$/);
    if(match)return match[1].toLowerCase();
    const map={'image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/bmp':'.bmp','image/tiff':'.tif'};
    return map[type]||'.jpg';
  }
  function operationCode(type,category){
    return ({panorama:'PANORAMA',xray:'XRAY',before:'BEFORE',after:'AFTER',intra:'INTRAORAL',photo:'PHOTO',other:'OTHER'})[categoryKey(type,category)]||'IMAGE';
  }
  function buildArchiveName(p,type,category,file,index=0){
    const patientPart=safeName(p?.name||p?.fullName||'مريض','مريض');
    const code=patientCode(p);
    const op=operationCode(type,category);
    const ext=extensionOf(file?.name,file?.type);
    const suffix=index?`-${String(index+1).padStart(2,'0')}`:'';
    return safeName(`${code} - ${patientPart} - ${op} - ${stamp()}${suffix}${ext}`,`image-${stamp()}${suffix}${ext}`);
  }
  async function getCategoryDirectory(p,type,category,requestPermission=true){
    const root=await requireHandle(requestPermission);
    if(!root)return null;
    const patientDir=await patientDirectory(root,p);
    return await patientDir.getDirectoryHandle(archiveCategory(type,category),{create:true});
  }
  async function listCategoryFiles(p,type,category){
    const dir=await getCategoryDirectory(p,type,category,true);
    if(!dir)return null;
    const files=[];
    for await(const entry of dir.values()){
      if(entry.kind!=='file')continue;
      try{
        const file=await entry.getFile();
        if(!String(file.type||'').startsWith('image/')&&!/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name))continue;
        files.push({handle:entry,file,name:file.name,lastModified:file.lastModified,size:file.size});
      }catch(error){console.warn('تعذر قراءة صورة من الأرشيف',error)}
    }
    files.sort((a,b)=>b.lastModified-a.lastModified||a.name.localeCompare(b.name,'ar'));
    return {dir,files};
  }
  async function importFilesToCategory(p,type,category,files){
    if(!files?.length)return {saved:0,names:[]};
    const dir=await getCategoryDirectory(p,type,category,true);
    if(!dir)throw new Error('يجب ربط مجلد المرضى أو إعادة تفعيل صلاحيته أولاً');
    const names=[];
    for(let i=0;i<files.length;i++){
      const file=files[i];
      let name=buildArchiveName(p,type,category,file,i);
      let attempt=1;
      while(true){
        try{
          await dir.getFileHandle(name);
          const ext=extensionOf(name,file.type);
          const base=name.slice(0,-ext.length);
          name=`${base}-${String(attempt++).padStart(2,'0')}${ext}`;
        }catch{break}
      }
      await writeFile(dir,name,file);
      names.push(name);
    }
    const root=await requireHandle(false);if(root)await writeRootManifest(root);
    return {saved:names.length,names};
  }
  function chooseImageFiles(){
    return new Promise(resolve=>{
      const input=document.createElement('input');
      input.type='file';input.accept='image/*';input.multiple=true;
      input.style.display='none';
      input.onchange=()=>{const files=Array.from(input.files||[]);input.remove();resolve(files)};
      input.oncancel=()=>{input.remove();resolve([])};
      document.body.appendChild(input);input.click();
    });
  }
  function closeExplorer(){
    const modal=document.getElementById('dcosImageExplorer');
    if(modal){
      modal.querySelectorAll('img[data-object-url]').forEach(img=>{try{URL.revokeObjectURL(img.dataset.objectUrl)}catch{}});
      modal.remove();
    }
  }
  async function openImageFile(fileHandle,name){
    try{
      const file=await fileHandle.getFile();
      const url=URL.createObjectURL(file);
      const modal=document.createElement('div');modal.className='modal image-lightbox';modal.id='dcosArchiveLightbox';
      modal.innerHTML=`<div class="image-lightbox-box"><img src="${url}" alt="${safeName(name,'صورة')}"><p>${safeName(name,'صورة')}</p><button type="button">إغلاق</button></div>`;
      modal.querySelector('button').onclick=()=>{URL.revokeObjectURL(url);modal.remove()};
      document.body.appendChild(modal);
    }catch(error){alert('تعذر فتح الصورة: '+(error.message||error))}
  }
  async function renderExplorer(p,type,category){
    const modal=document.getElementById('dcosImageExplorer');if(!modal)return;
    const body=modal.querySelector('.dcos-image-explorer-body');
    body.innerHTML='<p class="dcos-image-loading">جارِ قراءة مجلد الصور…</p>';
    let result;
    try{result=await listCategoryFiles(p,type,category)}catch(error){body.innerHTML=`<p class="dcos-image-error">${safeName(error.message||error,'تعذر قراءة المجلد')}</p>`;return}
    if(!result){body.innerHTML='<p class="dcos-image-error">لم يتم ربط مجلد المرضى. افتح إدارة البيانات واربط المجلد أولاً.</p>';return}
    if(!result.files.length){body.innerHTML='<p class="dcos-image-empty">لا توجد صور في هذا المجلد بعد. اضغط زر + لإضافة صورة.</p>';return}
    body.innerHTML='<div class="dcos-image-file-list"></div>';
    const list=body.firstElementChild;
    for(const item of result.files){
      const url=URL.createObjectURL(item.file);
      const row=document.createElement('button');row.type='button';row.className='dcos-image-file-row';
      row.innerHTML=`<img src="${url}" data-object-url="${url}" alt=""><span class="dcos-image-file-info"><strong>${safeName(item.name,'صورة')}</strong><small>${new Date(item.lastModified).toLocaleString('ar')} · ${Math.max(1,Math.round(item.size/1024))} KB</small></span><span class="dcos-image-open-icon">فتح</span>`;
      row.onclick=()=>openImageFile(item.handle,item.name);
      list.appendChild(row);
    }
  }
  async function addFromExplorer(p,type,category){
    const files=await chooseImageFiles();if(!files.length)return;
    const add=document.querySelector('#dcosImageExplorer .dcos-image-add');if(add)add.disabled=true;
    try{
      const result=await importFilesToCategory(p,type,category,files);
      alert(`تم نسخ ${result.saved} صورة إلى مجلد المريض وتسميتها تلقائياً. لم تُحفظ الصور داخل المتصفح أو Firebase.`);
      await renderExplorer(p,type,category);
    }catch(error){alert('تعذر نسخ الصور: '+(error.message||error))}
    finally{if(add)add.disabled=false}
  }
  async function openExplorer(type,category){
    const p=activePatient();if(!p)return alert('افتح ملف مريض أولاً');
    closeExplorer();
    const modal=document.createElement('div');modal.className='modal dcos-image-explorer';modal.id='dcosImageExplorer';
    modal.innerHTML=`<div class="dcos-image-explorer-box"><div class="dcos-image-explorer-head"><div><h3>${categoryLabel(type,category)}</h3><p>${safeName(p.name||p.fullName,'مريض')} — الصور الموجودة فعلياً داخل مجلد المريض</p></div><div class="dcos-image-explorer-controls"><button type="button" class="dcos-image-add" title="استيراد صور">＋</button><button type="button" class="dcos-image-close">إغلاق</button></div></div><div class="dcos-image-explorer-body"></div></div>`;
    modal.querySelector('.dcos-image-close').onclick=closeExplorer;
    modal.querySelector('.dcos-image-add').onclick=()=>addFromExplorer(p,type,category);
    modal.addEventListener('click',e=>{if(e.target===modal)closeExplorer()});
    document.body.appendChild(modal);
    await renderExplorer(p,type,category);
  }
  function installMediaHook(){
    const explorerTrigger=function(type,category){return openExplorer(type,category)};
    explorerTrigger.__dcosPatientArchive=true;
    window.triggerPatientMediaCategory=explorerTrigger;
    window.triggerPatientMedia=function(type){return openExplorer(type,type==='xrays'?'xray':'photo')};
    window.importPatientMedia=async function(type,event,category){
      const p=activePatient();
      const files=Array.from(event?.target?.files||[]);
      if(event?.target)event.target.value='';
      if(!p||!files.length)return;
      try{
        await importFilesToCategory(p,type,category,files);
        alert('تم نسخ الصور إلى مجلد المريض فقط. لم تُحفظ داخل المتصفح أو Firebase.');
      }catch(error){alert('تعذر نسخ الصور: '+(error.message||error))}
    };
    window.importPatientMedia.__dcosPatientArchive=true;
  }

  async function chooseFolder(){
    if(!window.showDirectoryPicker){
      alert('اختيار مجلد أرشيف المرضى يحتاج Chrome أو Edge على الكمبيوتر، ويجب فتح النظام من رابط HTTPS.');
      return false;
    }
    try{
      directoryHandle=await window.showDirectoryPicker({id:'dcos-patient-archive-unified',mode:'readwrite',startIn:'documents'});
      if(!await hasWritePermission(directoryHandle,true))throw new Error('لم يتم منح صلاحية الكتابة');
      await storeHandle(directoryHandle);
      localStorage.setItem(ENABLED_KEY,'1');
      const root=await archiveRoot(directoryHandle);
      localStorage.setItem(NAME_KEY,root?.name||directoryHandle.name||UNIFIED_ROOT_NAME);
      localStorage.removeItem('dcos_patient_archive_permission_warned');
      await writeRootManifest(await archiveRoot(directoryHandle));
      await updatePanelStatus();
      alert('تم ربط البرنامج الرئيسي بأرشيف الكونترولر الموحّد داخل Documents\\Dental Chain Patients. أزرار الصور ستعرض محتويات مجلد المريض، وزر + سينسخ الصور إليه مباشرة دون حفظها في LocalStorage أو Firebase.');
      return true;
    }catch(error){
      if(error?.name!=='AbortError')alert('تعذر تحديد المجلد: '+(error.message||error));
      return false;
    }
  }
  async function authorizeFolder(){
    const handle=await loadHandle();
    if(!handle)return chooseFolder();
    if(await hasWritePermission(handle,true)){
      localStorage.removeItem('dcos_patient_archive_permission_warned');
      await writeRootManifest(handle);await updatePanelStatus();
      alert('المجلد جاهز للكتابة.');return true;
    }
    alert('لم يتم منح صلاحية الكتابة.');return false;
  }
  async function testFolder(){
    const handle=await requireHandle(true);
    if(!handle)return alert('حدد مجلد الأرشيف أولاً.');
    try{
      await writeRootManifest(handle);
      await updatePanelStatus();
      alert('نجح اختبار مجلد الأرشيف.');
    }catch(error){alert('فشل اختبار الكتابة: '+(error.message||error))}
  }

  async function dataUrlBlob(data){
    const response=await fetch(data);return await response.blob();
  }
  async function archiveExisting(){
    const handle=await requireHandle(true);
    if(!handle)return alert('حدد مجلد الأرشيف أو أعد تفعيل صلاحيته أولاً.');
    if(!confirm('سيتم إنشاء نسخة محلية مرتبة لكل صور المرضى المحفوظة حالياً. لن يتم حذف أو تعديل الصور الأصلية. متابعة؟'))return;
    const status=document.getElementById('dcosPatientArchiveStatus');
    const patients=typeof window.getPatients==='function'?(window.getPatients()||[]):[];
    let saved=0,failed=0;
    for(let pi=0;pi<patients.length;pi++){
      const p=patients[pi];
      const groups=[['xrays',p?.media?.xrays||[]],['photos',p?.media?.photos||[]]];
      for(const [type,list] of groups){
        for(let i=0;i<list.length;i++){
          const media=list[i];
          if(!media?.data)continue;
          try{
            if(status)status.textContent=`جارِ أرشفة ${p.name||'مريض'} — ${saved+failed+1}`;
            const blob=await dataUrlBlob(media.data);
            const mediaStamp=safeName(String(media.uploadedAt||`item-${String(i+1).padStart(4,'0')}`).replace(/[ :/\\]+/g,'-'),'item');
            const original=safeName(media.name||`image-${i+1}.jpg`,`image-${i+1}.jpg`);
            await archiveBlobs(p,type,media.category,[{
              name:original,
              archiveName:`legacy-${mediaStamp}-${String(i+1).padStart(4,'0')} - ${original}`,
              blob
            }],false);
            saved++;
          }catch(error){failed++;console.error(error)}
        }
      }
    }
    await writeRootManifest(handle);
    await updatePanelStatus();
    alert(`اكتملت الأرشفة. تم نسخ ${saved} صورة${failed?`، وتعذر نسخ ${failed}`:''}.`);
  }

  async function statusInfo(){
    const handle=await loadHandle();
    if(!handle)return {text:'لم يتم تحديد مجلد بعد',state:'missing'};
    const allowed=await hasWritePermission(handle,false);
    return allowed
      ?{text:`المجلد الحالي: ${handle.name} — جاهز`,state:'ready'}
      :{text:`المجلد المحفوظ: ${handle.name} — يحتاج إعادة تفعيل`,state:'warning'};
  }
  async function updatePanelStatus(){
    const el=document.getElementById('dcosPatientArchiveStatus');if(!el)return;
    const info=await statusInfo();el.textContent=info.text;el.dataset.state=info.state;
  }
  function appendDataManagerTools(){
    const host=document.querySelector('#output .dcos-data-manager');
    if(!host||host.querySelector('.dcos-patient-archive-panel'))return;
    const panel=document.createElement('section');panel.className='dcos-patient-archive-panel';
    panel.innerHTML=`
      <div><h3>📁 أرشيف صور المرضى على الكمبيوتر</h3><p>يحفظ الصور في نفس أرشيف الكونترولر داخل Documents\\Dental Chain Patients. عند الاختيار حدّد مجلد Documents نفسه أو مجلد Dental Chain Patients.</p></div>
      <div id="dcosPatientArchiveStatus" class="dcos-patient-archive-status">جارِ فحص المجلد…</div>
      <div class="dcos-patient-archive-actions">
        <button type="button" onclick="DCOSPatientArchive.chooseFolder()">📁 ربط مجلد المرضى الموحّد</button>
        <button type="button" onclick="DCOSPatientArchive.authorize()">🔐 إعادة تفعيل المجلد</button>
        <button type="button" onclick="DCOSPatientArchive.test()">✅ اختبار الكتابة</button>
        <button type="button" onclick="DCOSPatientArchive.archiveExisting()">🗂 أرشفة الصور الموجودة مسبقاً</button>
      </div>`;
    const summary=host.querySelector('.dcos-doctor-summary');
    if(summary)summary.insertAdjacentElement('afterend',panel);else host.prepend(panel);
    updatePanelStatus();
  }
  function installDataManagerHook(){
    const original=window.openDataManager;
    if(typeof original!=='function'||original.__dcosPatientArchive)return;
    const wrapped=async function(){
      const result=await original.apply(this,arguments);
      appendDataManagerTools();
      return result;
    };
    wrapped.__dcosPatientArchive=true;window.openDataManager=wrapped;
  }

  window.DCOSPatientArchive={
    chooseFolder,authorize:authorizeFolder,test:testFolder,archiveExisting,openExplorer,importFilesToCategory,
    getHandle:()=>loadHandle(),status:statusInfo,version:VERSION
  };
  window.dcosChooseImagesFolder=chooseFolder;
  if(window.DCOSContacts)window.DCOSContacts.imagesFolder=chooseFolder;

  function init(){installMediaHook();installDataManagerHook();loadHandle().catch(()=>{});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,100));else setTimeout(init,100);
  setInterval(()=>{installMediaHook();installDataManagerHook()},1200);
})();
