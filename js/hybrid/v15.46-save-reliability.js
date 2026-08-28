'use strict';
/* v15.46 — local-first save reliability and visible save feedback. */
(function(){
  const H=()=>window.DCOS_HYBRID||{};
  const clinicId=()=>String(H().clinic?.id||new URLSearchParams(location.search).get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic').replace(/[^a-zA-Z0-9_-]/g,'_');
  const stateKey=()=>`dcos_v1546_save_state_${clinicId()}`;
  const now=()=>new Date().toISOString();
  function setState(status,message,error=''){
    const value={status,message,error,at:now()};
    try{localStorage.setItem(stateKey(),JSON.stringify(value));}catch(e){}
    render(value);
    document.dispatchEvent(new CustomEvent('dcos:save-state',{detail:value}));
  }
  function render(value){
    if(!document.body)return;
    let el=document.getElementById('dcosSaveIndicator');
    if(!el){el=document.createElement('div');el.id='dcosSaveIndicator';el.className='dcos-save-indicator';document.body.appendChild(el)}
    el.dataset.status=value.status;
    el.textContent=value.message;
    clearTimeout(render.timer);
    render.timer=setTimeout(()=>{if(el)el.classList.add('is-idle')},2200);
    el.classList.remove('is-idle');
  }
  function install(){
    if(window.__dcos1546SaveInstalled||typeof window.savePatients!=='function')return;
    const old=window.savePatients;
    window.savePatients=function(list){
      try{
        const result=old.call(this,list);
        setState('saved','✓ تم الحفظ محليًا والمزامنة قيد التنفيذ');
        return result;
      }catch(e){
        console.error('v15.46 save failed',e);
        setState('error','تعذر الحفظ — افتح سجل الأخطاء',String(e?.message||e));
        alert('تعذر حفظ البيانات على هذا الجهاز: '+(e?.message||e));
        throw e;
      }
    };
    try{savePatients=window.savePatients}catch(e){}
    window.__dcos1546SaveInstalled=true;
  }
  function boot(){install();setTimeout(install,250);setTimeout(install,1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  document.addEventListener('dcos:account-ready',()=>setTimeout(install,0));
})();
