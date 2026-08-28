(function(){
'use strict';
const H=()=>window.DCOS_HYBRID||{}, role=()=>String(H().account?.role||'').toLowerCase();
const allowed=()=>['super_owner','manager','doctor','assistant'].includes(role());
const params=new URLSearchParams(location.search), clinicId=String(params.get('clinic')||H().clinic?.id||localStorage.getItem('dcos_v15_last_clinic')||'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const now=()=>new Date().toISOString(), arr=v=>Array.isArray(v)?v:[];
const currencyLabel=c=>({SYP:'ل.س',USD:'$'}[String(c||'SYP').toUpperCase()]||String(c||'SYP'));
const money=(v,c='SYP')=>String(c||'SYP').toUpperCase()==='SYP'?Number(v||0).toLocaleString('en-US')+' ل.س':currencyLabel(c)+' '+Number(v||0).toLocaleString('en-US');
const isPaid=o=>String(o?.paymentStatus||'').toLowerCase()==='paid'||String(o?.status||'').toLowerCase()==='paid';
const isDone=o=>String(o?.workStatus||o?.status||'').toLowerCase()==='done';
let activePatient=null;
async function init(){await window.DCOS?.Store?.init?.()}
async function labs(){await init();return DCOS.Store.list(`clinics/${clinicId}/labs`)}
async function orders(){await init();return DCOS.Store.list(`clinics/${clinicId}/labOrders`)}
async function setLab(x){await init();return DCOS.Store.set(`clinics/${clinicId}/labs/${x.id}`,x)}
async function setOrder(x){await init();return DCOS.Store.set(`clinics/${clinicId}/labOrders/${x.id}`,x)}
function p(){return activePatient||window.patient||null}
function doctor(x){return {id:String(x?.primaryDoctorId||x?.assignedDoctorId||H().account?.email||'').toLowerCase(),name:String(x?.primaryDoctorName||x?.assignedDoctorName||H().account?.doctorName||H().account?.name||'غير محدد')}}
function modal(html){document.getElementById('dcosLabModal')?.remove();const d=document.createElement('div');d.id='dcosLabModal';d.className='modal dcos-global-modal';d.innerHTML=`<div class="modalBox dcos-lab-modal-box">${html}</div>`;document.body.appendChild(d)}
window.DCOS_LABS_close=()=>document.getElementById('dcosLabModal')?.remove();

async function addLabForm(cb){
modal(`<h2>إضافة مخبر جديد</h2><div class="form-grid"><input id="labName" placeholder="اسم المخبر"><input id="labLocation" placeholder="المكان"><input id="labPhone" placeholder="رقم الهاتف"><textarea id="labNotes" placeholder="ملاحظات"></textarea></div><div class="modal-actions"><button class="primary" id="saveLabBtn">حفظ المخبر</button><button onclick="DCOS_LABS_close()">إلغاء</button></div>`);
document.getElementById('saveLabBtn').onclick=async()=>{const name=document.getElementById('labName').value.trim();if(!name)return alert('أدخل اسم المخبر');const x={id:'lab_'+Date.now(),name,location:document.getElementById('labLocation').value.trim(),phone:document.getElementById('labPhone').value.trim(),notes:document.getElementById('labNotes').value.trim(),clinicId,createdAt:now(),updatedAt:now()};await setLab(x);DCOS_LABS_close();cb?.(x)}}
window.DCOS_LABS_addLab=()=>addLabForm();

async function openOrder(){
if(!allowed())return;const patient=p();if(!patient)return alert('افتح ملف مريض أولًا');const ls=await labs(), d=doctor(patient);
modal(`<h2>طلب مخبر</h2><p class="muted">المريض: <b>${esc(patient.name||'')}</b> · الطبيب: <b>${esc(d.name)}</b></p><div class="dcos-lab-select-row"><select id="labSelect"><option value="">اختر المخبر</option>${ls.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><button class="primary" id="addLabInline">+ إضافة مخبر</button></div><input id="labTeeth" placeholder="الأسنان أو المنطقة المشمولة"><textarea id="labDescription" placeholder="وصف العمل المطلوب"></textarea><div class="dcos-lab-money-row"><input id="labPrice" type="number" min="0" step="any" placeholder="السعر المطلوب دفعه للمخبر"><select id="labCurrency" aria-label="عملة مبلغ المخبر"><option value="SYP">ليرة سورية</option><option value="USD">دولار أمريكي</option></select></div><div class="modal-actions"><button class="primary" id="saveLabOrder">حفظ الطلب</button><button onclick="DCOS_LABS_close()">إلغاء</button></div>`);
document.getElementById('addLabInline').onclick=()=>addLabForm(x=>openOrder().then(()=>{const s=document.getElementById('labSelect');if(s)s.value=x.id}));
document.getElementById('saveLabOrder').onclick=async()=>{const id=document.getElementById('labSelect').value, all=await labs(), lab=all.find(x=>x.id===id);if(!lab)return alert('اختر المخبر');const o={id:'laborder_'+Date.now(),clinicId,labId:lab.id,labName:lab.name,patientId:String(patient.id||patient.fileNo||patient.fileNumber||''),patientName:patient.name||'',doctorId:d.id,doctorName:d.name,teeth:document.getElementById('labTeeth').value.trim(),description:document.getElementById('labDescription').value.trim(),price:Number(document.getElementById('labPrice').value||0),currency:String(document.getElementById('labCurrency').value||'SYP'),workStatus:'pending',paymentStatus:'unpaid',status:'pending',createdAt:now(),updatedAt:now(),createdBy:H().account?.email||H().account?.name||''};await setOrder(o);DCOS_LABS_close();window.DCOS?.toast?.('تم حفظ طلب المخبر');refreshCounter()}}
window.DCOS_LABS_openOrder=openOrder;

async function openOrders(){
if(!allowed())return;const all=await orders(), pending=all.filter(x=>!isDone(x)), done=all.filter(x=>isDone(x));
const row=o=>`<div class="dcos-lab-order ${isDone(o)?'done':''} ${isPaid(o)?'paid':''}"><div><b>${esc(o.labName)}</b><small>${esc(o.patientName)} · ${esc(o.doctorName||'')}</small></div><div><span>${esc(o.teeth||'')}</span><p>${esc(o.description||'')}</p></div><div><b>${money(o.price,o.currency)}</b><small>${new Date(o.createdAt||Date.now()).toLocaleDateString()}</small><small>${isPaid(o)?'✓ مسدد':'غير مسدد'}</small></div><div class="dcos-lab-order-actions">${!isDone(o)?`<button onclick="DCOS_LABS_markDone('${esc(o.id)}')">تم</button>`:'<span class="pill">مكتمل</span>'}${!isPaid(o)?`<button class="ok" onclick="DCOS_LABS_markPaid('${esc(o.id)}')">تم التسديد</button>`:'<span class="pill dcos-paid-pill">مسدد</span>'}</div></div>`;
modal(`<h2>طلبات المخابر</h2><h3>طلبات قائمة (${pending.length})</h3><div class="dcos-lab-orders">${pending.map(row).join('')||'<p class="muted">لا توجد طلبات قائمة.</p>'}</div><h3>السجل المكتمل (${done.length})</h3><div class="dcos-lab-orders">${done.map(row).join('')||'<p class="muted">لا يوجد سجل مكتمل.</p>'}</div><div class="modal-actions"><button onclick="DCOS_LABS_close()">إغلاق</button></div>`)}
window.DCOS_LABS_openOrders=openOrders;
window.DCOS_LABS_markDone=async id=>{const all=await orders(), o=all.find(x=>x.id===id);if(!o)return;o.workStatus='done';o.status='done';o.completedAt=now();o.updatedAt=now();await setOrder(o);await openOrders();refreshCounter();refreshDueCounter()};
window.DCOS_LABS_markPaid=async id=>{const all=await orders(), o=all.find(x=>x.id===id);if(!o||isPaid(o))return;if(!confirm(`تأكيد تسديد ${money(o.price,o.currency)} للمخبر ${o.labName||''}؟`))return;o.paymentStatus='paid';o.paidAt=now();o.paidBy=H().account?.email||H().account?.name||'';o.updatedAt=now();await setOrder(o);await openOrders();refreshDueCounter();window.DCOS?.toast?.('تم تسجيل تسديد طلب المخبر')};

function totalsByCurrency(list){return list.filter(o=>!isPaid(o)).reduce((a,o)=>{const c=String(o.currency||'SYP').toUpperCase();a[c]=(a[c]||0)+Number(o.price||0);return a},{})}
function totalsHtml(t){const rows=Object.entries(t).filter(([,v])=>Number(v));return rows.length?rows.map(([c,v])=>`<b>${money(v,c)}</b>`).join('<br>'):'<b>0 ل.س</b>'}
async function openClinicLabDues(){const allOrders=await orders(), allLabs=await labs();const groups=allLabs.map(l=>{const related=allOrders.filter(o=>o.labId===l.id&&!isPaid(o));return {lab:l,orders:related,totals:totalsByCurrency(related)}}).filter(x=>x.orders.length);modal(`<h2>المبالغ المستحقة للمخابر</h2><p class="muted">هذه الحسابات مستقلة تمامًا عن مالية المرضى والأطباء والعيادة.</p><div class="dcos-lab-due-list">${groups.map(g=>`<div class="dcos-lab-due-card"><div><b>${esc(g.lab.name)}</b><small>${g.orders.length} طلب غير مسدد</small></div><div>${totalsHtml(g.totals)}</div></div>`).join('')||'<p class="muted">لا توجد مبالغ مستحقة.</p>'}</div><div class="modal-actions"><button onclick="DCOS_LABS_close()">إغلاق</button></div>`)}
window.DCOS_LABS_openClinicDues=openClinicLabDues;
function ensureDueCounter(html='0 ل.س'){
 if(!['manager','super_owner'].includes(role()))return null;const stats=document.querySelector('.stats-grid');if(!stats)return null;let c=stats.querySelector('.dcos-lab-due-counter');if(!c){c=document.createElement('button');c.type='button';c.className='stat-card dcos-lab-due-counter';c.onclick=openClinicLabDues;stats.appendChild(c)}c.innerHTML=`<span>💳</span><span class="dcos-lab-due-value">${html}</span><small>مستحق للمخابر</small>`;return c;
}
async function refreshDueCounter(){if(!['manager','super_owner'].includes(role()))return;ensureDueCounter();try{const t=totalsByCurrency(await orders());ensureDueCounter(Object.entries(t).filter(([,v])=>Number(v)).map(([c,v])=>money(v,c)).join('<br>')||'0 ل.س')}catch(e){console.warn('lab due counter refresh failed',e)}}

const counterCacheKey=()=>`dcos_lab_pending_count_${clinicId||'default'}`;
function cachedCounter(){const n=Number(localStorage.getItem(counterCacheKey()));return Number.isFinite(n)?n:0}
function ensureCounter(count=cachedCounter()){
  if(!allowed())return null;
  const stats=document.querySelector('.stats-grid');if(!stats)return null;
  let c=stats.querySelector('.dcos-lab-counter');
  if(!c){c=document.createElement('button');c.type='button';c.className='stat-card dcos-lab-counter';c.onclick=openOrders;stats.appendChild(c)}
  c.innerHTML=`<span>🧪</span><b>${Number(count)||0}</b><small>طلبات المخابر</small>`;
  return c;
}
async function refreshCounter(){
  if(!allowed())return;
  ensureCounter();
  try{const all=await orders(),count=all.filter(x=>x.status!=='done').length;localStorage.setItem(counterCacheKey(),String(count));ensureCounter(count)}
  catch(e){console.warn('lab counter refresh failed',e)}
}
function injectPatientButton(){if(!allowed())return;const card=document.querySelector('.patient-main-card');if(!card||card.querySelector('.dcos-lab-request-btn'))return;const b=document.createElement('button');b.className='dcos-lab-request-btn';b.textContent='🧪 طلب مخبر';b.onclick=openOrder;(card.querySelector('.patient-actions,.row,.space')||card).appendChild(b)}
function wrap(name,after){const old=window[name];if(typeof old!=='function'||old.__labs)return;function w(){const args=Array.from(arguments);const r=old.apply(this,args);try{after(args,r)}catch(e){console.warn('labs UI hook',e)}return r}w.__labs=true;window[name]=w;try{eval(name+'=window[name]')}catch(e){}}
let enabled=false;
function enable(){
  if(enabled||!allowed())return;
  enabled=true;
  wrap('openPatient',(args)=>{if(args&&args[0])activePatient=args[0];injectPatientButton()});
  wrap('renderDashboard',refreshCounter);
  wrap('backToHome',()=>{activePatient=null});
  injectPatientButton();
  refreshCounter();refreshDueCounter();
  document.addEventListener('dcos:view-changed',()=>{injectPatientButton();refreshCounter();refreshDueCounter()});
  setTimeout(()=>{wrap('openPatient',(args)=>{if(args&&args[0])activePatient=args[0];injectPatientButton()});wrap('renderDashboard',refreshCounter);wrap('backToHome',()=>{activePatient=null});injectPatientButton();refreshCounter();refreshDueCounter()},700);
}
function boot(){
  enable();
  document.addEventListener('dcos:account-ready',enable);
  let tries=0;
  const timer=setInterval(()=>{enable();if(enabled||++tries>80)clearInterval(timer)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();