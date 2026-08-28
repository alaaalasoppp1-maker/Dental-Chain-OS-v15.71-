(function(){
'use strict';
const VERSION='15.68-patient-gender-stable';
const FIELD_ID='dcosPatientGenderField';
const PROFILE_ID='dcosPatientGenderProfile';
const normalize=v=>{
  const value=String(v||'').toLowerCase();
  return value==='female'||value==='male'?value:'';
};
const label=v=>normalize(v)==='female'?'أنثى':normalize(v)==='male'?'ذكر':'غير محدد';

function activePatient(){
  try{const p=window.DCOS_CHAIR_DISPLAY?.activePatient?.();if(p)return p}catch{}
  try{const p=window.DCOS_getActivePatient?.();if(p)return p}catch{}
  try{const p=window.getCurrentPatient?.();if(p)return p}catch{}
  return null;
}
function controlMarkup(name){
  return `<span class="dcos-gender-label">الجنس</span><div class="dcos-gender-options" role="group" aria-label="جنس المريض">
    <label><input type="radio" name="${name}" value="male" data-dcos-gender><span>ذكر</span></label>
    <label><input type="radio" name="${name}" value="female" data-dcos-gender><span>أنثى</span></label>
  </div>`;
}
function selected(){
  return normalize(
    document.querySelector(`#${FIELD_ID} [data-dcos-gender]:checked`)?.value||
    document.querySelector(`#${PROFILE_ID} [data-dcos-gender]:checked`)?.value
  );
}
function select(gender){
  const value=normalize(gender);
  document.querySelectorAll('[data-dcos-gender]').forEach(input=>{input.checked=input.value===value});
  const profile=document.getElementById(PROFILE_ID);if(profile)profile.dataset.gender=value;
}
function ensureFormControl(){
  const fields=document.querySelector('.patient-inputs .fields-box');if(!fields)return;
  let field=document.getElementById(FIELD_ID);
  if(!field){
    field=document.createElement('div');field.id=FIELD_ID;field.className='dcos-patient-gender-field';field.innerHTML=controlMarkup('dcosPatientGender');
    const fileNo=fields.querySelector('#fileNo');fields.insertBefore(field,fileNo||null);
  }
  if(!field.querySelector('[data-dcos-gender]:checked'))select('');
}
function ensureProfileControl(){
  const header=document.querySelector('#output .patient-profile-card .profile-header');
  if(!header){document.getElementById(PROFILE_ID)?.remove();return}
  let field=document.getElementById(PROFILE_ID);
  if(!field){
    field=document.createElement('div');field.id=PROFILE_ID;field.className='dcos-patient-gender-profile';field.innerHTML=controlMarkup('dcosPatientGenderProfile');
    header.insertAdjacentElement('afterend',field);
  }
  const p=activePatient();select(p?.gender||selected());
}
function persist(value){
  const gender=normalize(value);select(gender);
  try{
    const p=window.getCurrentPatient?.()||activePatient();if(!p)return;
    p.gender=gender;
    if(typeof window.saveAll==='function')window.saveAll();
    select(gender);
    const profile=document.getElementById(PROFILE_ID);if(profile)profile.setAttribute('aria-label',`جنس المريض: ${label(gender)}`);
  }catch(error){console.warn('patient gender save',error)}
}
function hook(name,after){
  const fn=window[name];if(typeof fn!=='function'||fn.__dcosGender)return;
  const wrapped=function(){const value=selected();const result=fn.apply(this,arguments);try{after(value,arguments,result)}catch(error){console.warn('patient gender hook',name,error)}return result};
  wrapped.__dcosGender=true;if(fn.__chairFinal)wrapped.__chairFinal=true;window[name]=wrapped;
}
function installHooks(){
  hook('fillPatientFields',(_value,args)=>select(args?.[0]?.gender||''));
  hook('clearPatientFields',()=>select(''));
  hook('registerPatient',value=>{const p=window.getCurrentPatient?.();if(p){p.gender=value;window.saveAll?.()}setTimeout(ensureProfileControl,0)});
  hook('editPatient',value=>{const p=activePatient();if(p){p.gender=value;window.saveAll?.()}setTimeout(ensureProfileControl,0)});
  hook('openPatient',(_value,args)=>{select(args?.[0]?.gender||'');setTimeout(ensureProfileControl,0)});
}
function refresh(){ensureFormControl();installHooks();ensureProfileControl()}
document.addEventListener('change',event=>{if(event.target?.matches?.('[data-dcos-gender]'))persist(event.target.value)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,160));else setTimeout(refresh,160);
new MutationObserver(()=>setTimeout(refresh,35)).observe(document.documentElement,{childList:true,subtree:true});
setInterval(installHooks,1200);
window.DCOS_PATIENT_GENDER={version:VERSION,get:selected,set:persist,normalize};
})();
