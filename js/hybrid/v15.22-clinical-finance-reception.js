'use strict';
/* Dental Chain OS v15.22
   - first medical action assigns the responsible doctor
   - each clinical record preserves its executing doctor
   - finance totals use charges - payments without negative "total"
   - doctor reports avoid duplicated treatment-plan charges
   - assistant/reception guards apply in all nested views
   - focused reception workspace
*/
(function(){
  const VERSION='15.22';
  const H=()=>window.DCOS_HYBRID||{};
  const arr=v=>Array.isArray(v)?v:[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const now=()=>new Date().toISOString();
  const account=()=>H().account||{};
  const role=()=>String(account().role||'');
  const isDoctor=()=>role()==='doctor';
  const isAssistant=()=>role()==='assistant';
  const isReception=()=>role()==='reception';
  const doctorMeta=()=>({
    id:String(account().id||account().uid||account().email||account().name||'').trim().toLowerCase(),
    name:String(account().doctorName||account().name||account().displayName||'').trim(),
    email:String(account().email||'').trim().toLowerCase()
  });
  const normalizeCurrency=v=>String(v||'SYP').toUpperCase()==='USD'?'USD':'SYP';
  const num=v=>{const n=Number(String(v??0).replace(/[^\d.-]/g,''));return Number.isFinite(n)?Math.abs(n):0};

  function activePatient(){
    try{const p=window.DCOS_activePatient?.();if(p)return p;}catch(e){}
    if(window.patient)return window.patient;
    const fileNo=String(document.getElementById('fileNo')?.value||'').trim();
    const name=String(document.getElementById('name')?.value||'').trim();
    return arr(window.getPatients?.()).find(p=>(fileNo&&String(p.fileNo||p.fileNumber||'')===fileNo)||(name&&String(p.name||'').trim()===name))||null;
  }
  function same(a,b){
    if(!a||!b)return false;
    const ai=String(a.id||''),bi=String(b.id||''); if(ai&&bi&&ai===bi)return true;
    const af=String(a.fileNo||a.fileNumber||''),bf=String(b.fileNo||b.fileNumber||''); if(af&&bf&&af===bf)return true;
    return String(a.name||'').trim()===String(b.name||'').trim()&&String(a.phone||'').trim()===String(b.phone||'').trim();
  }
  function persistPatient(p){
    if(!p)return;
    const list=arr(window.getPatients?.());
    const i=list.findIndex(x=>same(x,p));
    if(i>=0)list[i]=p;else list.push(p);
    window.patient=p;
    window.savePatients?.(list);
  }
  function responsibleName(p){return p?.primaryDoctorName||p?.assignedDoctorName||p?.responsibleDoctorName||'لم يُحدد طبيب مسؤول'}
  function assignResponsibleIfNeeded(p, reason){
    if(!p||!isDoctor())return false;
    const d=doctorMeta(); if(!d.name)return false;
    if(p.primaryDoctorId||p.assignedDoctorId||p.responsibleDoctorId||p.primaryDoctorName||p.assignedDoctorName||p.responsibleDoctorName)return false;
    p.primaryDoctorId=d.id; p.primaryDoctorName=d.name;
    p.assignedDoctorId=d.id; p.assignedDoctorName=d.name;
    p.responsibleDoctorId=d.id; p.responsibleDoctorName=d.name;
    p.responsibleDoctorAssignedAt=now(); p.responsibleDoctorAssignedReason=reason||'first-medical-action';
    return true;
  }
  function stampRecord(record, overwrite=false){
    if(!record||!isDoctor())return;
    const d=doctorMeta(); if(!d.name)return;
    if(overwrite||!record.doctor){record.doctor=d.name;record.doctorName=d.name;record.doctorId=d.id;}
    record.lastModifiedByDoctorId=d.id;record.lastModifiedByDoctorName=d.name;record.lastModifiedByDoctorEmail=d.email;record.updatedAt=now();
  }
  function clinicalSnapshot(p){
    return {
      visits:arr(p?.visits).length,
      prescriptions:arr(p?.prescriptions).length,
      plans:arr(p?.treatmentPlan||p?.plans).length,
      teeth:JSON.stringify(p?.teeth||{})
    };
  }
  function finalizeClinicalAction(before, reason){
    const p=activePatient(); if(!p||!isDoctor())return;
    const d=doctorMeta();
    const after=clinicalSnapshot(p);
    let changed=false;
    if(after.visits>before.visits){arr(p.visits).slice(before.visits).forEach(x=>stampRecord(x));changed=true;}
    if(after.prescriptions>before.prescriptions){arr(p.prescriptions).slice(before.prescriptions).forEach(x=>stampRecord(x));changed=true;}
    const plans=arr(p.treatmentPlan||p.plans);
    if(after.plans>before.plans){plans.slice(before.plans).forEach(x=>stampRecord(x));changed=true;}
    if(after.teeth!==before.teeth){
      Object.values(p.teeth||{}).forEach(t=>{
        if(t&&typeof t==='object'&&!t.lastModifiedByDoctorId)stampRecord(t);
      });
      changed=true;
    }
    if(changed){
      assignResponsibleIfNeeded(p,reason);
      p.lastClinicalDoctorId=d.id;p.lastClinicalDoctorName=d.name;p.lastClinicalActionAt=now();
      persistPatient(p);
      setTimeout(()=>window.DCOS_refreshPatientDoctorButton?.(),0);
    }
  }
  function wrapClinical(name, reason){
    const original=window[name];
    if(typeof original!=='function'||original.__dcos1522Wrapped)return;
    function wrapped(){
      const p=activePatient();const before=clinicalSnapshot(p);
      const result=original.apply(this,arguments);
      if(result&&typeof result.then==='function')return result.finally(()=>setTimeout(()=>finalizeClinicalAction(before,reason),0));
      setTimeout(()=>finalizeClinicalAction(before,reason),0);
      return result;
    }
    wrapped.__dcos1522Wrapped=true;wrapped.__original=original;window[name]=wrapped;
  }
  function installClinicalHooks(){
    ['saveVisit','applyReadyRx','generateRx','generateManualDrugBuilderRx','addTreatmentPlan','editTreatmentPlan','toggleTreatmentStep','markTreatmentPlanDone','saveToothState','clearToothState'].forEach(n=>wrapClinical(n,n));
  }

  function financeTotals(p){
    const out={SYP:{charges:0,payments:0,remaining:0,credit:0},USD:{charges:0,payments:0,remaining:0,credit:0}};
    const f=p?.finance||{};
    const charges=arr(f.charges).length?arr(f.charges):arr(p?.charges);
    const payments=arr(f.payments).length?arr(f.payments):arr(p?.payments);
    charges.forEach(x=>out[normalizeCurrency(x.currency)].charges+=num(x.amount??x.cost??x.price));
    payments.forEach(x=>out[normalizeCurrency(x.currency)].payments+=num(x.amount));
    Object.values(out).forEach(t=>{t.remaining=Math.max(t.charges-t.payments,0);t.credit=Math.max(t.payments-t.charges,0)});
    return out;
  }
  function money(v,c){
    try{return window.formatMoneyWithCurrency?window.formatMoneyWithCurrency(v,c):(c==='USD'?'$ ':'')+Number(v||0).toLocaleString('en-US')+(c==='SYP'?' ل.س':'')}catch(e){return String(v||0)}
  }
  window.getFinanceTotals=function(p){
    const t=financeTotals(p);return {SYP:{totalCharges:t.SYP.charges,totalPayments:t.SYP.payments,balance:t.SYP.remaining,credit:t.SYP.credit},USD:{totalCharges:t.USD.charges,totalPayments:t.USD.payments,balance:t.USD.remaining,credit:t.USD.credit}};
  };
  window.renderFinancialSummary=function(p){
    const t=financeTotals(p);
    const card=(c,label)=>`<div class="dcos-finance-currency"><h4>${label}</h4><div><small>إجمالي تكلفة العلاج</small><b>${money(t[c].charges,c)}</b></div><div><small>إجمالي المقبوض</small><b>${money(t[c].payments,c)}</b></div><div class="${t[c].remaining?'finance-due':'finance-ok'}"><small>المتبقي للدفع</small><b>${money(t[c].remaining,c)}</b></div>${t[c].credit?`<div class="finance-credit"><small>رصيد زائد للمريض</small><b>${money(t[c].credit,c)}</b></div>`:''}</div>`;
    return `<div class="dcos-finance-summary-clean">${card('SYP','الليرة السورية')}${card('USD','الدولار')}</div><button onclick="openFinanceManager()">💰 الكشف المالي</button>`;
  };

  function doctorNameOfPatient(p){return p?.primaryDoctorName||p?.assignedDoctorName||p?.responsibleDoctorName||p?.doctor||p?.treatingDoctor||p?.activeDoctor||p?.provider||'غير محدد'}
  window.dcos105PatientDoctor=function(p){return String(doctorNameOfPatient(p)||'غير محدد').trim()||'غير محدد'};
  window.dcos105FinanceItemsForPatient=function(p){
    const rows=[];const patientName=p?.name||'';const base=window.dcos105PatientDoctor(p);
    const seen=new Set();
    arr(p?.finance?.charges).forEach(x=>{
      const amount=num(x.amount??x.cost);if(!amount)return;
      const key=String(x.id||x.financeChargeId||x.planId||[x.label,x.date,amount].join('|'));if(seen.has(key))return;seen.add(key);
      rows.push({doctor:String(x.doctorName||x.doctor||x.treatingDoctor||base),patient:patientName,date:x.date||x.createdAt||'',title:x.label||x.title||x.note||'إجراء مالي',amount,kind:'إجراء مالي'});
    });
    arr(p?.procedures).forEach(x=>{
      const amount=num(x.amount??x.cost??x.price);if(!amount)return;
      const key=String(x.id||['procedure',x.title,x.date,amount].join('|'));if(seen.has(key))return;seen.add(key);
      rows.push({doctor:String(x.doctorName||x.doctor||base),patient:patientName,date:x.date||x.createdAt||'',title:x.title||x.name||x.procedure||'إجراء',amount,kind:'إجراء'});
    });
    return rows;
  };

  function denyForAssistant(label){if(isAssistant()){alert('هذه الواجهة غير متاحة لحساب المساعدة: '+label);return true}return false}
  function guard(name,label){
    const old=window[name];if(typeof old!=='function'||old.__dcos1522Guard)return;
    function wrapped(){if(denyForAssistant(label))return;return old.apply(this,arguments)}
    wrapped.__dcos1522Guard=true;window[name]=wrapped;
  }
  function hideForbiddenButtons(){
    const accountRole=role();
    document.body.classList.toggle('dcos-role-assistant',accountRole==='assistant');
    document.body.classList.toggle('dcos-role-reception',accountRole==='reception');
    if(accountRole==='assistant'){
      document.querySelectorAll('button,a').forEach(el=>{
        const t=(el.textContent||'').replace(/\s+/g,' ').trim();
        if(/تقارير?\s*الأطباء|تقرير\s*الأطباء|الكشف\s*المالي|مالية\s*العيادة|تقارير\s*مالية/.test(t))el.classList.add('dcos-permission-hidden');
      });
    }
  }

  function receptionPanel(){
    return `<section class="dcos-reception-home">
      <div class="dcos-reception-hero"><div><span>واجهة الاستقبال</span><h2>${esc(H().clinic?.name||'العيادة')}</h2><p>مساحة عمل مبسطة لتسجيل المرضى، متابعة الدفعات، وتنظيم المواعيد.</p></div><div class="dcos-reception-icon">🏥</div></div>
      <div class="dcos-reception-actions">
        <button onclick="DCOS_RECEPTION.focusNewPatient()"><span>👤</span><b>إدخال مريض جديد</b><small>تسجيل البيانات الأساسية فقط</small></button>
        <button onclick="DCOS_RECEPTION.openPayments()"><span>💳</span><b>دفعات المرضى</b><small>معرفة المتبقي وإضافة دفعة</small></button>
        <button onclick="openAppointmentsManager()"><span>📅</span><b>إدارة المواعيد</b><small>إضافة، مراجعة وتعديل المواعيد</small></button>
      </div>
      <div class="dcos-reception-note">اختر المهمة المطلوبة للبدء بسرعة، ويمكنك العودة إلى هذه الصفحة في أي وقت.</div>
    </section>`;
  }
  function renderReceptionHome(){
    if(!isReception())return false;
    const output=document.getElementById('output');if(output)output.innerHTML=receptionPanel();
    const back=document.getElementById('backBtn');if(back)back.style.display='none';
    hideForbiddenButtons();return true;
  }
  window.DCOS_RECEPTION={
    focusNewPatient(){document.getElementById('name')?.focus();document.querySelector('.patient-inputs')?.scrollIntoView({behavior:'smooth',block:'center'});},
    openPayments(){
      if(typeof window.showPatients==='function')window.showPatients();
      setTimeout(()=>{
        const out=document.getElementById('output');
        out?.querySelectorAll('.patient-card,.card').forEach(card=>card.classList.add('dcos-reception-patient-choice'));
      },100);
    },
    home:renderReceptionHome
  };
  function installReceptionHome(){
    const old=window.renderDashboard;
    if(typeof old==='function'&&!old.__dcos1522Reception){
      function wrapped(){if(isReception())return renderReceptionHome();const r=old.apply(this,arguments);setTimeout(hideForbiddenButtons,0);return r;}
      wrapped.__dcos1522Reception=true;window.renderDashboard=wrapped;
    }
    const oldBack=window.backToHome;
    if(typeof oldBack==='function'&&!oldBack.__dcos1522Reception){
      function wrapped(){if(isReception())return renderReceptionHome();return oldBack.apply(this,arguments)}
      wrapped.__dcos1522Reception=true;window.backToHome=wrapped;
    }
  }

  let receptionBooted=false;
  function install(){
    installClinicalHooks();installReceptionHome();
    ['openFinanceManager','openDoctorReports','openDoctorReportDetails','openClinicV5Reports','openClinicFinanceDashboard','toggleClinicFinanceSidebar'].forEach(n=>guard(n,n));
    hideForbiddenButtons();
    if(isReception() && !receptionBooted){
      receptionBooted=true;
      renderReceptionHome();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,350),{once:true});
  else setTimeout(install,350);
})();
