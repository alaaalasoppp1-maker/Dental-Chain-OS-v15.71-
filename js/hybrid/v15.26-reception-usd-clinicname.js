'use strict';
/* v15.26 — canonical reception payments, appointment patient browser, reliable clinic identity */
(function(){
  const H=()=>window.DCOS_HYBRID||{};
  const role=()=>String(H().account?.role||'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const params=new URLSearchParams(location.search);
  const clinicId=String(params.get('clinic')||H().clinic?.id||localStorage.getItem('dcos_v15_last_clinic')||'').trim();
  const badName=v=>{const s=String(v||'').trim();return !s||s===clinicId||/^clinic[_-]/i.test(s)||/^branch[_-]/i.test(s)||s==='العيادة'||s==='عيادة العيادة'};

  async function resolveExactClinic(){
    let c=H().clinic||null;
    if(c&&!badName(c.name))return c;
    try{
      if(window.DCOS?.Store){
        await DCOS.Store.init();
        c=await DCOS.getClinic(clinicId);
        if(!c||badName(c.name)){
          const all=await DCOS.getClinics();
          c=(all||[]).find(x=>String(x.id||'')===clinicId)||c;
        }
      }
    }catch(e){console.warn('v15.26 clinic lookup failed',e)}
    if(c&&!badName(c.name)){
      H().clinic={...(H().clinic||{}),...c,id:clinicId};
      try{localStorage.setItem('dcos_v15_clinic_name_'+clinicId,c.name)}catch(e){}
      return H().clinic;
    }
    const cached=localStorage.getItem('dcos_v15_clinic_name_'+clinicId)||localStorage.getItem('dcos_current_clinic_name');
    if(cached&&!badName(cached)){
      H().clinic={...(H().clinic||{}),id:clinicId,name:cached};
      return H().clinic;
    }
    return H().clinic||{id:clinicId,name:'العيادة'};
  }
  function clinicTitle(name){
    name=String(name||'').trim();
    if(!name||name==='العيادة')return 'نظام العيادة';
    if(/^نظام\s+/.test(name))return name;
    if(/^عيادة\s+/.test(name))return 'نظام '+name;
    return 'نظام عيادة '+name;
  }
  async function applyClinicIdentity(){
    const c=await resolveExactClinic();
    if(c&&!badName(c.name)){
      H().clinic={...(H().clinic||{}),...c,id:clinicId};
      try{localStorage.setItem('dcos_v15_clinic_name_'+clinicId,c.name)}catch(e){}
      document.dispatchEvent(new CustomEvent('dcos:clinic-ready',{detail:{clinic:H().clinic}}));
    }
  }

  function patientRows(){
    const patients=typeof window.getPatients==='function'?window.getPatients():[];
    return (patients||[]).map(p=>`<button type="button" class="dcos-appt-patient-row" data-file="${esc(p.fileNo||p.fileNumber||p.id||'')}"><span><b>${esc(p.name||'بدون اسم')}</b><small>${esc(p.fileNo||p.fileNumber||'')} · ${esc(p.phone||'')}</small></span><em>اختيار للموعد</em></button>`).join('');
  }
  function installReceptionPatientBrowser(){
    if(role()!=='reception')return;
    const manager=document.querySelector('.appointments-manager');
    if(!manager||manager.querySelector('#dcosApptPatientBrowser'))return;
    const browser=document.createElement('section');
    browser.id='dcosApptPatientBrowser';
    browser.className='dcos-appt-patient-browser';
    browser.innerHTML=`<div class="dcos-appt-patient-head"><div><h3>المرضى المسجلون</h3><p>اختر المريض ثم اختر الساعة المناسبة من جدول المواعيد.</p></div><input id="dcosApptPatientFilter" type="search" placeholder="بحث بالاسم أو رقم الملف أو الهاتف"></div><div id="dcosApptPatientRows">${patientRows()||'<p>لا يوجد مرضى مسجلون.</p>'}</div>`;
    const week=manager.querySelector('.week-rail-wrap,.v4-week-rail');
    manager.insertBefore(browser,week||manager.children[1]||null);
    const filter=browser.querySelector('#dcosApptPatientFilter');
    filter?.addEventListener('input',()=>{const q=filter.value.trim().toLowerCase();browser.querySelectorAll('.dcos-appt-patient-row').forEach(r=>r.style.display=!q||r.textContent.toLowerCase().includes(q)?'flex':'none');});
    browser.addEventListener('click',e=>{
      const row=e.target.closest('.dcos-appt-patient-row');if(!row)return;
      const file=row.dataset.file;
      const p=(window.getPatients?.()||[]).find(x=>String(x.fileNo||x.fileNumber||x.id||'')===String(file));
      if(!p)return;
      window.patient=p;
      browser.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));row.classList.add('selected');
      row.querySelector('em').textContent='تم الاختيار';
      document.querySelector('.day-wheel-card,.v4-day-wheel')?.scrollIntoView({behavior:'smooth',block:'start'});
      window.DCOS?.toast?.('تم اختيار '+(p.name||'المريض')+'؛ اختر وقت الموعد.');
    });
  }
  function wrapAppointments(){
    const old=window.openAppointmentsManager;
    if(typeof old!=='function'||old.__dcos1526)return;
    function wrapped(){const r=old.apply(this,arguments);setTimeout(installReceptionPatientBrowser,0);return r;}
    wrapped.__dcos1526=true;window.openAppointmentsManager=wrapped;
  }
  function selectCurrentInModal(){
    if(role()!=='reception'||!window.patient)return;
    const sel=document.getElementById('slotPatientFileNo');if(!sel)return;
    const file=String(window.patient.fileNo||window.patient.fileNumber||window.patient.id||'');
    if([...sel.options].some(o=>o.value===file))sel.value=file;
  }
  function wrapSlotModal(){
    const old=window.openAppointmentSlotModal;
    if(typeof old!=='function'||old.__dcos1526)return;
    function wrapped(){const r=old.apply(this,arguments);setTimeout(selectCurrentInModal,0);return r;}
    wrapped.__dcos1526=true;window.openAppointmentSlotModal=wrapped;
  }

  function boot(){
    applyClinicIdentity();
    wrapAppointments();
    wrapSlotModal();
    installReceptionPatientBrowser();

    document.addEventListener('dcos:view-changed',()=>{
      wrapAppointments();
      wrapSlotModal();
      installReceptionPatientBrowser();
      selectCurrentInModal();
    });

    setTimeout(applyClinicIdentity,600);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
