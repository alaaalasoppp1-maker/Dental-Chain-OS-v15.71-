'use strict';
(function(){
  const H=()=>window.DCOS_HYBRID||{};
  const params=new URLSearchParams(location.search);
  const clinicId=String(params.get('clinic')||H().clinic?.id||localStorage.getItem('dcos_v15_last_clinic')||'').trim();
  const bad=v=>{const s=String(v||'').trim();return !s||s===clinicId||s==='العيادة'||s==='عيادة العيادة'||/^clinic[_-]/i.test(s)||/^branch[_-]/i.test(s)};
  const candidateName=o=>String(o?.clinicName||o?.name||o?.title||'').trim();
  function localCandidates(){
    const out=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||'';
      if(!/clinic|account|network/i.test(k))continue;
      try{const v=JSON.parse(localStorage.getItem(k));if(Array.isArray(v))out.push(...v);else if(v&&typeof v==='object')out.push(v)}catch(e){}
    }
    return out;
  }
  async function directFirebase(){
    try{
      if(!window.firebase)return null;
      let app;try{app=firebase.app('dcos-v15')}catch(e){app=firebase.initializeApp(window.DCOS_CONFIG,'dcos-v15')}
      const db=app.firestore();
      const direct=await db.collection('network').doc('clinics').get().catch(()=>null);
      if(direct?.exists){
        const d=direct.data();const rows=Array.isArray(d)?d:Object.values(d||{});
        const c=rows.find(x=>String(x?.id||x?.clinicId||'')===clinicId&&!bad(candidateName(x)));if(c)return c;
      }
      const snap=await db.collection('network').doc('clinics').collection('items').get().catch(()=>null);
      if(snap){let found=null;snap.forEach(doc=>{const x={id:doc.id,...doc.data()};if(!found&&String(x.id||x.clinicId||'')===clinicId&&!bad(candidateName(x)))found=x});if(found)return found}
      const doc=await db.doc('network/clinics/'+clinicId).get().catch(()=>null);if(doc?.exists)return {id:doc.id,...doc.data()};
    }catch(e){console.warn('v15.52 firebase clinic lookup',e)}
    return null;
  }
  async function resolve(){
    const tries=[];
    tries.push(H().clinic);
    const cached=localStorage.getItem('dcos_v15_clinic_name_'+clinicId)||localStorage.getItem('dcos_current_clinic_name');
    if(!bad(cached))return cached;
    try{
      if(window.DCOS?.Store){
        await DCOS.Store.init();
        tries.push(await DCOS.getClinic?.(clinicId));
        const all=await DCOS.getClinics?.()||[];
        tries.push(all.find(x=>String(x?.id||x?.clinicId||'')===clinicId));
        const accounts=await DCOS.Store.list('clinics/'+clinicId+'/accounts').catch(()=>[]);
        tries.push((accounts||[]).find(x=>!bad(x?.clinicName)));
      }
    }catch(e){console.warn('v15.52 clinic store lookup',e)}
    tries.push(await directFirebase());
    tries.push(localCandidates().find(x=>String(x?.id||x?.clinicId||'')===clinicId&&!bad(candidateName(x))));
    for(const x of tries){const n=candidateName(x);if(!bad(n))return n}
    return '';
  }
  function title(name){name=String(name||'').trim();if(!name)return 'نظام العيادة';if(/^نظام\s+/.test(name))return name;if(/^عيادة\s+/.test(name))return 'نظام '+name;return 'نظام عيادة '+name}
  function apply(name){
    if(!name)return;
    H().clinic={...(H().clinic||{}),id:clinicId,name};
    localStorage.setItem('dcos_v15_clinic_name_'+clinicId,name);
    localStorage.setItem('dcos_current_clinic_name',name);
    document.querySelectorAll('.hybrid-login-card>p').forEach(el=>el.textContent=name);
    document.querySelectorAll('.dashboard-hero h1,.pro-hero h1,.hero-content h1,.hero-card h1').forEach(el=>el.textContent=title(name));
    const badge=document.getElementById('hybridRoleBadge');if(badge){const role=(badge.textContent.split('·')[0]||'').trim();badge.textContent=role+' · '+name}
  }
  async function refresh(){const n=await resolve();if(n)apply(n);else document.querySelectorAll('.hybrid-login-card>p').forEach(el=>{if(/^clinic[_-]/i.test(el.textContent.trim()))el.textContent='اسم العيادة قيد التحميل…'})}
  async function boot(){for(const delay of [0,350,1000,2500,5000])setTimeout(refresh,delay)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  document.addEventListener('dcos:clinic-ready',refresh);
  new MutationObserver(()=>{const p=document.querySelector('.hybrid-login-card>p');if(p&&(/^clinic[_-]/i.test(p.textContent.trim())||p.textContent.trim()==='العيادة'))refresh()}).observe(document.documentElement,{childList:true,subtree:true});

  // Patient finance guard: advances stay payments/credit and never inflate treatment total.
  const isBillable=r=>{const s=String(r?.source||r?.type||r?.kind||'').toLowerCase();const chartOnly=(s.includes('chart')||s.includes('dental'))&&!(r?.financialConfirmed===true||r?.billable===true||r?.completed===true||r?.status==='completed');return !chartOnly};
  if(typeof window.getFinanceTotals==='function'){
    window.getFinanceTotals=function(p){
      const f=typeof window.getPatientFinance==='function'?getPatientFinance(p):(p?.finance||{});
      const out={SYP:{totalCharges:0,totalPayments:0,paid:0,balance:0,credit:0},USD:{totalCharges:0,totalPayments:0,paid:0,balance:0,credit:0}};
      const cur=v=>String(v||'SYP').toUpperCase()==='USD'?'USD':'SYP';const num=v=>Math.abs(Number(v||0));
      (Array.isArray(f.charges)?f.charges:[]).filter(isBillable).forEach(x=>out[cur(x.currency)].totalCharges+=num(x.amount??x.cost??x.price));
      (Array.isArray(f.payments)?f.payments:[]).forEach(x=>out[cur(x.currency)].totalPayments+=num(x.amount));
      Object.values(out).forEach(t=>{t.paid=Math.min(t.totalCharges,t.totalPayments);t.balance=Math.max(t.totalCharges-t.totalPayments,0);t.credit=Math.max(t.totalPayments-t.totalCharges,0)});
      return out;
    };
  }
})();
