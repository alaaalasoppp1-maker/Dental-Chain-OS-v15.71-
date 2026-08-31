'use strict';
/* Dental Chain OS v15.15 Hybrid Clinic Bridge
   Keeps the full v14.9 clinic UI/features and replaces only auth/clinic context/accounts hooks
   with the stable v15 account/dashboard model. */
(function(){
  const VERSION='15.18 Hybrid Clinic';
  const ADMIN_PASS=window.ADMIN_PASS||'DTDC2026';
  const params=new URLSearchParams(location.search);
  const clinicId=safe(params.get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic');
  const SESSION_KEY='dcos_v1513_clinic_session';
  const patientStore=()=>window.DCOSPatientStore||null;
  function safe(v){return String(v||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_')||'taher-main-clinic'}
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function jsonGet(k,f){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch(e){return f}}
  function jsonSet(k,v){localStorage.setItem(k,JSON.stringify(v));return v}
  function now(){return new Date().toISOString()}
  function patientId(p,i){return safe(p.id||p.uid||p.fileNo||p.fileNumber||p.name||('patient_'+i+'_'+Date.now()))}

  // Make the old v8/v9 sync engine see the selected clinic before it starts.
  localStorage.setItem('dcos_v15_last_clinic', clinicId);
  localStorage.setItem('clinic_v8_clinic_id', clinicId);
  localStorage.setItem('dcos_v9_clinic_id', clinicId);
  localStorage.setItem('dcos_v14_active_branch', clinicId);
  localStorage.setItem('dcos_current_clinic_id', clinicId);
  document.documentElement.classList.add('dcos-auth-pending');
  document.body?.classList?.add('dcos-auth-pending');

  // No stale PWA cache while developing.
  try{ if('serviceWorker' in navigator){ navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{}); } }catch(e){}
  try{ if(window.caches){ caches.keys().then(keys=>keys.forEach(k=>caches.delete(k))).catch(()=>{}); } }catch(e){}

  // Keep the old synchronous API, backed by IndexedDB in browsers and SQLite on desktop.
  window.getPatients=function(){
    const arr=patientStore()?.get?.()||[];
    return Array.isArray(arr)?arr:[];
  };
  window.savePatients=function(list){
    const before=window.getPatients();
    const arr=(Array.isArray(list)?list:[]).map((p,i)=>({...p, clinicId, updatedAt:p.updatedAt||now(), id:p.id||patientId(p,i)}));
    patientStore()?.set?.(arr);
    scheduleCloudSync(before,arr);
    return arr;
  };

  let pushChain=Promise.resolve();
  function scheduleCloudSync(before,arr){
    const oldSnapshot=JSON.parse(JSON.stringify(Array.isArray(before)?before:[]));
    const newSnapshot=JSON.parse(JSON.stringify(Array.isArray(arr)?arr:[]));
    pushChain=pushChain
      .then(()=>deleteRemovedPatientsCloud(oldSnapshot,newSnapshot))
      .then(()=>pushPatientsCloud(newSnapshot))
      .catch(e=>console.warn('live save queue',e));
    return pushChain;
  }
  function samePatient(a,b){
    const aid=String(a?.id||'').trim(), bid=String(b?.id||'').trim();
    if(aid&&bid&&aid===bid)return true;
    const af=String(a?.fileNo||a?.fileNumber||'').trim(), bf=String(b?.fileNo||b?.fileNumber||'').trim();
    if(af&&bf&&af===bf)return true;
    const an=String(a?.name||'').trim(), bn=String(b?.name||'').trim();
    const ap=String(a?.phone||'').trim(), bp=String(b?.phone||'').trim();
    return !!an&&an===bn&&(!ap||!bp||ap===bp);
  }
  async function deleteRemovedPatientsCloud(before,after){
    const removed=(Array.isArray(before)?before:[]).filter(old=>!(Array.isArray(after)?after:[]).some(cur=>samePatient(old,cur)));
    if(!removed.length)return;
    try{
      if(!window.DCOS||!DCOS.Store)return;
      await DCOS.Store.init();
      const cloud=await DCOS.Store.list('clinics/'+clinicId+'/patients');
      for(const removedPatient of removed){
        const matches=(Array.isArray(cloud)?cloud:[]).filter(row=>samePatient(removedPatient,row));
        if(!matches.length && removedPatient.id)matches.push({id:removedPatient.id});
        for(const row of matches){
          if(row?.id)await DCOS.Store.del('clinics/'+clinicId+'/patients/'+row.id);
        }
        try{await DCOS.Audit.log(clinicId,'delete_patient',{patientId:removedPatient.id||'',fileNo:removedPatient.fileNo||'',name:removedPatient.name||''},Hybrid.account);}catch(e){}
      }
    }catch(e){console.error('patient cloud delete failed',e);throw e;}
  }
  async function pushPatientsCloud(arr){
    try{
      if(!window.DCOS || !DCOS.Store) return;
      await DCOS.Store.init();
      for(let i=0;i<arr.length;i++){
        const p={...arr[i], clinicId, id:arr[i].id||patientId(arr[i],i), updatedAt:now()};
        await DCOS.Store.set('clinics/'+clinicId+'/patients/'+p.id,p);
      }
    }catch(e){console.warn('patient cloud push skipped',e)}
  }
  function patientTimestamp(p){
    const raw=p?.syncMeta?.updatedAt||p?.updatedAt||p?.createdAt||0;
    if(typeof raw==='number')return raw;
    const t=Date.parse(raw); return Number.isFinite(t)?t:0;
  }
  function mergePatientCopies(localList,cloudList){
    const out=[];
    const put=(p,source)=>{
      if(!p)return;
      const i=out.findIndex(x=>samePatient(x,p));
      if(i<0){out.push({...p});return;}
      const current=out[i];
      const ct=patientTimestamp(current), pt=patientTimestamp(p);
      // Prefer the newer copy. On equal/unknown timestamps, keep the local copy
      // so an interrupted cloud upload can never erase the user's latest work.
      if(pt>ct || (pt===ct && source==='local')) out[i]={...current,...p};
    };
    (Array.isArray(cloudList)?cloudList:[]).forEach(p=>put(p,'cloud'));
    (Array.isArray(localList)?localList:[]).forEach(p=>put(p,'local'));
    return out;
  }
  async function pullPatientsCloud(){
    try{
      if(!window.DCOS || !DCOS.Store) return;
      await DCOS.Store.init();
      await patientStore()?.ready;
      const local=window.getPatients();
      const cloud=await DCOS.Store.list('clinics/'+clinicId+'/patients');
      const merged=mergePatientCopies(local,cloud);
      patientStore()?.set?.(merged);
      await patientStore()?.flush?.();
      // Re-upload local-only/newer records after login; this makes offline saves self-healing.
      if(merged.length) scheduleCloudSync(cloud,merged);
    }catch(e){console.warn('patient cloud pull skipped',e)}
  }

  const Hybrid={session:null,clinic:null,account:null};
  window.DCOS_HYBRID=Hybrid;
  function session(){return jsonGet(SESSION_KEY,null)}
  function setSession(s){Hybrid.session=s;jsonSet(SESSION_KEY,s)}
  function clearSession(){Hybrid.session=null;localStorage.removeItem(SESSION_KEY)}
  function isSuper(){return Hybrid.account?.role==='super_owner'}
  function isManager(){return Hybrid.account?.role==='manager'}
  function isAssistant(){return Hybrid.account?.role==='assistant'}
  function isReception(){return Hybrid.account?.role==='reception'}
  function isDoctor(){return Hybrid.account?.role==='doctor'}
  function roleLabel(){return isSuper()?'Super Owner':isManager()?'مدير عيادة':isAssistant()?'مساعدة':isReception()?'الاستقبال':'طبيب'}

  // Compatibility globals expected by some clinic widgets.
  window.profile=function(){return Hybrid.account||{};};
  window.isOwner=function(){return isSuper()||isManager();};
  window.can=function(p){
    if(isSuper()||isManager()) return true;
    if(isReception()) return ['patients_add','payments_limited','appointments'].includes(p);
    if(isAssistant()) return !['prescriptions','reports','data','accounts','finance','clinicFinance','sync'].includes(p);
    return !['data','accounts','clinicFinance','sync'].includes(p);
  };
  window.requirePerm=function(p){ if(window.can(p))return true; alert('لا تملك صلاحية: '+p); return false; };
  window.openAccountsManager=function(){ location.href='dashboard.html?v=15_15'; };
  window.coreAccountsManager=window.openAccountsManager;

  async function getClinic(){
    let c=null;
    try{ if(window.DCOS){ await DCOS.Store.init(); c=await DCOS.getClinic(clinicId); } }catch(e){}
    if(!c){
      const arr=jsonGet('dcos_v15_network__clinics',[]);
      c=(Array.isArray(arr)?arr:[]).find(x=>safe(x.id)===clinicId)||null;
    }
    return c||{id:clinicId,name:clinicId==='taher-main-clinic'?'عيادة أ.د. طاهر الأجا':clinicId,city:'',phone:''};
  }
  async function findAccount(email){
    email=String(email||'').trim().toLowerCase();
    if(!email)return null;
    try{ if(window.DCOS){ await DCOS.Store.init(); return await DCOS.findAccount(email,clinicId); } }catch(e){console.warn(e)}
    const nid='dcos_v15_network__accounts__'+safe(email);
    const cid='dcos_v15_clinics__'+clinicId+'__accounts__'+safe(email);
    return jsonGet(nid,null)||jsonGet(cid,null);
  }
  async function saveSuperOwner(email,password,name){
    const acc={email:String(email).trim().toLowerCase(),password,name:name||'Super Owner',role:'super_owner',active:true,createdAt:now(),updatedAt:now()};
    if(window.DCOS){await DCOS.Store.init(); await DCOS.saveAccount(acc);} else jsonSet('dcos_v15_network__accounts__'+safe(acc.email),acc);
    return acc;
  }
  function showOverlay(msg=''){
    document.getElementById('hybridAuthOverlay')?.remove();
    const d=document.createElement('div'); d.id='hybridAuthOverlay';
    d.innerHTML=`<div class="hybrid-login-card"><h1>Dental Chain OS</h1><p>${esc(Hybrid.clinic?.name||clinicId)}</p>${msg?`<div class="hybrid-msg">${esc(msg)}</div>`:''}<input id="hybridEmail" type="email" placeholder="البريد الإلكتروني"><input id="hybridPass" type="password" placeholder="كلمة السر"><button id="hybridLoginBtn">دخول</button><button class="secondary" id="hybridRegisterBtn">➕ تسجيل حساب جديد</button><button class="secondary hidden" id="hybridOwnerBtn">تعيين Super Owner</button><small>تسجيل دخول آمن إلى نظام العيادة</small></div>`;
    document.body.appendChild(d);
    document.getElementById('hybridLoginBtn').onclick=login;
    document.getElementById('hybridRegisterBtn').onclick=openRegisterAccount;
    document.getElementById('hybridOwnerBtn').onclick=bootstrapOwner;
    document.getElementById('hybridPass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
    keepHidden();
  }
  function hideOverlay(){document.getElementById('hybridAuthOverlay')?.remove();document.documentElement.classList.remove('dcos-auth-pending');document.body.classList.remove('dcos-auth-pending');}
  function keepHidden(){document.documentElement.classList.add('dcos-auth-pending');document.body.classList.add('dcos-auth-pending');}
  async function login(){
    const email=document.getElementById('hybridEmail')?.value||'';
    const pass=document.getElementById('hybridPass')?.value||'';
    const acc=await findAccount(email);
    if(!acc || String(acc.password||'')!==String(pass||'')) return showOverlay('بيانات الدخول غير صحيحة أو الحساب غير موجود في هذه العيادة.');
    if(acc.active===false) return showOverlay('هذا الحساب موقوف.');
    if(acc.role!=='super_owner' && safe(acc.clinicId)!==clinicId) return showOverlay('هذا الحساب تابع لعيادة أخرى.');
    await openWithAccount(acc);
  }
  async function openWithAccount(acc){
    Hybrid.account=acc; setSession({email:acc.email,clinicId,at:now()});
    const stableRole=String(acc.role||'doctor').trim().toLowerCase();
    document.documentElement.setAttribute('data-dcos-role',stableRole);
    if(document.body) document.body.setAttribute('data-dcos-role',stableRole);
    await patientStore()?.ready;
    await pullPatientsCloud();
    hideOverlay();
    setDoctorFromAccount();
    installReceptionGuards();
    installStableRoleUiHooks();
    applyRoleUI();
    try{ if(typeof renderDashboard==='function') renderDashboard(); }catch(e){console.error(e)}
    document.dispatchEvent(new CustomEvent('dcos:account-ready',{detail:{account:Hybrid.account,clinic:Hybrid.clinic}}));
    setTimeout(()=>applyRoleUI(document),80);
  }
  function setDoctorFromAccount(){
    const d=Hybrid.account?.doctorName||Hybrid.account?.name||'';
    if(!d)return; localStorage.setItem('dcos_active_doctor',d);
    const el=document.getElementById('activeDoctor');
    if(el){ if(![...el.options].some(o=>o.value===d)){let opt=document.createElement('option');opt.value=d;opt.textContent=d;el.appendChild(opt)} el.value=d; if(!isSuper()&&!isManager()){el.disabled=true; const wrap=el.closest('.doctor-select-wrap')||el.parentElement; if(wrap){wrap.classList.add('dcos-locked-doctor'); wrap.setAttribute('data-doctor',d);}} }
  }
  function addTopBadge(){
    let b=document.getElementById('hybridRoleBadge'); if(!b){b=document.createElement('div');b.id='hybridRoleBadge';document.body.appendChild(b)}
    b.textContent=(Hybrid.account?roleLabel():'غير مسجل')+' · '+(Hybrid.clinic?.name||clinicId);
  }
  function isSyncElement(el){
    const t=(el.textContent||'').trim();
    const on=(el.getAttribute&&el.getAttribute('onclick')||'');
    const id=el.id||'';
    return id==='v9SyncFab' || t.includes('المزامنة') || t.includes('تحديث البيانات') || on.includes('openClinicV8SyncCenter') || on.includes('openSyncScreen') || on.includes('dcosV9');
  }
  function forceHide(el){el.classList.add('dcos-force-hidden');el.style.setProperty('display','none','important');}
  function forceShow(el){el.classList.remove('dcos-force-hidden');el.style.removeProperty('display');}
  function hasText(el, words){ const t=(el.textContent||'').trim(); const on=(el.getAttribute&&el.getAttribute('onclick')||''); const id=el.id||''; return words.some(x=>t.includes(x)||on.includes(x)||id.includes(x)); }
  function isMonthIncomeElement(el){
    const t=(el.textContent||'').trim(); const on=(el.getAttribute&&el.getAttribute('onclick')||'');
    return t.includes('مدخول الشهر') || on.includes('openClinicIncomeModal') || el.classList?.contains('income-open-card') || el.classList?.contains('clinic-income-stat');
  }
  function isBackupElement(el){
    const t=(el.textContent||'').trim(); const on=(el.getAttribute&&el.getAttribute('onclick')||'');
    return t.includes('نسخة احتياطية') || on.includes('exportBackup') || on.includes('importBackup');
  }
  function isDefaultRestoreElement(el){
    const t=(el.textContent||'').trim(); const on=(el.getAttribute&&el.getAttribute('onclick')||'');
    return t.includes('استرجاع الافتراضي') || on.includes('resetRxLibraries');
  }
  function roleShouldHide(el){
    const t=(el.textContent||'').trim();
    const adminOnly=['Data Manager','الداتا مانجر','إدارة الحسابات','الحسابات والصلاحيات','الصلاحيات','تقارير الأطباء','تقرير الأطباء','تقارير الطبيب','شبكة العيادات','إدارة الشبكة'];
    const noAssistant=['إنشاء وصفة','الوصفات','تقرير','التقارير','عداد المال','عدادات المال'];
    const noReception=['إنشاء وصفة','الوصفات','تسجيل زيارة','زيارة','خطة','المخطط','Dental Chart','وسائط','صور','تقارير','تقرير','Data Manager','الداتا مانجر','إدارة الحسابات','الحسابات والصلاحيات','الصلاحيات','دليل','الأدوية','إدارة الوصفات','طباعة','نسخة احتياطية'];

    if(isSyncElement(el) || isBackupElement(el) || isDefaultRestoreElement(el)) return true;
    if(isMonthIncomeElement(el) && !(isDoctor()||isSuper()||isManager())) return true;
    if(hasText(el,['مالية العيادة','فتح مالية العيادة','openClinicFinanceSidebar','toggleClinicFinanceSidebar']) && !(isSuper()||isManager())) return true;
    if(!(isSuper()||isManager()) && adminOnly.some(x=>t.includes(x))) return true;
    if(isDoctor() && t.includes('Data Manager')) return true;
    if(isAssistant() && noAssistant.some(x=>t.includes(x))) return true;
    if(isReception() && noReception.some(x=>t.includes(x))) return true;
    return false;
  }

  function applyRoleUI(root=document){
    addTopBadge();
    setDoctorFromAccount();

    const nodes=[];
    if(root && root.matches && root.matches('button,a')) nodes.push(root);
    if(root && root.querySelectorAll) nodes.push(...root.querySelectorAll('button,a'));

    nodes.forEach(el=>{
      const shouldHide=roleShouldHide(el);
      if(shouldHide){
        el.dataset.dcosRoleHidden='1';
        forceHide(el);
      }else if(el.dataset.dcosRoleHidden==='1'){
        delete el.dataset.dcosRoleHidden;
        forceShow(el);
      }
    });

    const fab=document.getElementById('v9SyncFab');
    if(fab) forceHide(fab);

    const financeSidebar=document.getElementById('clinicFinanceSidebar');
    if(financeSidebar && !(isSuper()||isManager())) financeSidebar.classList.add('collapsed');

    const doctorSelect=document.getElementById('activeDoctor');
    if(doctorSelect && !isSuper() && !isManager()) doctorSelect.disabled=true;
  }

  let stableRoleHooksInstalled=false;
  let roleUiTimer=0;
  function scheduleRoleUI(delay=0){
    clearTimeout(roleUiTimer);
    roleUiTimer=setTimeout(()=>applyRoleUI(document),delay);
  }
  function installStableRoleUiHooks(){
    if(stableRoleHooksInstalled) return;
    stableRoleHooksInstalled=true;

    // Low-frequency, event-driven refresh only. No DOM observer and no loop.
    document.addEventListener('click',e=>{
      if(e.target && e.target.closest && e.target.closest('button,a')){
        scheduleRoleUI(0);
        setTimeout(()=>scheduleRoleUI(0),120);
      }
    },true);
    window.addEventListener('popstate',()=>scheduleRoleUI(0));
    window.addEventListener('hashchange',()=>scheduleRoleUI(0));
    document.addEventListener('dcos:view-changed',()=>scheduleRoleUI(0));
  }

  const __oldBackToHome=window.backToHome;
  window.backToHome=function(){
    let r;
    try{ if(typeof __oldBackToHome==='function') r=__oldBackToHome.apply(this,arguments); }
    finally{ scheduleRoleUI(0); }
    return r;
  };
  window.logout=function(){clearSession();location.reload()};
  function addLogout(){
    if(document.getElementById('hybridLogoutBtn'))return;
    const btn=document.createElement('button');btn.id='hybridLogoutBtn';btn.textContent='خروج';btn.onclick=window.logout;document.body.appendChild(btn);
  }
  function openRegisterAccount(){
    const code=prompt('كلمة سر إنشاء الحسابات:');
    if(code!==ADMIN_PASS) return alert('كلمة السر غير صحيحة');
    document.getElementById('hybridAuthOverlay')?.remove();
    const d=document.createElement('div'); d.id='hybridAuthOverlay';
    d.innerHTML=`<div class="hybrid-login-card"><h1>تسجيل حساب جديد</h1><p>${esc(Hybrid.clinic?.name||clinicId)}</p><input id="regEmail" type="email" placeholder="البريد الإلكتروني"><input id="regPass" type="text" placeholder="كلمة السر"><input id="regName" placeholder="اسم المستخدم/الطبيب"><select id="regRole"><option value="doctor">طبيب</option><option value="assistant">مساعدة</option><option value="reception">الاستقبال</option><option value="manager">مدير عيادة</option></select><button id="regSaveBtn">حفظ الحساب</button><button class="secondary" id="regBackBtn">رجوع لتسجيل الدخول</button><small>سيُربط الحساب بهذه العيادة فقط</small></div>`;
    document.body.appendChild(d);
    document.getElementById('regBackBtn').onclick=()=>showOverlay();
    document.getElementById('regSaveBtn').onclick=saveRegisteredAccount;
    keepHidden();
  }
  async function saveRegisteredAccount(){
    try{
      const acc={
        email:String(document.getElementById('regEmail')?.value||'').trim().toLowerCase(),
        password:String(document.getElementById('regPass')?.value||''),
        name:String(document.getElementById('regName')?.value||''),
        role:String(document.getElementById('regRole')?.value||'doctor'),
        clinicId, active:true, createdAt:now(), updatedAt:now()
      };
      if(!acc.email||!acc.password) return alert('أدخل البريد وكلمة السر');
      if(window.DCOS){ await DCOS.Store.init(); await DCOS.saveAccount(acc); await DCOS.Audit.log(clinicId,'register_clinic_account',acc.email,acc); }
      else jsonSet('dcos_v15_clinics__'+clinicId+'__accounts__'+safe(acc.email),acc);
      alert('تم إنشاء الحساب. سجّل الدخول الآن.');
      showOverlay();
    }catch(e){console.error(e);alert('تمت المحاولة، لكن حدث خطأ أثناء حفظ الحساب: '+(e.message||e));}
  }
  async function bootstrapOwner(){
    const code=prompt('كلمة سر الإدارة:'); if(code!==ADMIN_PASS)return alert('كلمة السر غير صحيحة');
    const email=prompt('بريد Super Owner:'); if(!email)return;
    const pass=prompt('كلمة السر للحساب:'); if(!pass)return;
    const name=prompt('الاسم:','Super Owner')||'Super Owner';
    const acc=await saveSuperOwner(email,pass,name); alert('تم إنشاء/تحديث Super Owner. سجّل الدخول الآن.'); showOverlay();
  }
  function activePatientByFileNo(fileNo){
    const arr=window.getPatients?window.getPatients():[];
    return arr.find(p=>String(p.fileNo||p.fileNumber||p.id||'')===String(fileNo||''))||null;
  }
  function patientBalance(p){
    const fin=p.finance||{};
    const pays=(Array.isArray(fin.payments)&&fin.payments.length)?fin.payments:(p.payments||[]);
    const charges=(Array.isArray(fin.charges)&&fin.charges.length)?fin.charges:(p.charges||[]);
    const out={
      SYP:{total:0,payments:0,paid:0,remain:0,credit:0},
      USD:{total:0,payments:0,paid:0,remain:0,credit:0}
    };
    const currencyOf=v=>String(v||'SYP').toUpperCase()==='USD'?'USD':'SYP';
    const amountOf=v=>Math.abs(Number(v||0));
    charges.forEach(x=>out[currencyOf(x.currency)].total+=amountOf(x.amount??x.cost??x.price));
    if(!charges.length){
      out.SYP.total+=amountOf(p.totalCost);
      (p.treatmentPlan||p.plans||[]).forEach(x=>{
        out[currencyOf(x.currency)].total+=amountOf(x.cost??x.price??x.amount);
      });
    }
    pays.forEach(x=>out[currencyOf(x.currency)].payments+=amountOf(x.amount));
    Object.values(out).forEach(t=>{
      t.paid=Math.min(t.total,t.payments);
      t.remain=Math.max(t.total-t.payments,0);
      t.credit=Math.max(t.payments-t.total,0);
    });
    return out;
  }
  function openReceptionPatientPanel(p){
    if(!p)return;
    const bal=patientBalance(p);
    const money=(value,currency)=>currency==='USD'
      ? '$ '+Number(value||0).toLocaleString('en-US')
      : Number(value||0).toLocaleString('en-US')+' ل.س';
    const currencyCard=(currency,label)=>`
      <section class="dcos-reception-currency-card">
        <h3>${label}</h3>
        <div class="dcos-reception-fin-grid">
          <div><small>المطلوب</small><b>${money(bal[currency].total,currency)}</b></div>
          <div><small>المقبوض الفعلي</small><b>${money(bal[currency].paid,currency)}</b></div>
          <div><small>المتبقي</small><b>${money(bal[currency].remain,currency)}</b></div>
          ${bal[currency].credit?`<div class="credit"><small>رصيد للمريض</small><b>${money(bal[currency].credit,currency)}</b></div>`:''}
        </div>
      </section>`;
    const out=document.getElementById('output');
    if(out) out.innerHTML=`<div class="card reception-panel dcos-reception-finance-panel">
      <div class="space">
        <div><h2>خدمة المريض - ${esc(p.name||'مريض')}</h2><p class="muted">متابعة الرصيد وإضافة دفعة بالليرة السورية أو الدولار.</p></div>
        <span class="pill">${esc(p.fileNo||p.fileNumber||p.id||'')}</span>
      </div>
      <div class="dcos-reception-currencies">${currencyCard('SYP','الليرة السورية')}${currencyCard('USD','الدولار الأمريكي')}</div>
      <div class="visit-payment-box dcos-reception-payment-form">
        <label>إضافة دفعة</label>
        <div class="dcos-payment-line">
          <input id="receptionPayAmount" inputmode="decimal" type="number" min="0" step="any" placeholder="المبلغ">
          <select id="receptionPayCurrency"><option value="SYP">ل.س</option><option value="USD">$ دولار</option></select>
        </div>
        <input id="receptionPayNote" placeholder="ملاحظة اختيارية">
        <div class="row"><button onclick="DCOS_HYBRID.saveReceptionPayment('${esc(p.fileNo||p.id||'')}')">حفظ الدفعة</button><button onclick="backToHome()">رجوع</button></div>
      </div>
    </div>`;
    document.getElementById('backBtn')?.style?.setProperty('display','inline-block');
  }
  Hybrid.saveReceptionPayment=function(fileNo){
    const arr=window.getPatients?window.getPatients():[];
    const idx=arr.findIndex(p=>String(p.fileNo||p.fileNumber||p.id||'')===String(fileNo||''));
    if(idx<0)return alert('لم أجد المريض');
    const amount=Number(document.getElementById('receptionPayAmount')?.value||0);
    if(!amount)return alert('أدخل مبلغ الدفعة');
    const currency=document.getElementById('receptionPayCurrency')?.value||'SYP';
    const note=document.getElementById('receptionPayNote')?.value||'دفعة من الاستقبال';
    const row={amount,currency,note,date:now(),doctor:Hybrid.account?.name||'الاستقبال',by:Hybrid.account?.email||'',source:'reception'};
    arr[idx].finance=arr[idx].finance||{};
    arr[idx].finance.payments=arr[idx].finance.payments||[];
    row.id=row.id||('pay_'+Date.now()+'_'+Math.random().toString(16).slice(2));
    arr[idx].finance.payments.push(row);
    // finance.payments is the single source of truth. Do not mirror the same row in patient.payments.
    if(Array.isArray(arr[idx].payments)){
      const canonical=new Set(arr[idx].finance.payments.map(x=>String(x.id||[x.amount,x.currency,x.date,x.note||x.label||''].join('|'))));
      arr[idx].payments=arr[idx].payments.filter(x=>!canonical.has(String(x.id||[x.amount,x.currency,x.date,x.note||x.label||''].join('|'))));
    }
    window.savePatients(arr); alert('تم حفظ الدفعة'); openReceptionPatientPanel(arr[idx]);
  };
  function installReceptionGuards(){
    if(window.__dcosReceptionGuardsInstalled) return; window.__dcosReceptionGuardsInstalled=true;
    const oldOpenPatient=window.openPatient;
    if(typeof oldOpenPatient==='function') window.openPatient=function(p){ if(isReception()) return openReceptionPatientPanel(p); return oldOpenPatient.apply(this,arguments); };
    const oldRegister=window.registerPatient;
    if(typeof oldRegister==='function') window.registerPatient=function(){
      const before=(window.getPatients?window.getPatients():[]).length;
      const r=oldRegister.apply(this,arguments);
      if(isReception()){
        setTimeout(()=>{ try{ backToHome(); alert('تم تسجيل المريض بنجاح.'); }catch(e){} },80);
      }
      return r;
    };
    const oldClinicFin=window.toggleClinicFinanceSidebar;
    if(typeof oldClinicFin==='function') window.toggleClinicFinanceSidebar=function(){ if(!(isSuper()||isManager())) return alert('مالية العيادة متاحة فقط لمدير العيادة والسوبر أونر'); return oldClinicFin.apply(this,arguments); };
    const oldOpenClinicIncome=window.openClinicIncomeModal;
    if(typeof oldOpenClinicIncome==='function') window.openClinicIncomeModal=function(){
      if(isDoctor() && window.DCOS_DOCTOR_FINANCE && typeof window.DCOS_DOCTOR_FINANCE.open==='function') return window.DCOS_DOCTOR_FINANCE.open();
      if(isSuper()||isManager()) return oldOpenClinicIncome.apply(this,arguments);
      return alert('المالية متاحة للطبيب ضمن ملفه المالي، وللمدير والسوبر أونر على مستوى العيادة.');
    };
    const oldGetDoctor=window.getActiveDoctor;
    if(typeof oldGetDoctor==='function') window.getActiveDoctor=function(){
      if(Hybrid.account && !(isSuper()||isManager())) return Hybrid.account.doctorName||Hybrid.account.name||oldGetDoctor.apply(this,arguments)||'';
      return oldGetDoctor.apply(this,arguments);
    };
  }
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.altKey&&String(e.key).toLowerCase()==='o'){
      e.preventDefault(); const b=document.getElementById('hybridOwnerBtn'); if(b){b.classList.toggle('hidden'); alert(b.classList.contains('hidden')?'تم إخفاء زر Super Owner':'تم عرض زر Super Owner');} else bootstrapOwner();
    }
    if(e.ctrlKey&&e.altKey&&String(e.key).toLowerCase()==='d'){
      e.preventDefault(); if(window.DCOS_openErrorLog) DCOS_openErrorLog(); else alert('لا يوجد سجل أخطاء v15 محمّل.');
    }
    if(e.ctrlKey&&e.altKey&&String(e.key).toLowerCase()==='l'){
      e.preventDefault();
      const code=prompt('كلمة سر استرجاع الافتراضي للوصفات:');
      if(code!==ADMIN_PASS) return alert('كلمة السر غير صحيحة');
      if(typeof resetRxLibraries==='function') resetRxLibraries(true); else alert('لم أجد أداة استرجاع الافتراضي.');
      setTimeout(applyRoleUI,300);
      return;
    }
    if(e.ctrlKey&&e.altKey&&String(e.key).toLowerCase()==='r'){
      e.preventDefault();
      alert('الحفظ السحابي الفوري مفعّل تلقائيًا. لا حاجة للمزامنة اليدوية.');
    }
  });
  async function boot(){
    Hybrid.clinic=await getClinic();
    addLogout(); addTopBadge(); installStableRoleUiHooks();
    const s=session();
    if(s && s.email && safe(s.clinicId)===clinicId){
      const acc=await findAccount(s.email);
      if(acc) return openWithAccount(acc);
    }
    showOverlay();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true}); else setTimeout(boot,0);
})();
