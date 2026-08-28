'use strict';
(function(){
  const H=()=>window.DCOS_HYBRID||{};
  const params=new URLSearchParams(location.search);
  const clinicId=String(params.get('clinic')||H().clinic?.id||localStorage.getItem('dcos_v15_last_clinic')||'').trim();
  const bad=v=>{const s=String(v||'').trim();return !s||s===clinicId||s==='العيادة'||s==='عيادة العيادة'||/^clinic[_-]/i.test(s)||/^branch[_-]/i.test(s)};
  let clinicName='';
  async function resolveClinicName(){
    const current=H().clinic?.name;
    if(!bad(current))clinicName=current;
    if(!clinicName){const c=localStorage.getItem('dcos_v15_clinic_name_'+clinicId)||localStorage.getItem('dcos_current_clinic_name');if(!bad(c))clinicName=c}
    try{
      if(!clinicName&&window.DCOS?.Store){await DCOS.Store.init();let c=await DCOS.Store.get('network/clinics/'+DCOS.safeId(clinicId),null);if(!c||bad(c.name)){const all=await DCOS.Store.list('network/clinics');c=(all||[]).find(x=>String(x.id||'')===clinicId)||c}if(c&&!bad(c.name))clinicName=c.name}
    }catch(e){console.warn('v15.51 clinic name',e)}
    if(clinicName){H().clinic={...(H().clinic||{}),id:clinicId,name:clinicName};localStorage.setItem('dcos_v15_clinic_name_'+clinicId,clinicName);localStorage.setItem('dcos_current_clinic_name',clinicName)}
    return clinicName;
  }
  function systemTitle(n){n=String(n||'').trim();return /^عيادة\s/.test(n)?'نظام '+n:'نظام عيادة '+n}
  function applyClinicName(){if(!clinicName)return;document.querySelectorAll('.hybrid-login-card>p').forEach(el=>el.textContent=clinicName);document.querySelectorAll('.dashboard-hero h1,.pro-hero h1,.hero-content h1,.hero-card h1').forEach(el=>el.textContent=systemTitle(clinicName));const b=document.getElementById('hybridRoleBadge');if(b&&b.textContent){const role=(b.textContent.split('·')[0]||'').trim();b.textContent=role+' · '+clinicName}}
  function phoneKeyboards(){document.querySelectorAll('input[id*="phone" i],input[name*="phone" i],input[placeholder*="هاتف"],input[placeholder*="الهاتف"]').forEach(el=>{el.type='tel';el.inputMode='numeric';el.setAttribute('pattern','[0-9+ ]*');el.autocomplete='tel'})}
  function arrangePatientActions(){
    const actions=document.querySelector('#output .patient-profile-card .profile-actions');
    if(!actions)return;
    const directButtons=[...actions.children].filter(el=>el.tagName==='BUTTON');
    const find=t=>directButtons.find(b=>(b.textContent||'').includes(t));
    const rx=find('وصفة'),visit=find('زيارة'),appt=find('موعد'),plan=find('خطة علاج');
    const lab=directButtons.find(b=>b.classList.contains('dcos-lab-request-btn'));
    const finance=find('كشف مالي'),report=find('تقرير المريض'),edit=find('تعديل'),del=find('حذف');
    [finance,report,edit,del].forEach((b,i)=>{if(b)b.classList.add(['dcos-action-finance','dcos-action-report','dcos-action-edit','dcos-action-delete'][i])});
    const wanted=[rx,visit,appt,plan,lab,finance,report,edit,del].filter(Boolean);
    const current=directButtons.filter(b=>wanted.includes(b));
    const alreadyOrdered=current.length===wanted.length && current.every((b,i)=>b===wanted[i]);
    if(alreadyOrdered)return;
    const fragment=document.createDocumentFragment();
    wanted.forEach(b=>fragment.appendChild(b));
    actions.appendChild(fragment);
  }
  function moveLabButton(){
    const actions=document.querySelector('#output .patient-profile-card .profile-actions');
    const btn=document.querySelector('#output .patient-profile-card .dcos-lab-request-btn');
    if(actions&&btn&&btn.parentElement!==actions)actions.appendChild(btn);
    arrangePatientActions();
  }
  function polishDoctor(){const btn=document.querySelector('#output .dcos-patient-doctor-profile-btn');if(btn){btn.setAttribute('aria-label','الطبيب المسؤول');btn.title='عرض الطبيب المسؤول أو تغييره'}}
  function refreshUi(){phoneKeyboards();applyClinicName();moveLabButton();polishDoctor()}
  async function boot(){await resolveClinicName();refreshUi();setTimeout(refreshUi,300);setTimeout(refreshUi,1200);document.addEventListener('dcos:view-changed',()=>setTimeout(refreshUi,0));document.addEventListener('dcos:account-ready',()=>setTimeout(refreshUi,0))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  let queued=false;
  const root=document.getElementById('output')||document.body;
  const uiObserver=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;refreshUi()});
  });
  uiObserver.observe(root,{childList:true,subtree:true});
})();
