'use strict';
/* v15.20 — active patient context + patient-file doctor button */
(function(){
  const VERSION='15.21';
  const H=()=>window.DCOS_HYBRID||{};
  const arr=x=>Array.isArray(x)?x:[];
  const safe=v=>String(v||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_');
  const patientId=(p,i=0)=>safe(p?.id||p?.uid||p?.fileNo||p?.fileNumber||p?.phone||p?.name||('patient_'+i));
  const same=(a,b)=>{
    const ai=String(a?.id||''), bi=String(b?.id||'');
    if(ai&&bi&&ai===bi)return true;
    const af=String(a?.fileNo||a?.fileNumber||''), bf=String(b?.fileNo||b?.fileNumber||'');
    if(af&&bf&&af===bf)return true;
    return String(a?.name||'').trim()===String(b?.name||'').trim() && String(a?.phone||'').trim()===String(b?.phone||'').trim();
  };

  function activePatient(){
    try{
      if(typeof window.DCOS_getActivePatient==='function'){
        const p=window.DCOS_getActivePatient();
        if(p)return p;
      }
    }catch(e){}
    try{
      if(typeof window.getCurrentPatient==='function'){
        const p=window.getCurrentPatient();
        if(p)return p;
      }
    }catch(e){}
    const fileNo=String(document.getElementById('fileNo')?.value||'').trim();
    const name=String(document.getElementById('name')?.value||'').trim();
    const phone=String(document.getElementById('phone')?.value||'').trim();
    const list=arr(window.getPatients?.());
    return list.find(p=>(fileNo&&String(p.fileNo||p.fileNumber||'')===fileNo)||(name&&String(p.name||'').trim()===name)||(phone&&String(p.phone||'').trim()===phone))||null;
  }
  window.DCOS_activePatient=activePatient;

  // Replace v15.19 delete wrapper with one that resolves the actual lexical patient.
  const previousDelete=window.deletePatient;
  window.deletePatient=async function(){
    const p=activePatient();
    if(!p)return alert('لا يوجد مريض محدد');
    // v15.19 cloud deletion logic is exposed by the previous handler only through its own bad context,
    // so perform the reliable operation here using the same clinic data service.
    if(!confirm('حذف المريض نهائيًا من العيادة والسحابة؟'))return;
    const btn=document.activeElement;
    if(btn&&btn.tagName==='BUTTON'){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='جارٍ الحذف...';}
    try{
      if(!window.DCOS?.Store)throw new Error('خدمة Firebase غير جاهزة');
      await window.DCOS.Store.init();
      const clinicId=String(H().clinic?.id||new URLSearchParams(location.search).get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic');
      const rows=arr(await window.DCOS.Store.list('clinics/'+clinicId+'/patients'));
      const matches=rows.filter(x=>same(x,p));
      const ids=new Set(matches.map(x=>x.id).filter(Boolean)); ids.add(patientId(p));
      for(const id of ids)await window.DCOS.Store.del('clinics/'+clinicId+'/patients/'+id);

      const next=arr(window.getPatients?.()).filter(x=>!same(x,p));
      window.savePatients?.(next);
      try{
        const tombKey='dcos_v9_deleted_patient_ids';
        const old=JSON.parse(localStorage.getItem(tombKey)||'[]');
        localStorage.setItem(tombKey,JSON.stringify([...new Set([...arr(old),patientId(p)])]));
      }catch(e){}
      await new Promise(r=>setTimeout(r,250));
      const remains=arr(await window.DCOS.Store.list('clinics/'+clinicId+'/patients')).filter(x=>same(x,p));
      for(const row of remains)if(row.id)await window.DCOS.Store.del('clinics/'+clinicId+'/patients/'+row.id);
      if(remains.length)throw new Error('تعذر تأكيد حذف السجل من السحابة');
      await window.DCOS.Audit?.log(clinicId,'delete_patient',{patientId:patientId(p),fileNo:p.fileNo||'',name:p.name||'',verified:true},H().account||{});
      window.clearPatientFields?.();
      window.renderDashboard?.();
      alert('تم حذف المريض من الجهاز والسحابة بنجاح');
    }catch(e){
      console.error('v15.20 patient delete',e);
      alert('لم يكتمل حذف المريض من السحابة: '+(e.message||e));
    }finally{
      if(btn&&btn.tagName==='BUTTON'){btn.disabled=false;btn.textContent=btn.dataset.oldText||'🗑 حذف';}
    }
  };

  function doctorName(p){
    return p?.primaryDoctorName||p?.assignedDoctorName||p?.responsibleDoctorName||p?.doctorName||p?.doctor||'لم يُحدد طبيب مسؤول';
  }
  function removeWrongButton(){
    document.getElementById('dcosPatientDoctorCodeBtn')?.remove();
    document.querySelectorAll('.dcos-v1517-doctor-owner,.dcos-patient-doctor-card').forEach(el=>el.remove());
  }
  function injectPatientFileDoctorButton(){
    removeWrongButton();
    const header=document.querySelector('#output .patient-profile-card .profile-header');
    if(!header)return;
    const p=activePatient();
    if(!p)return;
    let holder=header.querySelector('.dcos-patient-doctor-holder');
    if(!holder){
      holder=document.createElement('div');
      holder.className='dcos-patient-doctor-holder';
      const badge=header.querySelector('.profile-badge');
      if(badge){
        const side=document.createElement('div');
        side.className='dcos-patient-header-side';
        badge.replaceWith(side);
        side.appendChild(badge);
        side.appendChild(holder);
      }else header.appendChild(holder);
    }
    holder.innerHTML='';
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='dcos-patient-doctor-profile-btn';
    btn.innerHTML='<span class="dcos-doctor-btn-label">👨‍⚕️ الطبيب المسؤول</span><strong>'+doctorName(p)+'</strong>';
    btn.title='عرض الطبيب المسؤول أو تغييره';
    btn.onclick=()=>window.DCOS_changePatientDoctor?.(patientId(p));
    holder.appendChild(btn);
  }

  function hookOpenPatient(){
    if(typeof window.openPatient==='function'&&!window.__dcos1520OpenHook){
      const old=window.openPatient;
      window.openPatient=function(p){
        const r=old.apply(this,arguments);
        setTimeout(injectPatientFileDoctorButton,0);
        return r;
      };
      window.__dcos1520OpenHook=true;
    }
    injectPatientFileDoctorButton();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(hookOpenPatient,350));
  else setTimeout(hookOpenPatient,350);
  setTimeout(hookOpenPatient,1300);
})();
