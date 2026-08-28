'use strict';
/* v15.25 — clinic name recovery + compact mobile UX + reception appointment patient picker */
(function(){
  const H=()=>window.DCOS_HYBRID||{};
  const params=new URLSearchParams(location.search);
  const rawClinicId=String(params.get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'').trim();
  const badName=v=>{const s=String(v||'').trim();return !s||s===rawClinicId||/^clinic[_-]/i.test(s)||/^branch[_-]/i.test(s)||/^id[_-]/i.test(s)};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function localClinicCandidates(){
    const out=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i)||'';
      if(!/clinic|network/i.test(key))continue;
      try{
        const value=JSON.parse(localStorage.getItem(key));
        if(Array.isArray(value))out.push(...value);
        else if(value&&typeof value==='object')out.push(value);
      }catch(e){}
    }
    return out;
  }

  async function resolveClinic(){
    let current=H().clinic||null;
    if(current&&!badName(current.name))return current;
    let found=null;
    try{
      if(window.DCOS?.Store){
        await DCOS.Store.init();
        found=await DCOS.Store.get('network/clinics/'+DCOS.safeId(rawClinicId),null);
        if(!found||badName(found.name)){
          const all=await DCOS.Store.list('network/clinics');
          found=(all||[]).find(c=>String(c.id||'')===rawClinicId)||found;
        }
      }
    }catch(e){console.warn('clinic name resolve',e)}
    if(!found||badName(found.name)){
      found=localClinicCandidates().find(c=>String(c?.id||c?.clinicId||'')===rawClinicId&&!badName(c?.name))||found;
    }
    if(found&&!badName(found.name)){
      H().clinic={...(H().clinic||{}),...found,id:rawClinicId};
      try{localStorage.setItem('dcos_current_clinic_name',found.name)}catch(e){}
      return H().clinic;
    }
    const cached=localStorage.getItem('dcos_current_clinic_name');
    if(cached&&!badName(cached)){
      H().clinic={...(H().clinic||{}),id:rawClinicId,name:cached};
      return H().clinic;
    }
    return H().clinic||{id:rawClinicId,name:'العيادة'};
  }

  function cleanClinicTitle(name){
    name=String(name||'العيادة').trim();
    if(/^نظام\s+عيادة/.test(name))return name;
    if(/^عيادة\s+/.test(name))return 'نظام '+name;
    return 'نظام عيادة '+name;
  }

  function applyClinicName(){
    const c=H().clinic||{};
    const name=badName(c.name)?'العيادة':c.name;
    document.querySelectorAll('.dashboard-hero h1,.pro-hero h1,.hero-content h1').forEach(el=>el.textContent=cleanClinicTitle(name));
    document.querySelectorAll('.dcos-reception-hero h2').forEach(el=>el.textContent=name);
    const badge=document.getElementById('hybridRoleBadge');
    if(badge&&badge.textContent){
      const role=(badge.textContent.split('·')[0]||'').trim();
      badge.textContent=role+' · '+name;
    }
  }

  function installPatientSearch(modal){
    if(!modal||modal.querySelector('#slotPatientSearch'))return;
    const select=modal.querySelector('#slotPatientFileNo');
    if(!select)return;
    const label=select.previousElementSibling;
    if(label&&label.tagName==='LABEL')label.textContent='المريض';
    const input=document.createElement('input');
    input.id='slotPatientSearch';
    input.type='search';
    input.autocomplete='off';
    input.placeholder='ابحث باسم المريض أو رقم الملف أو الهاتف';
    input.setAttribute('aria-label','بحث عن المريض');
    select.parentNode.insertBefore(input,select);
    const options=[...select.options].map(o=>({value:o.value,text:o.textContent,selected:o.selected}));
    input.addEventListener('input',()=>{
      const q=input.value.trim().toLowerCase();
      const selected=select.value;
      select.innerHTML='';
      options.filter((o,i)=>i===0||!q||o.text.toLowerCase().includes(q)).forEach(o=>{
        const opt=document.createElement('option');opt.value=o.value;opt.textContent=o.text;opt.selected=o.value===selected;select.appendChild(opt);
      });
      if(selected&&[...select.options].some(o=>o.value===selected))select.value=selected;
    });
    if((H().account||{}).role==='reception'){
      const hint=document.createElement('small');
      hint.className='dcos-appointment-patient-hint';
      hint.textContent='اختر المريض أولًا، ثم أكمل نوع الموعد والملاحظات.';
      select.insertAdjacentElement('afterend',hint);
    }
  }

  function wrapAppointmentModal(){
    const original=window.openAppointmentSlotModal;
    if(typeof original!=='function'||original.__dcos1525)return;
    function wrapped(){
      const result=original.apply(this,arguments);
      setTimeout(()=>installPatientSearch(document.getElementById('appointmentSlotModal')),0);
      return result;
    }
    wrapped.__dcos1525=true;
    window.openAppointmentSlotModal=wrapped;
  }

  function enhanceExistingModal(){installPatientSearch(document.getElementById('appointmentSlotModal'))}

  async function refresh(){await resolveClinic();applyClinicName();wrapAppointmentModal();enhanceExistingModal()}
  let t;
  const obs=new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{applyClinicName();wrapAppointmentModal();enhanceExistingModal()},240)});
  function boot(){refresh();try{obs.observe(document.body,{childList:true,subtree:true})}catch(e){}setTimeout(refresh,500);setTimeout(refresh,1600)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
