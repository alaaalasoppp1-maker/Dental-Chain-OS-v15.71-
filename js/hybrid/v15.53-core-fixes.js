'use strict';
/* v15.53: exact clinic identity + finance semantics */
(function(){
  const params=new URLSearchParams(location.search);
  const clinicId=String(params.get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'').trim();
  const urlName=String(params.get('clinicName')||'').trim();
  const invalid=v=>{v=String(v||'').trim();return !v||v===clinicId||v==='العيادة'||v==='عيادة العيادة'||/^clinic[_-]/i.test(v)};
  let resolvedName=!invalid(urlName)?urlName:'';
  function systemTitle(n){n=String(n||'').trim();if(!n)return 'نظام العيادة';if(/^نظام\s/.test(n))return n;if(/^عيادة\s/.test(n))return 'نظام '+n;return 'نظام عيادة '+n}
  function applyName(n){
    if(invalid(n))return;resolvedName=n;
    try{localStorage.setItem('dcos_v15_clinic_name_'+clinicId,n);localStorage.setItem('dcos_current_clinic_name',n)}catch(e){}
    if(window.DCOS_HYBRID)window.DCOS_HYBRID.clinic={...(window.DCOS_HYBRID.clinic||{}),id:clinicId,name:n};
    document.querySelectorAll('.hybrid-login-card>p').forEach(el=>el.textContent=n);
    document.querySelectorAll('.dashboard-hero h1,.pro-hero h1,.hero-content h1,.hero-card h1').forEach(el=>el.textContent=systemTitle(n));
    const b=document.getElementById('hybridRoleBadge');if(b){const role=(b.textContent.split('·')[0]||'').trim();b.textContent=role+' · '+n}
  }
  async function resolveName(){
    if(resolvedName)return applyName(resolvedName);
    const cached=localStorage.getItem('dcos_v15_clinic_name_'+clinicId)||localStorage.getItem('dcos_current_clinic_name');if(!invalid(cached))return applyName(cached);
    try{
      if(window.DCOS?.Store){await DCOS.Store.init();const c=await DCOS.Store.get('network/clinics/'+DCOS.safeId(clinicId),null);if(c&&!invalid(c.name))return applyName(c.name);const all=await DCOS.Store.list('network/clinics');const x=(all||[]).find(r=>String(r.id||r.clinicId||'')===clinicId);if(x&&!invalid(x.name))return applyName(x.name)}
    }catch(e){console.warn('clinic identity v15.53',e)}
  }
  if(resolvedName)applyName(resolvedName);
  function maintain(){if(resolvedName)applyName(resolvedName);else resolveName()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{maintain();setTimeout(maintain,500);setTimeout(maintain,1800)},{once:true});else maintain();
  document.addEventListener('dcos:clinic-ready',maintain);document.addEventListener('dcos:view-changed',()=>resolvedName&&applyName(resolvedName));
  const observer=new MutationObserver(muts=>{for(const m of muts)for(const n of m.addedNodes||[])if(n.nodeType===1&&(n.matches?.('.hybrid-login-card,.dashboard-hero,.pro-hero,.hero-content,.hero-card')||n.querySelector?.('.hybrid-login-card,.dashboard-hero,.pro-hero,.hero-content,.hero-card'))){maintain();return}});
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});

  const currency=v=>String(v||'SYP').toUpperCase()==='USD'?'USD':'SYP';
  const num=v=>Math.abs(Number(v||0));
  const billable=r=>{const s=String(r?.source||r?.type||r?.kind||'').toLowerCase();return !((s.includes('chart')||s.includes('dental'))&&!(r?.financialConfirmed===true||r?.billable===true||r?.completed===true||r?.status==='completed'))};
  function financeTotals(p){
    const f=typeof window.getPatientFinance==='function'?window.getPatientFinance(p):(p?.finance||{});
    const out={SYP:{totalCharges:0,totalPayments:0,rawPayments:0,paid:0,balance:0,credit:0},USD:{totalCharges:0,totalPayments:0,rawPayments:0,paid:0,balance:0,credit:0}};
    (Array.isArray(f?.charges)?f.charges:[]).filter(billable).forEach(x=>out[currency(x.currency)].totalCharges+=num(x.amount??x.cost??x.price));
    (Array.isArray(f?.payments)?f.payments:[]).forEach(x=>out[currency(x.currency)].rawPayments+=num(x.amount));
    Object.values(out).forEach(t=>{const applied=Math.min(t.totalCharges,t.rawPayments);t.totalPayments=applied;t.paid=applied;t.balance=Math.max(t.totalCharges-applied,0);t.credit=Math.max(t.rawPayments-t.totalCharges,0)});
    return out;
  }
  function installFinance(){window.getFinanceTotals=financeTotals;try{getFinanceTotals=financeTotals}catch(e){}}
  installFinance();setTimeout(installFinance,300);setTimeout(installFinance,1500);
})();
