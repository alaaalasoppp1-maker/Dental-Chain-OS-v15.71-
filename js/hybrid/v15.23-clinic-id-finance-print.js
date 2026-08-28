(function(){
  'use strict';
  const VERSION='15.23';
  const qs=k=>new URLSearchParams(location.search).get(k);
  const clinicId=()=>String(qs('clinic')||window.DCOS?.Session?.get?.()?.clinicId||'clinic').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Math.abs(Number(v||0));

  function hash2(s){
    let h=0; for(const ch of String(s||'')) h=(h*31+ch.charCodeAt(0))%1296;
    return h.toString(36).toUpperCase().padStart(2,'0');
  }
  function clinicPrefix(){
    try{
      const saved=localStorage.getItem('dcos_clinic_prefix_'+clinicId());
      if(saved) return saved;
    }catch(e){}
    const id=clinicId();
    const parts=id.split(/[^a-zA-Z0-9]+/).filter(Boolean).filter(x=>!['clinic','branch','main'].includes(x.toLowerCase()));
    let stem=(parts[0]||'CL').replace(/\d+/g,'').slice(0,3).toUpperCase();
    if(stem.length<2) stem='CL';
    return (stem+hash2(id)).slice(0,5);
  }
  function nextPatientNumber(){
    const prefix=clinicPrefix();
    let max=0;
    try{
      (window.getPatients?.()||[]).forEach(p=>{
        const m=String(p.fileNo||'').match(new RegExp('^'+prefix+'-(\\d+)$','i'));
        if(m) max=Math.max(max,Number(m[1])||0);
      });
    }catch(e){}
    return prefix+'-'+String(max+1).padStart(4,'0');
  }
  window.getNextPatientNumber=nextPatientNumber;
  window.ensurePatientFileNo=function(p){
    if(p&&!p.fileNo) p.fileNo=nextPatientNumber();
    if(p&&!p.clinicId) p.clinicId=clinicId();
    return p;
  };

  function normCurrency(v){return String(v||'SYP').toUpperCase()==='USD'?'USD':'SYP'}
  function canonicalFinance(p){
    const f=p?.finance||{};
    const charges=arr(f.charges).length?arr(f.charges):arr(p?.charges);
    const payments=arr(f.payments).length?arr(f.payments):arr(p?.payments);
    const out={SYP:{charges:0,payments:0,paid:0,remaining:0,credit:0},USD:{charges:0,payments:0,paid:0,remaining:0,credit:0}};
    charges.forEach(x=>out[normCurrency(x.currency)].charges+=num(x.amount??x.cost??x.price));
    if(!charges.length){
      const fallback=num(p?.totalCost)||arr(p?.treatmentPlan||p?.plans).reduce((s,x)=>s+num(x.cost??x.price??x.amount),0);
      out.SYP.charges+=fallback;
    }
    payments.forEach(x=>out[normCurrency(x.currency)].payments+=num(x.amount));
    Object.values(out).forEach(t=>{
      t.paid=Math.min(t.charges,t.payments);
      t.remaining=Math.max(t.charges-t.payments,0);
      t.credit=Math.max(t.payments-t.charges,0);
    });
    return out;
  }
  window.DCOS_PATIENT_FINANCE=canonicalFinance;

  // Monthly clinic income = recognized treatment income only; patient credit stays a liability.
  window.getClinicIncomeTotalsForMonth=function(monthKey){
    const out={SYP:{income:0,credit:0,expenses:0,net:0},USD:{income:0,credit:0,expenses:0,net:0}};
    const key=monthKey||(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})();
    (window.getPatients?.()||[]).forEach(p=>{
      const f=p?.finance||{};
      const payments=arr(f.payments).length?arr(f.payments):arr(p?.payments);
      const totals=canonicalFinance(p);
      const monthPaid={SYP:0,USD:0};
      payments.forEach(x=>{
        const d=new Date(x.isoDate||x.date||0); if(Number.isNaN(d.getTime())) return;
        const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
        if(k===key) monthPaid[normCurrency(x.currency)]+=num(x.amount);
      });
      ['SYP','USD'].forEach(c=>{
        // Only the portion covered by actual treatment charges is clinic income.
        const recognized=Math.min(monthPaid[c],totals[c].charges);
        out[c].income+=recognized;
        out[c].credit+=Math.max(monthPaid[c]-recognized,0);
      });
    });
    ['SYP','USD'].forEach(c=>out[c].net=out[c].income-out[c].expenses);
    return out;
  };

  function patchFinanceLabels(){
    document.querySelectorAll('.safe-finance-summary small,.dcos-finance-summary-clean small').forEach(el=>{
      if(el.textContent.includes('سلفة')) el.textContent='إجمالي الدفعات';
    });
  }
  const mo=new MutationObserver(()=>patchFinanceLabels());
  if(document.documentElement) mo.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('DOMContentLoaded',patchFinanceLabels,{once:true});
})();
