'use strict';
/* v15.27 — reliable reception appointment selection + dual currency finance + one canonical finance model */
(function(){
  const H=()=>window.DCOS_HYBRID||{};
  const role=()=>String(H().account?.role||'');
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Math.abs(Number(v||0));
  const cur=v=>String(v||'SYP').toUpperCase()==='USD'?'USD':'SYP';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const selectedKey='dcos_reception_selected_patient_'+String(new URLSearchParams(location.search).get('clinic')||H().clinic?.id||'clinic');

  function patientKey(p){return String(p?.fileNo||p?.fileNumber||p?.id||'')}
  function patients(){try{return arr(window.getPatients?.())}catch(e){return []}}
  function byKey(key){return patients().find(p=>patientKey(p)===String(key||''))||null}
  function setSelected(p){
    window.DCOS_RECEPTION_SELECTED_PATIENT=p||null;
    try{ if(p) sessionStorage.setItem(selectedKey,patientKey(p)); else sessionStorage.removeItem(selectedKey); }catch(e){}
    try{ window.DCOS_setActivePatient?.(p||null); }catch(e){}
    return p;
  }
  function selected(){
    let p=window.DCOS_RECEPTION_SELECTED_PATIENT||window.DCOS_getActivePatient?.()||null;
    if(p)return p;
    try{p=byKey(sessionStorage.getItem(selectedKey)||'')}catch(e){}
    if(p)setSelected(p);
    return p||null;
  }

  function uniqueRows(rows){
    const seen=new Set();
    return arr(rows).filter(x=>{
      const key=String(x?.id||x?.paymentId||x?.chargeId||x?.financeChargeId||[x?.amount??x?.cost??x?.price,cur(x?.currency),x?.isoDate||x?.date||x?.createdAt||'',x?.note||x?.label||x?.title||''].join('|'));
      if(seen.has(key))return false;seen.add(key);return true;
    });
  }
  function finance(p){
    const f=p?.finance||{};
    const charges=uniqueRows(arr(f.charges).length?f.charges:p?.charges);
    const payments=uniqueRows(arr(f.payments).length?f.payments:p?.payments);
    const out={SYP:{charges:0,payments:0,paid:0,remaining:0,credit:0},USD:{charges:0,payments:0,paid:0,remaining:0,credit:0}};
    charges.forEach(x=>out[cur(x.currency)].charges+=num(x.amount??x.cost??x.price));
    if(!charges.length){
      const plan=arr(p?.treatmentPlan||p?.plans).reduce((s,x)=>s+num(x.cost??x.price??x.amount),0);
      out.SYP.charges+=num(p?.totalCost)||plan;
    }
    payments.forEach(x=>out[cur(x.currency)].payments+=num(x.amount));
    Object.values(out).forEach(t=>{t.paid=Math.min(t.charges,t.payments);t.remaining=Math.max(t.charges-t.payments,0);t.credit=Math.max(t.payments-t.charges,0)});
    return out;
  }
  window.DCOS_CANONICAL_FINANCE=finance;
  window.DCOS_PATIENT_FINANCE=finance;
  window.getFinanceTotals=function(p){
    const t=finance(p);return {SYP:{totalCharges:t.SYP.charges,totalPayments:t.SYP.payments,balance:t.SYP.remaining,credit:t.SYP.credit},USD:{totalCharges:t.USD.charges,totalPayments:t.USD.payments,balance:t.USD.remaining,credit:t.USD.credit}};
  };

  function money(v,c){return c==='USD'?'$ '+num(v).toLocaleString('en-US'):num(v).toLocaleString('en-US')+' ل.س'}
  function currencyCards(p){
    const t=finance(p);
    const card=(c,label)=>`<section class="dcos-reception-currency-card"><h3>${label}</h3><div class="dcos-reception-fin-grid"><div><small>المطلوب</small><b>${money(t[c].charges,c)}</b></div><div><small>المقبوض الفعلي</small><b>${money(t[c].paid,c)}</b></div><div><small>المتبقي</small><b>${money(t[c].remaining,c)}</b></div>${t[c].credit?`<div class="credit"><small>رصيد للمريض</small><b>${money(t[c].credit,c)}</b></div>`:''}</div></section>`;
    return card('SYP','الليرة السورية')+card('USD','الدولار الأمريكي');
  }

  function renderReceptionFinance(p){
    if(role()!=='reception'||!p)return;
    const out=document.getElementById('output');if(!out)return;
    out.innerHTML=`<div class="card reception-panel dcos-reception-finance-panel"><div class="space"><div><h2>خدمة المريض - ${esc(p.name||'مريض')}</h2><p class="muted">متابعة الرصيد وإضافة دفعة بالليرة السورية أو الدولار.</p></div><span class="pill">${esc(patientKey(p))}</span></div><div class="dcos-reception-currencies">${currencyCards(p)}</div><div class="visit-payment-box dcos-reception-payment-form"><label>إضافة دفعة</label><div class="dcos-payment-line"><input id="receptionPayAmount" inputmode="decimal" type="number" min="0" step="any" placeholder="المبلغ"><select id="receptionPayCurrency"><option value="SYP">ل.س</option><option value="USD">$ دولار</option></select></div><input id="receptionPayNote" placeholder="ملاحظة اختيارية"><div class="row"><button id="dcosReceptionSavePayment" onclick="DCOS_HYBRID.saveReceptionPayment('${esc(patientKey(p))}')">حفظ الدفعة</button><button onclick="backToHome()">رجوع</button></div></div></div>`;
    document.getElementById('backBtn')?.style?.setProperty('display','inline-block');
  }

  function installReceptionOpenPatient(){
    if(role()!=='reception'||window.__dcos1527ReceptionOpenPatient)return;
    const old=window.openPatient;
    if(typeof old!=='function')return;
    window.__dcos1527ReceptionOpenPatient=true;
    window.openPatient=function(p){setSelected(p);renderReceptionFinance(p);};
  }

  function installReceptionPayment(){
    if(role()!=='reception'||window.__dcos1527ReceptionPayment)return;
    window.__dcos1527ReceptionPayment=true;
    let saving=false;
    H().saveReceptionPayment=async function(fileNo){
      if(saving)return;
      const list=patients();const idx=list.findIndex(p=>patientKey(p)===String(fileNo||''));if(idx<0)return alert('لم أجد المريض');
      const amount=num(document.getElementById('receptionPayAmount')?.value);if(!amount)return alert('أدخل مبلغ الدفعة');
      const currency=cur(document.getElementById('receptionPayCurrency')?.value);
      const note=String(document.getElementById('receptionPayNote')?.value||'دفعة من الاستقبال').trim();
      const btn=document.getElementById('dcosReceptionSavePayment');saving=true;if(btn){btn.disabled=true;btn.textContent='جارٍ الحفظ...'}
      try{
        const p=list[idx];p.finance=p.finance||{};p.finance.payments=uniqueRows(p.finance.payments);
        const stamp=new Date().toISOString();
        p.finance.payments.push({id:'pay_'+Date.now()+'_'+Math.random().toString(16).slice(2),amount,currency,note,date:stamp,isoDate:stamp,doctor:H().account?.name||'الاستقبال',by:H().account?.email||'',source:'reception'});
        p.finance.payments=uniqueRows(p.finance.payments);
        if(Array.isArray(p.payments))p.payments=[]; // canonical source is finance.payments only
        await Promise.resolve(window.savePatients?.(list));
        setSelected(p);renderReceptionFinance(p);
        window.DCOS?.toast?.('تم حفظ الدفعة');
      }catch(e){console.error(e);alert('تعذر حفظ الدفعة: '+(e.message||e))}
      finally{saving=false;if(btn){btn.disabled=false;btn.textContent='حفظ الدفعة'}}
    };
  }

  function markSelectedRow(p){
    document.querySelectorAll('.dcos-appt-patient-row').forEach(row=>{
      const active=String(row.dataset.file||'')===patientKey(p);
      row.classList.toggle('selected',active);
      const em=row.querySelector('em');if(em)em.textContent=active?'تم الاختيار':'اختيار للموعد';
    });
  }
  function installPatientRowCapture(){
    if(window.__dcos1527PatientCapture)return;window.__dcos1527PatientCapture=true;
    document.addEventListener('click',e=>{
      const row=e.target.closest('.dcos-appt-patient-row');if(!row)return;
      const p=byKey(row.dataset.file);if(!p)return;
      setSelected(p);markSelectedRow(p);
    },true);
  }
  function applySelectedToModal(){
    const p=selected();if(!p)return;
    const sel=document.getElementById('slotPatientFileNo');if(!sel)return;
    const key=patientKey(p);
    if(![...sel.options].some(o=>String(o.value)===key)){
      const o=document.createElement('option');o.value=key;o.textContent=(p.name||'مريض')+' - '+key;sel.appendChild(o);
    }
    sel.value=key;sel.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function installAppointmentWrappers(){
    const oldOpen=window.openAppointmentSlotModal;
    if(typeof oldOpen==='function'&&!oldOpen.__dcos1527){
      function wrapped(){const r=oldOpen.apply(this,arguments);setTimeout(applySelectedToModal,0);return r}wrapped.__dcos1527=true;window.openAppointmentSlotModal=wrapped;
    }
    const oldSave=window.saveAppointmentSlot;
    if(typeof oldSave==='function'&&!oldSave.__dcos1527){
      function wrapped(){applySelectedToModal();return oldSave.apply(this,arguments)}wrapped.__dcos1527=true;window.saveAppointmentSlot=wrapped;
    }
    const oldManagerSave=window.addAppointmentFromManager;
    if(typeof oldManagerSave==='function'&&!oldManagerSave.__dcos1527){
      function wrapped(){const p=selected();if(p)window.DCOS_setActivePatient?.(p);return oldManagerSave.apply(this,arguments)}wrapped.__dcos1527=true;window.addAppointmentFromManager=wrapped;
    }
  }

  function consistencySweep(){
    installReceptionOpenPatient();installReceptionPayment();installPatientRowCapture();installAppointmentWrappers();
    const p=selected();if(p)markSelectedRow(p);
  }
  function boot(){
    consistencySweep();
    document.addEventListener('click',()=>setTimeout(()=>{consistencySweep();applySelectedToModal();},0),true);
    document.addEventListener('dcos:view-changed',()=>{consistencySweep();applySelectedToModal();});
    setTimeout(consistencySweep,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
