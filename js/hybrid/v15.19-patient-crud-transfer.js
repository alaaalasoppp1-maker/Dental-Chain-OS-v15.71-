'use strict';
/* v15.19 — reliable patient delete + global doctor transfer */
(function(){
  const VERSION='15.19';
  const H=()=>window.DCOS_HYBRID||{};
  const account=()=>H().account||{};
  const currentClinicId=()=>String(H().clinic?.id||new URLSearchParams(location.search).get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic');
  const now=()=>new Date().toISOString();
  const arr=x=>Array.isArray(x)?x:[];
  const safe=v=>String(v||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_');
  const patientId=(p,i=0)=>safe(p?.id||p?.uid||p?.fileNo||p?.fileNumber||p?.phone||p?.name||('patient_'+i));
  const same=(a,b)=>{
    const ai=String(a?.id||''),bi=String(b?.id||''); if(ai&&bi&&ai===bi)return true;
    const af=String(a?.fileNo||a?.fileNumber||''),bf=String(b?.fileNo||b?.fileNumber||''); if(af&&bf&&af===bf)return true;
    return String(a?.name||'').trim()===String(b?.name||'').trim() && String(a?.phone||'').trim()===String(b?.phone||'').trim();
  };
  const readJson=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch(e){return f}};
  const writeJson=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function addLocalDeletionTombstone(p){
    const id=patientId(p);
    const ids=new Set(readJson('dcos_v9_deleted_patient_ids',[])); ids.add(id); writeJson('dcos_v9_deleted_patient_ids',[...ids]);
    const trash=readJson('dcos_v9_deleted_patients',[]); const idx=trash.findIndex(x=>x.id===id);
    const rec={id,patient:p,deletedAt:now(),deletedBy:account().email||account().name||'unknown'};
    if(idx>=0)trash[idx]={...trash[idx],...rec};else trash.push(rec); writeJson('dcos_v9_deleted_patients',trash);
  }
  async function cloudRowsMatching(clinicId,p){
    await window.DCOS.Store.init();
    const rows=await window.DCOS.Store.list('clinics/'+clinicId+'/patients');
    return arr(rows).filter(r=>same(r,p));
  }
  async function deletePatientFromCloud(clinicId,p){
    const rows=await cloudRowsMatching(clinicId,p);
    const ids=new Set(rows.map(r=>r.id).filter(Boolean)); ids.add(patientId(p));
    for(const id of ids) await window.DCOS.Store.del('clinics/'+clinicId+'/patients/'+id);
    return ids.size;
  }

  // Replace legacy optimistic delete with an awaited cloud-first operation.
  window.deletePatient=async function(){
    const p=window.patient; if(!p)return alert('لا يوجد مريض محدد');
    if(!confirm('حذف المريض نهائيًا من العيادة والسحابة؟'))return;
    const btn=document.activeElement; if(btn&&btn.tagName==='BUTTON'){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='جارٍ الحذف...';}
    try{
      if(!window.DCOS?.Store)throw new Error('خدمة Firebase غير جاهزة');
      const clinicId=currentClinicId();
      addLocalDeletionTombstone(p);
      await deletePatientFromCloud(clinicId,p);
      const next=arr(window.getPatients?.()).filter(x=>!same(x,p));
      window.savePatients(next);
      // Wait for queued local/cloud writers, then verify the record is absent.
      await new Promise(r=>setTimeout(r,350));
      const remains=await cloudRowsMatching(clinicId,p);
      if(remains.length){
        for(const row of remains)await window.DCOS.Store.del('clinics/'+clinicId+'/patients/'+row.id);
      }
      await window.DCOS.Audit?.log(clinicId,'delete_patient',{patientId:patientId(p),fileNo:p.fileNo||'',name:p.name||'',verified:true},account());
      try{window.clearPatientFields?.();}catch(e){}
      window.patient=null;
      try{window.renderDashboard?.();}catch(e){}
      alert('تم حذف المريض من الجهاز والسحابة بنجاح');
    }catch(e){
      console.error('v15.19 patient delete',e);
      alert('لم يكتمل حذف المريض من السحابة: '+(e.message||e));
    }finally{
      if(btn&&btn.tagName==='BUTTON'){btn.disabled=false;btn.textContent=btn.dataset.oldText||'🗑 حذف';}
    }
  };

  async function allDoctors(){
    await window.DCOS.Store.init();
    const rows=await window.DCOS.getAccountsAll();
    return arr(rows).filter(x=>x.role==='doctor'&&x.active!==false).map(x=>({
      id:String(x.email||x.id||'').toLowerCase(),
      name:x.doctorName||x.name||x.email,
      clinicId:String(x.clinicId||''),
      clinicName:x.clinicName||''
    })).filter(x=>x.id&&x.clinicId);
  }
  async function transferPatient(p,d){
    const sourceClinic=currentClinicId();
    const targetClinic=d.clinicId||sourceClinic;
    const originalId=patientId(p);
    p.primaryDoctorId=d.id; p.primaryDoctorName=d.name;
    p.assignedDoctorId=d.id; p.assignedDoctorName=d.name;
    p.doctorTransferredAt=now();
    p.doctorTransferHistory=arr(p.doctorTransferHistory);
    p.doctorTransferHistory.push({fromClinicId:sourceClinic,toClinicId:targetClinic,toDoctorId:d.id,toDoctorName:d.name,at:now(),by:account().email||account().name||''});
    // Historical procedures and payments are intentionally untouched.
    if(targetClinic!==sourceClinic){
      const moved={...p,id:originalId,clinicId:targetClinic,transferredFromClinicId:sourceClinic,updatedAt:now()};
      await window.DCOS.Store.set('clinics/'+targetClinic+'/patients/'+originalId,moved);
      await deletePatientFromCloud(sourceClinic,p);
      addLocalDeletionTombstone(p);
      const sourceList=arr(window.getPatients?.()).filter(x=>!same(x,p));
      window.savePatients(sourceList);
      await window.DCOS.Audit?.log(sourceClinic,'transfer_patient_out',{patientId:originalId,toClinicId:targetClinic,toDoctorId:d.id,toDoctorName:d.name},account());
      await window.DCOS.Audit?.log(targetClinic,'transfer_patient_in',{patientId:originalId,fromClinicId:sourceClinic,toDoctorId:d.id,toDoctorName:d.name},account());
      window.patient=null; window.clearPatientFields?.(); window.renderDashboard?.();
      alert('تم نقل المريض إلى '+d.name+' في '+(d.clinicName||'العيادة المحددة')+'. بقيت الإجراءات والدفعات القديمة منسوبة لأطبائها الأصليين.');
    }else{
      const list=arr(window.getPatients?.()); const idx=list.findIndex(x=>same(x,p)); if(idx>=0)list[idx]=p;
      window.savePatients(list); window.patient=p;
      await window.DCOS.Audit?.log(sourceClinic,'change_patient_doctor',{patientId:originalId,toDoctorId:d.id,toDoctorName:d.name},account());
      window.openPatient?.(p);
      alert('تم تغيير الطبيب المسؤول. بقيت الإجراءات والدفعات القديمة منسوبة للطبيب الذي نفذها.');
    }
  }
  window.DCOS_changePatientDoctor=async function(id){
    if(prompt('أدخل كلمة سر تغيير الطبيب:')!=='DTDCDRS')return alert('كلمة السر غير صحيحة');
    const list=arr(window.getPatients?.()); const p=list.find(x=>patientId(x)===String(id))||window.patient;
    if(!p)return alert('لم أجد ملف المريض');
    try{
      const ds=await allDoctors(); if(!ds.length)return alert('لا توجد حسابات أطباء فعّالة في النظام');
      const labels=ds.map((d,i)=>(i+1)+'- '+d.name+' — '+(d.clinicName||d.clinicId)).join('\n');
      const choice=Number(prompt('اختر الطبيب الجديد من كل النظام:\n'+labels,'1'))-1;
      if(choice<0||!ds[choice])return;
      if(!confirm('نقل المريض إلى '+ds[choice].name+'؟\nلن تتغير نسبة الإجراءات أو الدفعات القديمة.'))return;
      await transferPatient(p,ds[choice]);
    }catch(e){console.error('doctor transfer',e);alert('تعذر نقل المريض: '+(e.message||e));}
  };

  function injectDoctorButton(){
    const input=document.getElementById('fileNo'); if(!input)return;
    let btn=document.getElementById('dcosPatientDoctorCodeBtn');
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.id='dcosPatientDoctorCodeBtn';btn.className='dcos-patient-doctor-code-btn';
      input.insertAdjacentElement('afterend',btn);
    }
    const p=window.patient; const name=p?.primaryDoctorName||p?.assignedDoctorName||'لم يُحدد طبيب';
    btn.textContent='👨‍⚕️ '+name;
    btn.title='عرض أو تغيير الطبيب المسؤول';
    btn.onclick=()=>{if(!window.patient)return alert('افتح ملف مريض أولًا');window.DCOS_changePatientDoctor(patientId(window.patient));};
    btn.style.display=p?'inline-flex':'none';
  }
  function installHooks(){
    if(typeof window.openPatient==='function'&&!window.__dcos1519OpenHook){const old=window.openPatient;window.openPatient=function(){const r=old.apply(this,arguments);setTimeout(injectDoctorButton,0);return r};window.__dcos1519OpenHook=true;}
    if(typeof window.clearPatientFields==='function'&&!window.__dcos1519ClearHook){const old=window.clearPatientFields;window.clearPatientFields=function(){const r=old.apply(this,arguments);setTimeout(injectDoctorButton,0);return r};window.__dcos1519ClearHook=true;}
    injectDoctorButton();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installHooks,300));else setTimeout(installHooks,300);
  setTimeout(installHooks,1200);
})();
