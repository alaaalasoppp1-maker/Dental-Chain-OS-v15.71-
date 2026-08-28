'use strict';
/* v15.17 — clinic identity, doctor ownership visibility, manager tools */
(function(){
  const H=()=>window.DCOS_HYBRID||{};
  const account=()=>H().account||{};
  const role=()=>String(account().role||'');
  const isAdmin=()=>role()==='super_owner'||role()==='manager';
  const arr=x=>Array.isArray(x)?x:[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const patientId=p=>String(p?.id||p?.fileNo||p?.fileNumber||p?.name||'');
  const clinicName=()=>{
    const params=new URLSearchParams(location.search);
    const id=String(H().clinic?.id||params.get('clinic')||'').trim();
    const exact=String(H().clinic?.name||'').trim();
    const cached=String(localStorage.getItem('dcos_v15_clinic_name_'+id)||'').trim();
    const invalid=v=>!v||v==='العيادة'||v==='عيادة العيادة'||v===id||/^clinic[_-]/i.test(v);
    if(!invalid(exact)) return exact;
    if(!invalid(cached)) return cached;
    return 'عيادة د. طاهر الأجا';
  };
  const clinicSystemTitle=()=>{const n=clinicName();return /^عيادة\s/.test(n)?'نظام '+n:'نظام عيادة '+n;};

  function applyTitles(){
    document.querySelectorAll('.brand-topbar h2').forEach(el=>{el.textContent='نظام إدارة عيادات د. طاهر';});
    document.querySelectorAll('.hero-content h1,.hero-card h1,.dashboard-hero h1').forEach(el=>{el.textContent=clinicSystemTitle();});
  }

  function addAdminTools(){
    document.querySelectorAll('.dcos-v1517-admin-tools').forEach(el=>el.remove());
    const quick=document.querySelector('.quick-actions');
    if(!quick)return;

    if(!isAdmin()){
      quick.querySelectorAll('.dcos-data-manager-btn,.dcos-v1518-local-images-btn').forEach(el=>el.remove());
      [...quick.querySelectorAll('button')]
        .filter(b=>(b.textContent||'').includes('Data Manager'))
        .forEach(el=>el.remove());
      return;
    }

    const dataButtons=[...quick.querySelectorAll('.dcos-data-manager-btn,button')]
      .filter(b=>(b.textContent||'').includes('Data Manager'));
    dataButtons.slice(1).forEach(b=>b.remove());

    if(!quick.querySelector('.dcos-v1518-local-images-btn')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='dcos-v1518-local-images-btn';
      btn.textContent='🖼 تحديد مكان حفظ الصور';
      btn.onclick=()=>{if(typeof window.dcosChooseImagesFolder==='function')window.dcosChooseImagesFolder();else alert('ميزة Local Images غير جاهزة على هذا الجهاز.');};
      quick.appendChild(btn);
    }
  }

  function currentPatient(){return window.patient||null;}
  function doctorDisplay(p){return p?.primaryDoctorName||p?.assignedDoctorName||'لم يُحدد بعد';}
  function canTransfer(){return ['doctor','manager','super_owner'].includes(role());}

  function ensureDoctorCard(){
    // v15.21: one canonical doctor control lives inside .profile-header.
    // Remove all older standalone ownership sections created by previous modules.
    document.querySelectorAll('.dcos-v1517-doctor-owner,.dcos-patient-doctor-card').forEach(el=>el.remove());
  }

  function labelHistoricalRows(){
    const p=currentPatient(); if(!p)return;
    const plans=arr(p.treatmentPlans||p.treatmentPlan||p.plans);
    document.querySelectorAll('.treatment-plan-card').forEach((el,i)=>{
      if(el.querySelector('.dcos-v1517-row-doctor'))return;
      const r=plans[i]||{};const name=r.doctorName||r.doctor||r.performedBy||'';
      if(name)el.insertAdjacentHTML('beforeend','<small class="dcos-v1517-row-doctor">👨‍⚕️ منفذ الإجراء: '+esc(name)+'</small>');
    });
    const fin=p.finance||{};const rows=[...arr(fin.charges),...arr(fin.payments)];
    document.querySelectorAll('.finance-row').forEach((el,i)=>{
      if(el.querySelector('.dcos-v1517-row-doctor'))return;
      const r=rows[i]||{};const name=r.doctorName||r.doctor||r.performedBy||'';
      if(name)el.insertAdjacentHTML('beforeend','<small class="dcos-v1517-row-doctor">👨‍⚕️ الطبيب المرتبط: '+esc(name)+'</small>');
    });
  }

  function annotatePatientCards(){
    const patients=window.getPatients?window.getPatients():[];
    document.querySelectorAll('[data-patient-id],.patient-card,.patient-list-card').forEach(card=>{
      if(card.querySelector('.dcos-v1517-card-doctor'))return;
      const txt=(card.textContent||'').trim();
      const p=patients.find(x=>txt.includes(String(x.name||'')) && x.name);
      if(!p)return;
      card.insertAdjacentHTML('beforeend','<small class="dcos-v1517-card-doctor">👨‍⚕️ '+esc(doctorDisplay(p))+'</small>');
    });
  }

  function refresh(){applyTitles();addAdminTools();ensureDoctorCard();labelHistoricalRows();annotatePatientCards();}
  function boot(){
    refresh();
    document.addEventListener('dcos:clinic-ready',refresh);
    document.addEventListener('dcos:view-changed',()=>{
      applyTitles();
      addAdminTools();
      ensureDoctorCard();
      labelHistoricalRows();
      annotatePatientCards();
    });
    setTimeout(refresh,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
