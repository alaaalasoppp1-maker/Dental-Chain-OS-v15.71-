(function(){
'use strict';
const VERSION='15.71-clinical-link';
const BUTTON_ID='dcosShowPatientOnChairBtn';
let lastSelectedFingerprint='';
let activeSessionId='';
let activeSessionPatient='';
function role(){try{return String(window.Hybrid?.account?.role||window.currentUser?.role||localStorage.getItem('dcos_current_role')||'').toLowerCase()}catch{return''}}
function reception(){const r=role();return r==='reception'||r==='استقبال'}
function patient(){
  for(const fn of [()=>window.DCOS_getActivePatient?.(),()=>window.DCOS_activePatient?.(),()=>window.getCurrentPatient?.()]){
    try{const p=fn();if(p&&(p.name||p.fileNo||p.id))return p}catch{}
  }
  const fileNo=String(document.getElementById('fileNo')?.value||'').trim();
  const name=String(document.getElementById('name')?.value||'').trim();
  const phone=String(document.getElementById('phone')?.value||'').trim();
  try{
    const list=Array.isArray(window.getPatients?.())?window.getPatients():[];
    const found=list.find(p=>(fileNo&&String(p.fileNo||p.fileNumber||'')===fileNo)||(name&&String(p.name||'')===name)||(phone&&String(p.phone||'')===phone));
    if(found)return found;
  }catch{}
  return name?{name,fileNo,phone}:null;
}
function firstName(v){return String(v||'').trim().split(/\s+/).filter(Boolean)[0]||'ضيفنا الكريم'}
function patientGender(p){
  const value=String(p?.gender||window.DCOS_PATIENT_GENDER?.get?.()||'').toLowerCase();
  return value==='female'||value==='male'?value:'';
}
function sessionIdFor(p){
  const key=String(p?.id||p?.fileNo||p?.fileNumber||p?.name||'patient');
  if(key!==activeSessionPatient||!activeSessionId){
    activeSessionPatient=key;
    activeSessionId=globalThis.crypto?.randomUUID?.()||`chair-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }
  return activeSessionId;
}
function doctor(){
  const el=document.getElementById('activeDoctor');
  return String(el?.selectedOptions?.[0]?.textContent||el?.value||window.Hybrid?.account?.name||window.currentUser?.name||'').trim();
}
function clinicName(){
  try{
    const q=new URLSearchParams(location.search),h=window.Hybrid||{};
    return String(h.clinic?.name||q.get('clinicName')||localStorage.getItem('dcos_current_clinic_name')||'عيادة د. طاهر').trim();
  }catch{return'عيادة د. طاهر'}
}
function b64(v){const bytes=new TextEncoder().encode(v);let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function protocolFallback(payload){
  const a=document.createElement('a');a.href=`dentalchair://command?data=${encodeURIComponent(b64(JSON.stringify(payload)))}`;
  a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),700);
}
async function launch(payload){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),1400);
  try{
    const response=await fetch('http://127.0.0.1:8765/command',{
      method:'POST',mode:'cors',cache:'no-store',credentials:'omit',signal:controller.signal,
      headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    if(response.ok)return'direct';
  }catch{}finally{clearTimeout(timeout)}
  protocolFallback(payload);return'fallback';
}
function patientPayload(p,action){
  const fullName=String(p?.name||document.getElementById('name')?.value||'').trim();
  const fileNo=String(p?.fileNo||p?.fileNumber||'');
  const gender=patientGender(p),honorific=gender==='female'?'سيدة':gender==='male'?'سيد':'';
  const clinical=window.DTDCClinicalContract?.buildContext?.(p,{
    doctorName:doctor(),clinicName:clinicName(),sessionId:sessionIdFor(p),plans:Array.isArray(p?.treatmentPlans)?p.treatmentPlans:[]
  })||null;
  return {
    action,
    contract:clinical?.contract||'dtdc-clinical-link-v1',
    contractVersion:clinical?.contractVersion||1,
    contextId:clinical?.contextId||'',
    patient:clinical?.patient||undefined,
    plans:clinical?.plans||[],
    patientId:String(p?.id||fileNo||''),
    fileNo,
    fullName,
    firstName:firstName(fullName),
    displayName:firstName(fullName),
    gender,
    honorific,
    doctorName:doctor(),
    clinicName:clinicName(),
    patientFolder:fileNo?`${fileNo} - ${fullName}`:fullName,
    sessionId:sessionIdFor(p),
    protocol:5,
    sentAt:new Date().toISOString()
  };
}
async function selectPatient(p=patient(),force=false){
  if(!p)return false;
  const payload=patientPayload(p,'select_patient');
  if(!payload.fullName)return false;
  const planFingerprint=window.DTDCClinicalContract?.fingerprint?.({patient:payload.patient||{},plans:payload.plans||[]})||JSON.stringify(payload.plans||[]);
  const fingerprint=[payload.patientId,payload.fileNo,payload.fullName,payload.doctorName,planFingerprint].join('|');
  if(!force&&fingerprint===lastSelectedFingerprint)return true;
  try{await launch(payload);lastSelectedFingerprint=fingerprint;return true}catch{return false}
}
async function show(){
  const p=patient();if(!p)return alert('افتح ملف المريض أولًا');
  const fullName=String(p.name||document.getElementById('name')?.value||'').trim();if(!fullName)return alert('اسم المريض غير متوفر');
  const gender=patientGender(p),honorific=gender==='female'?'سيدة':'سيد';
  const btn=document.getElementById(BUTTON_ID),old=btn?.innerHTML;
  if(btn){btn.innerHTML='⏳ جارٍ إرسال الترحيب';btn.disabled=true}
  try{
    await selectPatient(p,true);
    const route=await launch(patientPayload(p,'show_patient'));
    if(btn)btn.innerHTML=route==='direct'?'✅ تم إرسال الترحيب':`↗ تم إرسال الطلب: ${honorific} ${firstName(fullName)}`;
  }catch(error){if(btn)btn.innerHTML='تعذر الإرسال';alert(error.message||'تعذر إرسال الترحيب')}
  finally{setTimeout(()=>{if(btn){btn.innerHTML=old;btn.disabled=false}},1800)}
}
function open(){return!!document.querySelector('#output .patient-file-layout,#output .patient-main-card,#output .patient-profile-card')}
function host(){return document.querySelector('#output .profile-actions,#output .patient-actions-row,#output .patient-action-buttons,#output .patient-tools-actions,#output .patient-card-actions,#output .actions-row')}
function inject(){
  if(reception()||!open()){document.getElementById(BUTTON_ID)?.remove();return}
  selectPatient().catch(()=>{});
  const h=host();if(!h)return;let btn=document.getElementById(BUTTON_ID);
  if(!btn){btn=document.createElement('button');btn.id=BUTTON_ID;btn.type='button';btn.className='dcos-chair-patient-btn';btn.innerHTML='📺 عرض المريض على الشاشة';btn.title='إرسال الاسم الأول ولقب سيد/سيدة إلى شاشة الكرسي';btn.onclick=show}
  if(btn.parentElement!==h)h.prepend(btn);
}
function hook(){
  if(typeof window.openPatient!=='function'||window.openPatient.__chairFinal)return;
  const old=window.openPatient;const wrapped=function(){const r=old.apply(this,arguments);setTimeout(inject,0);setTimeout(()=>{inject();selectPatient().catch(()=>{})},120);setTimeout(inject,450);return r};
  wrapped.__chairFinal=true;if(old.__dcosGender)wrapped.__dcosGender=true;window.openPatient=wrapped;
}
function refresh(){hook();inject()}
window.DCOS_CHAIR_DISPLAY={showPatient:show,selectPatient,inject,activePatient:patient,version:VERSION};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,100));else setTimeout(refresh,100);
document.addEventListener('click',()=>setTimeout(refresh,80),true);
new MutationObserver(()=>setTimeout(inject,30)).observe(document.documentElement,{childList:true,subtree:true});
setInterval(()=>{hook();if(open()&&!document.getElementById(BUTTON_ID))inject()},1000);
})();
