'use strict';
/* Dental Chain OS v15.61 — adaptive layout and patient timeline side roll. */
(function(){
  const VERSION='15.61';
  let scheduled=false;
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();

  function forceWesternPriceDigits(){
    document.querySelectorAll('.dcos-price-row span').forEach(el=>{
      const text=el.textContent||'';
      const western=text.replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
      if(western!==text)el.textContent=western;
    });
  }

  function hideDuplicateFinanceButton(){
    const card=document.querySelector('#output .patient-main-card');
    if(!card)return;
    card.querySelectorAll('button').forEach(btn=>{
      const t=norm(btn.textContent);
      if(t.includes('الكشف المالي')&&!t.includes('أقساط'))btn.classList.add('dcos-hide-duplicate-finance');
    });
  }

  function findTimelineSection(){
    const card=document.querySelector('#output .patient-main-card');
    if(!card)return null;
    const heading=[...card.querySelectorAll('h2,h3')].find(h=>norm(h.textContent)==='الخط الزمني');
    if(!heading)return null;
    let content=heading.nextElementSibling;
    while(content&&content.tagName==='HR')content=content.nextElementSibling;
    if(!content)return null;
    return {heading,content};
  }

  function closeTimeline(){
    document.getElementById('dcosTimelineDrawer')?.classList.remove('open');
    document.getElementById('dcosTimelineBackdrop')?.classList.remove('open');
  }

  function openTimeline(){
    document.getElementById('dcosTimelineDrawer')?.classList.add('open');
    document.getElementById('dcosTimelineBackdrop')?.classList.add('open');
  }

  function removeTimelineUi(){
    document.getElementById('dcosTimelineTab')?.remove();
    document.getElementById('dcosTimelineDrawer')?.remove();
    document.getElementById('dcosTimelineBackdrop')?.remove();
  }

  function buildTimelineRoll(){
    const section=findTimelineSection();
    if(!section){removeTimelineUi();return}
    section.heading.classList.add('dcos-inline-timeline-hidden');
    section.content.classList.add('dcos-inline-timeline-hidden');

    let tab=document.getElementById('dcosTimelineTab');
    let drawer=document.getElementById('dcosTimelineDrawer');
    if(!tab){
      tab=document.createElement('button');
      tab.type='button';tab.id='dcosTimelineTab';tab.className='dcos-timeline-tab';
      tab.innerHTML='<span>🕘</span> الخط الزمني';
      tab.addEventListener('click',openTimeline);
      document.body.appendChild(tab);
    }
    if(!document.getElementById('dcosTimelineBackdrop')){
      const backdrop=document.createElement('div');
      backdrop.id='dcosTimelineBackdrop';backdrop.className='dcos-timeline-backdrop';backdrop.addEventListener('click',closeTimeline);document.body.appendChild(backdrop);
    }
    if(!drawer){
      drawer=document.createElement('aside');drawer.id='dcosTimelineDrawer';drawer.className='dcos-timeline-drawer';
      drawer.innerHTML='<div class="dcos-timeline-drawer-head"><h3>الخط الزمني للمريض</h3><button type="button" aria-label="إغلاق">×</button></div><div class="dcos-timeline-drawer-body"></div>';
      drawer.querySelector('button').addEventListener('click',closeTimeline);document.body.appendChild(drawer);
    }
    const body=drawer.querySelector('.dcos-timeline-drawer-body');
    const html=section.content.innerHTML;
    if(body.dataset.sourceHtml!==html){body.innerHTML=html;body.dataset.sourceHtml=html}
  }

  function hideAudit(){
    document.querySelectorAll('#output .audit-section-wrap').forEach(el=>el.setAttribute('aria-hidden','true'));
  }

  function refresh(){
    scheduled=false;
    hideAudit();
    hideDuplicateFinanceButton();
    buildTimelineRoll();
    forceWesternPriceDigits();
  }
  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(refresh)}

  function init(){
    queue();
    const root=document.getElementById('output')||document.body;
    new MutationObserver(queue).observe(root,{childList:true,subtree:true});
    document.addEventListener('dcos:view-changed',queue);
    window.DCOS1561={refresh,openTimeline,closeTimeline,version:VERSION};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
