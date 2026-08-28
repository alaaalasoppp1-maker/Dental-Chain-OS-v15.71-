'use strict';
/* v15.54 — safe visual cleanup + treatment-only received amount. */
(function(){
  const moneyNum=v=>Math.abs(Number(v||0));
  const currency=v=>String(v||'SYP').toUpperCase()==='USD'?'USD':'SYP';
  const billable=x=>{
    const source=String(x?.source||x?.type||x?.kind||'').toLowerCase();
    const chartOnly=(source.includes('chart')||source.includes('dental')) &&
      !(x?.financialConfirmed===true||x?.billable===true||x?.completed===true||x?.status==='completed');
    return !chartOnly;
  };

  function financeOf(p){
    try{return typeof window.getPatientFinance==='function' ? window.getPatientFinance(p) : (p?.finance||{});}catch(e){return p?.finance||{};}
  }

  /* Canonical totals: raw payments are credit/advance; received is capped by actual treatment charges. */
  window.getFinanceTotals=function(p){
    const f=financeOf(p)||{};
    const out={
      SYP:{totalCharges:0,rawPayments:0,totalPayments:0,paid:0,balance:0,credit:0},
      USD:{totalCharges:0,rawPayments:0,totalPayments:0,paid:0,balance:0,credit:0}
    };
    (Array.isArray(f.charges)?f.charges:[]).filter(billable).forEach(x=>{
      out[currency(x.currency)].totalCharges+=moneyNum(x.amount??x.cost??x.price);
    });
    (Array.isArray(f.payments)?f.payments:[]).forEach(x=>{
      out[currency(x.currency)].rawPayments+=moneyNum(x.amount);
    });
    Object.values(out).forEach(t=>{
      t.paid=Math.min(t.totalCharges,t.rawPayments);
      t.totalPayments=t.paid; // compatibility: every old renderer now sees treatment-covered receipts only.
      t.balance=Math.max(t.totalCharges-t.paid,0);
      t.credit=Math.max(t.rawPayments-t.paid,0);
    });
    return out;
  };

  function fmt(v,c){
    try{return typeof window.formatMoneyWithCurrency==='function' ? window.formatMoneyWithCurrency(v,c) : (c==='USD'?'$ ':'')+Number(v||0).toLocaleString('en-US')+(c==='SYP'?' ل.س':'');}
    catch(e){return String(v||0);}
  }

  window.renderFinancialSummary=function(p){
    const t=window.getFinanceTotals(p);
    const card=(c,label)=>`<div class="dcos-finance-currency"><h4>${label}</h4>
      <div><small>إجمالي تكلفة العلاج</small><b>${fmt(t[c].totalCharges,c)}</b></div>
      <div><small>إجمالي المقبوض من المعالجات</small><b>${fmt(t[c].paid,c)}</b></div>
      <div class="${t[c].balance?'finance-due':'finance-ok'}"><small>المتبقي للدفع</small><b>${fmt(t[c].balance,c)}</b></div>
      ${t[c].credit?`<div class="finance-credit"><small>سلفة / رصيد لصالح المريض</small><b>${fmt(t[c].credit,c)}</b></div>`:''}
    </div>`;
    return `<div class="finance-summary multi-currency-summary safe-finance-summary">${card('SYP','الليرة السورية')}${card('USD','الدولار')}</div>
      <button onclick="openFinanceManager()">💰 الكشف المالي</button>`;
  };

  function syncPatientViewState(){
    const open=!!document.querySelector('#output .patient-profile-card');
    document.body.classList.toggle('dcos-patient-file-open',open);
  }
  const observer=new MutationObserver(syncPatientViewState);
  function boot(){
    syncPatientViewState();
    const output=document.getElementById('output');
    if(output)observer.observe(output,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
