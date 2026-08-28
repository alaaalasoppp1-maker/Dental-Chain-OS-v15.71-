'use strict';
/* Dental Chain OS v15.59 — per-clinic RX image template + clinic price list. */
(function(){
  const VERSION='15.60';
  const ADMIN_PASSWORD=window.ADMIN_PASS||'DTDC2026';
  const DEFAULT_TEMPLATE='rx-template.png';
  const H=()=>window.DCOS_HYBRID||{};
  const role=()=>String(H().account?.role||document.documentElement.getAttribute('data-dcos-role')||'').toLowerCase();
  const clinicId=()=>String(H().clinic?.id||new URLSearchParams(location.search).get('clinic')||localStorage.getItem('dcos_v15_last_clinic')||'taher-main-clinic');
  const clinicName=()=>String(H().clinic?.name||new URLSearchParams(location.search).get('clinicName')||'عيادة أ.د. طاهر الأجا');
  const canView=()=>['doctor','manager','super_owner'].includes(role());
  const canEdit=()=>['manager','super_owner'].includes(role());
  const rxKey=()=>`dcos_v1558_rx_template_${clinicId()}`;
  const priceKey=()=>`dcos_v1558_price_list_${clinicId()}`;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch(e){return f}};
  const write=(k,v)=>{localStorage.setItem(k,JSON.stringify(v));return v};
  const normalizePrices=x=>Array.isArray(x)?x:[];
  const normalizeTemplate=x=>({dataUrl:String(x?.dataUrl||''),fileName:String(x?.fileName||''),updatedAt:String(x?.updatedAt||'')});
  let rxTemplate=normalizeTemplate(read(rxKey(),null));
  let prices=normalizePrices(read(priceKey(),[]));

  async function cloudGet(name){try{if(!window.DCOS?.Store)return null;await DCOS.Store.init();return await DCOS.Store.get(`clinics/${clinicId()}/settings/${name}`)}catch(e){console.warn('v15.59 cloud get',e);return null}}
  async function cloudSet(name,value){try{if(!window.DCOS?.Store)return;await DCOS.Store.init();await DCOS.Store.set(`clinics/${clinicId()}/settings/${name}`,{...value,clinicId:clinicId(),updatedAt:new Date().toISOString()})}catch(e){console.warn('v15.59 cloud set',e);throw e}}
  async function hydrate(){
    const [cloudTemplate,cloudPrices]=await Promise.all([cloudGet('rxTemplate'),cloudGet('priceList')]);
    if(cloudTemplate?.dataUrl){rxTemplate=normalizeTemplate(cloudTemplate);write(rxKey(),rxTemplate)}
    if(cloudPrices?.items){prices=normalizePrices(cloudPrices.items);write(priceKey(),prices)}
    applyRxTemplate();
  }

  function closeDialog(){document.getElementById('dcos1558Overlay')?.remove()}
  function dialog(html){closeDialog();const o=document.createElement('div');o.id='dcos1558Overlay';o.className='dcos-overlay';o.innerHTML=`<div class="dcos-dialog">${html}</div>`;o.addEventListener('click',e=>{if(e.target===o)closeDialog()});document.body.appendChild(o);return o}
  function verifyAdmin(label='إدارة قائمة الأسعار'){if(!canEdit()){alert('التعديل متاح لمدير العيادة والسوبر أونر فقط.');return false}const p=prompt(`أدخل كلمة سر ${label}:`);if(p!==ADMIN_PASSWORD){alert('كلمة السر غير صحيحة');return false}return true}

  function injectPriceButton(){
    const host=document.querySelector('.primary-patient-actions');
    if(!host||document.getElementById('dcosPriceListBtn'))return;
    const b=document.createElement('button');b.id='dcosPriceListBtn';b.type='button';b.className='dcos-price-btn';b.textContent='الأسعار';b.onclick=openPriceList;host.appendChild(b);syncVisibility();
  }
  function syncVisibility(){const b=document.getElementById('dcosPriceListBtn');if(b)b.style.display=canView()?'':'none'}
  function formatPrice(v,c){const n=Number(v||0);return c==='USD'?`$ ${n.toLocaleString('en-US')}`:`${n.toLocaleString('en-US')} ل.س`}
  function openPriceList(){
    if(!canView()){alert('هذه القائمة متاحة للطبيب والمدير والسوبر أونر فقط.');return}
    const rows=prices.length?prices.map(x=>`<div class="dcos-price-row" data-search="${esc((x.name||'')+' '+(x.category||''))}"><b>${esc(x.name)}</b><small>${esc(x.category||'غير مصنف')}</small><span>${formatPrice(x.syp,'SYP')}</span><span>${formatPrice(x.usd,'USD')}</span><small>${esc(x.note||'')}</small></div>`).join(''):`<div class="dcos-price-empty">لم تُضف أسعار بعد.</div>`;
    dialog(`<h2>قائمة أسعار ${esc(clinicName())}</h2><div class="dcos-price-toolbar"><input id="dcosPriceSearch" placeholder="ابحث عن خدمة أو قسم..."><button id="dcosPriceEditOpen" class="green" ${canEdit()?'':'style="display:none"'}>تعديل القائمة</button></div><div id="dcosPriceRows" class="dcos-price-list">${rows}</div><div class="dcos-dialog-actions"><button id="dcosPriceClose">إغلاق</button></div>`);
    document.getElementById('dcosPriceSearch').oninput=e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#dcosPriceRows .dcos-price-row').forEach(r=>r.style.display=!q||r.dataset.search.toLowerCase().includes(q)?'':'none')};
    document.getElementById('dcosPriceClose').onclick=closeDialog;
    const eb=document.getElementById('dcosPriceEditOpen');if(eb)eb.onclick=()=>{if(verifyAdmin())openPriceEditor()};
  }
  function priceEditorRows(){return prices.map((x,i)=>`<div class="dcos-price-edit-row" data-i="${i}"><input data-f="name" value="${esc(x.name)}" placeholder="اسم الخدمة"><input data-f="category" value="${esc(x.category||'')}" placeholder="القسم: علاج عصب، حشوات..."><input data-f="syp" type="number" value="${Number(x.syp||0)}" placeholder="ل.س"><input data-f="usd" type="number" value="${Number(x.usd||0)}" placeholder="$"><input data-f="note" value="${esc(x.note||'')}" placeholder="ملاحظة"><button class="danger" data-del="${i}">حذف</button></div>`).join('')}
  function collectPriceEditor(){return [...document.querySelectorAll('.dcos-price-edit-row')].map(r=>({name:r.querySelector('[data-f=name]').value.trim(),category:r.querySelector('[data-f=category]').value.trim(),syp:Number(r.querySelector('[data-f=syp]').value||0),usd:Number(r.querySelector('[data-f=usd]').value||0),note:r.querySelector('[data-f=note]').value.trim()})).filter(x=>x.name)}
  function openPriceEditor(){
    dialog(`<h2>إدارة قائمة أسعار العيادة</h2><p>القائمة مستقلة لهذه العيادة ولا تؤثر على مالية المرضى أو التقارير.</p><div class="dcos-category-help"><b>ما المقصود بالقسم؟</b> هو تجميع الخدمات المتشابهة لتسهيل العرض والبحث، مثل: معاينات، حشوات، علاج عصب، جراحة، تعويضات، أطفال. ويمكن تركه فارغًا.</div><div id="dcosPriceEditRows">${priceEditorRows()}</div><div class="dcos-dialog-actions"><button id="dcosAddPrice">➕ إضافة بند</button><button id="dcosSavePrices" class="primary">حفظ القائمة</button><button id="dcosCancelPrices">إلغاء</button></div>`);
    document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{prices=collectPriceEditor();prices.splice(Number(b.dataset.del),1);openPriceEditor()});
    document.getElementById('dcosAddPrice').onclick=()=>{prices=collectPriceEditor();prices.push({name:'',category:'',syp:0,usd:0,note:''});openPriceEditor()};
    document.getElementById('dcosSavePrices').onclick=async()=>{prices=collectPriceEditor();write(priceKey(),prices);try{await cloudSet('priceList',{items:prices});alert('تم حفظ قائمة الأسعار لهذه العيادة.')}catch(e){alert('تم الحفظ على هذا الجهاز، لكن تعذرت المزامنة مع Firebase.')}openPriceList()};
    document.getElementById('dcosCancelPrices').onclick=openPriceList;
  }

  function currentTemplateSrc(){return rxTemplate.dataUrl||DEFAULT_TEMPLATE}
  function applyRxTemplate(){
    document.querySelectorAll('.rx-page .template-image').forEach(img=>{const src=currentTemplateSrc();if(img.getAttribute('src')!==src)img.src=src});
    document.querySelectorAll('.dcos-rx-template-overlay').forEach(el=>el.remove());
  }
  function dataUrlBytes(dataUrl){return Math.ceil((dataUrl.length-(dataUrl.indexOf(',')+1))*3/4)}
  function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('تعذر قراءة الصورة'))};img.src=url})}
  async function compressTemplate(file){
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type))throw new Error('اختر صورة PNG أو JPG أو WebP.');
    const img=await loadImage(file);const maxW=1443,maxH=2048;const scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight);const w=Math.max(1,Math.round(img.naturalWidth*scale));const h=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    let quality=.88;let dataUrl=canvas.toDataURL('image/jpeg',quality);while(dataUrlBytes(dataUrl)>720000&&quality>.48){quality-=.08;dataUrl=canvas.toDataURL('image/jpeg',quality)}
    if(dataUrlBytes(dataUrl)>850000)throw new Error('الصورة كبيرة جدًا. استخدم صورة A5 أو قلّل دقتها ثم أعد المحاولة.');
    return dataUrl;
  }
  function openRxTemplateUploader(){
    if(!canEdit()){alert('رفع قالب الوصفة متاح للمدير والسوبر أونر فقط.');return}
    dialog(`<h2>🖼️ قالب وصفة هذه العيادة</h2><p>ارفع صورة القالب كاملة بالمقاس الطولي A5. سيتم استخدامها لهذه العيادة فقط في المعاينة والطباعة.</p><div class="dcos-rx-upload-layout"><div class="dcos-rx-upload-controls"><label class="dcos-file-picker">اختيار صورة القالب<input id="dcosRxFile" type="file" accept="image/png,image/jpeg,image/webp"></label><small>يفضّل PNG أو JPG بنسبة A5 طولية. سيضغطها النظام تلقائيًا لتقليل الحجم.</small><div id="dcosRxUploadStatus"></div></div><div class="dcos-rx-upload-preview"><img id="dcosRxPreview" src="${esc(currentTemplateSrc())}" alt="معاينة القالب"></div></div><div class="dcos-dialog-actions"><button id="dcosSaveRxUpload" class="primary" disabled>حفظ القالب لهذه العيادة</button><button id="dcosResetRxUpload">استرجاع القالب الافتراضي</button><button id="dcosCloseRxUpload">إغلاق</button></div>`);
    let pending='';const fileInput=document.getElementById('dcosRxFile');const status=document.getElementById('dcosRxUploadStatus');const save=document.getElementById('dcosSaveRxUpload');
    fileInput.onchange=async()=>{const file=fileInput.files?.[0];if(!file)return;status.textContent='جارٍ تجهيز الصورة...';save.disabled=true;try{pending=await compressTemplate(file);document.getElementById('dcosRxPreview').src=pending;status.textContent=`جاهزة للحفظ — ${Math.round(dataUrlBytes(pending)/1024)} كيلوبايت`;save.disabled=false}catch(e){pending='';status.textContent=e.message||'تعذر تجهيز الصورة'}};
    save.onclick=async()=>{if(!pending)return;rxTemplate={dataUrl:pending,fileName:fileInput.files?.[0]?.name||'clinic-rx-template.jpg',updatedAt:new Date().toISOString()};write(rxKey(),rxTemplate);applyRxTemplate();save.disabled=true;status.textContent='جارٍ الحفظ والمزامنة...';try{await cloudSet('rxTemplate',rxTemplate);alert('تم حفظ قالب الوصفة لهذه العيادة.');closeDialog()}catch(e){alert('تم حفظ القالب على هذا الجهاز، لكن تعذرت مزامنته مع Firebase.');status.textContent='محفوظ محليًا فقط'}};
    document.getElementById('dcosResetRxUpload').onclick=async()=>{if(!verifyAdmin('استرجاع قالب الوصفة الافتراضي'))return;rxTemplate=normalizeTemplate(null);localStorage.removeItem(rxKey());applyRxTemplate();try{await cloudSet('rxTemplate',rxTemplate)}catch(e){}alert('تم استرجاع القالب الافتراضي.');closeDialog()};
    document.getElementById('dcosCloseRxUpload').onclick=closeDialog;
  }
  function injectRxUploadButton(){
    if(!canEdit())return;
    const card=document.querySelector('#output .rx-manager');if(!card||card.querySelector('.dcos-rx-template-edit-btn'))return;
    const b=document.createElement('button');b.type='button';b.className='dcos-rx-template-edit-btn';b.textContent='🖼️ تحميل قالب لهذه العيادة';b.onclick=openRxTemplateUploader;card.appendChild(b);
  }

  document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.altKey&&String(e.key).toLowerCase()==='p'){e.preventDefault();if(verifyAdmin())openPriceEditor()}});
  let scheduled=false;const refresh=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;injectPriceButton();syncVisibility();injectRxUploadButton();applyRxTemplate()})};
  const obs=new MutationObserver(refresh);
  function init(){refresh();obs.observe(document.body,{childList:true,subtree:true});hydrate();window.DCOS1559={openPriceList,openPriceEditor,openRxTemplateUploader,getPrices:()=>prices,getTemplate:()=>rxTemplate,version:VERSION}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
