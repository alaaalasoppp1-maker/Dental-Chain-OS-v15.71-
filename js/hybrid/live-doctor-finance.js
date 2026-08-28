'use strict';
/* v15.16 — immediate cloud persistence + doctor attribution + scoped finance */
(function(){
  const VERSION='15.16';
  const H=()=>window.DCOS_HYBRID||{};
  const acc=()=>H().account||{};
  const clinicId=()=>String(H().clinic?.id||new URLSearchParams(location.search).get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic');
  const isDoctor=()=>acc().role==='doctor';
  const isManager=()=>acc().role==='manager';
  const isSuper=()=>acc().role==='super_owner';
  const doctorId=()=>String(acc().email||acc().id||acc().name||'').trim().toLowerCase();
  const doctorName=()=>String(acc().doctorName||acc().name||acc().email||'').trim();
  const now=()=>new Date().toISOString();
  const clone=x=>{try{return JSON.parse(JSON.stringify(x))}catch(e){return x}};
  const money=(n,c='SYP')=>Number(n||0).toLocaleString('en-US')+(c==='USD'?' $':' ل.س');
  const arr=x=>Array.isArray(x)?x:[];
  const idOf=p=>String(p?.id||p?.fileNo||p?.fileNumber||p?.name||'');
  const entryKey=x=>String(x?.id||x?.financeChargeId||x?.createdAt||x?.date||x?.at||'')+'|'+String(x?.label||x?.title||x?.name||x?.text||'')+'|'+String(x?.amount||x?.cost||'');
  const doctorMatches=(row,id,name)=>{
    const rid=String(row?.doctorId||row?.doctorEmail||row?.by||'').trim().toLowerCase();
    const rn=String(row?.doctorName||row?.doctor||row?.performedBy||'').trim();
    return (!!id&&rid===id)||(!rid&&!!name&&rn===name);
  };

  let prevPatients=[];
  function previousPatient(p){const id=idOf(p);return prevPatients.find(x=>idOf(x)===id)||null;}
  function newRows(current,previous){
    const old=new Set(arr(previous).map(entryKey));
    return arr(current).filter(x=>!old.has(entryKey(x)));
  }
  function stampRow(row,meta){
    if(!row||typeof row!=='object')return;
    row.doctorId=row.doctorId||meta.id;
    row.doctorEmail=row.doctorEmail||meta.id;
    row.doctorName=row.doctorName||meta.name;
    row.doctor=row.doctor||meta.name;
    row.clinicId=row.clinicId||meta.clinicId;
    row.updatedAt=row.updatedAt||now();
  }
  function stampPatientChanges(list){
    if(!isDoctor()) return list;
    const meta={id:doctorId(),name:doctorName(),clinicId:clinicId()};
    return arr(list).map(p=>{
      const old=previousPatient(p)||{};
      const medicalGroups=[
        ['visits',p.visits,old.visits],
        ['prescriptions',p.prescriptions,old.prescriptions],
        ['treatmentPlan',p.treatmentPlan,old.treatmentPlan],
        ['plans',p.plans,old.plans],
        ['appointments',p.appointments,old.appointments]
      ];
      let firstMedical=false;
      medicalGroups.forEach(([,cur,pre])=>newRows(cur,pre).forEach(r=>{stampRow(r,meta);firstMedical=true;}));
      p.finance=p.finance||{};
      newRows(p.finance.charges,old.finance?.charges).forEach(r=>{stampRow(r,meta);firstMedical=true;});
      // A payment stays patient credit until matched to explicit billable work.
      newRows(p.finance.payments,old.finance?.payments).forEach(r=>{
        if(!r.paymentId) r.paymentId='pay_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
        r.patientCredit=true;
        r.clinicId=meta.clinicId;
      });
      if(firstMedical && !p.primaryDoctorId){
        p.primaryDoctorId=meta.id; p.primaryDoctorName=meta.name;
        p.assignedDoctorId=meta.id; p.assignedDoctorName=meta.name;
        p.doctorAssignedAt=now();
      }
      p.clinicId=meta.clinicId;
      return p;
    });
  }

  function installSaveWrapper(){
    if(window.__dcos1516SaveWrapped||typeof window.savePatients!=='function')return;
    window.__dcos1516SaveWrapped=true;
    prevPatients=clone(window.getPatients?window.getPatients():[]);
    const old=window.savePatients;
    window.savePatients=function(list){
      const stamped=stampPatientChanges(clone(list));
      const result=old.call(this,stamped);
      prevPatients=clone(stamped);
      // The bridge writes immediately to clinics/{clinicId}/patients/{patientId}.
      return result;
    };
  }

  async function doctors(){
    try{
      await window.DCOS?.Store?.init();
      const rows=await window.DCOS.Store.list('clinics/'+clinicId()+'/accounts');
      return rows.filter(x=>x.role==='doctor'&&x.active!==false).map(x=>({id:String(x.email||x.id||'').toLowerCase(),name:x.doctorName||x.name||x.email}));
    }catch(e){return []}
  }
  window.DCOS_changePatientDoctor=async function(patientId){
    const ps=window.getPatients?window.getPatients():[];
    const p=ps.find(x=>idOf(x)===String(patientId)); if(!p)return alert('لم أجد المريض');
    const ds=await doctors(); if(!ds.length)return alert('لا توجد حسابات أطباء فعّالة في هذه العيادة');
    const labels=ds.map((d,i)=>(i+1)+'- '+d.name).join('\n');
    const choice=Number(prompt('اختر الطبيب الجديد:\n'+labels,'1'))-1;
    if(choice<0||!ds[choice])return;
    const d=ds[choice];
    p.primaryDoctorId=d.id; p.primaryDoctorName=d.name;
    p.assignedDoctorId=d.id; p.assignedDoctorName=d.name;
    p.doctorTransferredAt=now();
    p.doctorTransferHistory=arr(p.doctorTransferHistory);
    p.doctorTransferHistory.push({toDoctorId:d.id,toDoctorName:d.name,at:now(),by:acc().email||acc().name||''});
    window.savePatients(ps);
    if(window.patient&&idOf(window.patient)===idOf(p))window.patient=p;
    if(typeof window.openPatient==='function')window.openPatient(p);
  };
  function addPatientDoctorCard(){
    // v15.21: doctor ownership is rendered only inside the patient profile header.
    // Remove legacy standalone cards so the same information is never duplicated.
    document.querySelectorAll('.dcos-patient-doctor-card').forEach(el=>el.remove());
  }
  function installPatientHook(){
    if(window.__dcos1516PatientHook||typeof window.openPatient!=='function')return;
    window.__dcos1516PatientHook=true;
    const old=window.openPatient;
    window.openPatient=function(p){const r=old.apply(this,arguments);setTimeout(addPatientDoctorCard,0);return r;};
  }

  function doctorTotals(){
    const did=doctorId(),dn=doctorName();
    const totals={SYP:{charges:0,payments:0},USD:{charges:0,payments:0},rows:[]};

    const currency=v=>String(v||'SYP').toUpperCase()==='USD'?'USD':'SYP';
    const amount=v=>Math.abs(Number(v||0));

    arr(window.getPatients?window.getPatients():[]).forEach(p=>{
      const fin=p.finance||{};
      const patientCharges={SYP:0,USD:0};
      const doctorCharges={SYP:0,USD:0};
      const patientPayments={SYP:0,USD:0};

      arr(fin.charges).forEach(r=>{
        const c=currency(r.currency);
        const value=amount(r.amount??r.cost??r.price);
        const source=String(r.source||r.type||r.kind||'').toLowerCase();

        const chartOnly=(source.includes('chart')||source.includes('dental')) &&
          !(r.financialConfirmed===true||
            r.billable===true||
            r.completed===true||
            r.status==='completed');

        if(!value||chartOnly)return;

        patientCharges[c]+=value;

        if(doctorMatches(r,did,dn)){
          doctorCharges[c]+=value;
          totals[c].charges+=value;
          totals.rows.push({
            patient:p.name||'',
            kind:'إجراء',
            label:r.label||r.title||'',
            amount:value,
            currency:c,
            date:r.date||r.createdAt||''
          });
        }
      });

      arr(fin.payments).forEach(r=>{
        patientPayments[currency(r.currency)]+=amount(r.amount);
      });

      ['SYP','USD'].forEach(c=>{
        const recognized=Math.min(patientPayments[c],patientCharges[c]);

        if(!recognized||!patientCharges[c]||!doctorCharges[c])return;

        const allocated=Math.min(
          doctorCharges[c],
          recognized*(doctorCharges[c]/patientCharges[c])
        );

        totals[c].payments+=allocated;
      });
    });

    totals.SYP.balance=Math.max(0,totals.SYP.charges-totals.SYP.payments);
    totals.USD.balance=Math.max(0,totals.USD.charges-totals.USD.payments);

    return totals;
  }
  function patchDoctorIncomeCard(){
    const card=document.querySelector('.income-open-card,.clinic-income-stat');
    if(!card)return;
    if(isDoctor()){
      const t=doctorTotals();
      card.innerHTML='<span>💵</span><b>'+money(t.SYP.payments,'SYP')+' / '+money(t.SYP.balance,'SYP')+'</b><b>'+money(t.USD.payments,'USD')+' / '+money(t.USD.balance,'USD')+'</b><small>المقبوض / الباقي على مرضاي</small>';
      card.onclick=()=>window.DCOS_DOCTOR_FINANCE.open();
      card.style.removeProperty('display');card.classList.remove('dcos-force-hidden');
    }else if(isManager()||isSuper()){
      card.style.removeProperty('display');card.classList.remove('dcos-force-hidden');
      // Existing v14.9 monthly clinic-income card remains untouched for these roles.
    }else{
      card.style.setProperty('display','none','important');
    }
  }
  window.DCOS_DOCTOR_FINANCE={open(){
    const t=doctorTotals();
    const rows=t.rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const root=document.getElementById('output');if(!root)return;
    root.innerHTML='<div class="card dcos-doctor-finance"><h2>💵 السجل المالي للطبيب</h2><p>'+doctorName()+'</p><div class="finance-summary"><div><small>المقبوض ل.س</small><b>'+money(t.SYP.payments,'SYP')+'</b></div><div><small>الباقي ل.س</small><b>'+money(t.SYP.balance,'SYP')+'</b></div><div><small>المقبوض $</small><b>'+money(t.USD.payments,'USD')+'</b></div><div><small>الباقي $</small><b>'+money(t.USD.balance,'USD')+'</b></div></div><div class="dcos-finance-rows">'+(rows.length?rows.map(r=>'<div class="finance-row"><b>'+r.patient+'</b><span>'+r.kind+' — '+r.label+'</span><strong>'+money(r.amount,r.currency)+'</strong><small>'+r.date+'</small></div>').join(''):'<p>لا توجد حركات مرتبطة بهذا الطبيب بعد.</p>')+'</div><button onclick="backToHome()">رجوع</button></div>';
  }};

  function installDashboardHook(){
    if(window.__dcos1516DashboardHook||typeof window.renderDashboard!=='function')return;
    window.__dcos1516DashboardHook=true;
    const old=window.renderDashboard;
    window.renderDashboard=function(){const r=old.apply(this,arguments);setTimeout(patchDoctorIncomeCard,0);return r;};
  }
  function boot(){installSaveWrapper();installPatientHook();installDashboardHook();setTimeout(()=>{patchDoctorIncomeCard();addPatientDoctorCard();},300);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80),{once:true});else setTimeout(boot,80);
})();
