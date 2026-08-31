(function(){
"use strict";

const VERSION="15.72";
const contract=window.DTDCClinicalContract;
const palette=["#2563eb","#079247","#7c3aed","#db2777","#ea580c","#0891b2","#ca8a04","#4f46e5","#0f766e","#be123c","#9333ea","#0284c7"];
const bridgeColor="#c8a6df";
const fallbackServices=[
  "معاينة وتشخيص","معالجة ترميمية","علاج حساسية الأسنان","معالجة لبية","إعادة علاج العصب","وتد فايبر",
  "تعويض ثابت","وجه خزفي","قلب ووتد معدني","إلصاق","بدلة جزئية","بدلة كاملة","تنظيف وتقليح",
  "علاج لثوي","تطبيق الفلورايد","سد الشقوق الوقائي للأطفال","تبييض ليزري","تبييض منزلي",
  "تقويم شفاف","تقويم معدني","قلع","زرع","قطع الذروة","قطع لثة","تحرير اللجام","حافظة مسافة"
];
let bridgeMode=null;

const esc=value=>typeof window.escapeHtml==="function"?window.escapeHtml(String(value??"")):String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const current=()=>window.DCOS_getActivePatient?.()||window.DCOS_CHAIR_DISPLAY?.activePatient?.()||null;
const stamp=()=>typeof window.nowDateTime==="function"?window.nowDateTime():new Date().toISOString();
const doctor=()=>typeof window.getActiveDoctor==="function"?window.getActiveDoctor():"";
const save=()=>{if(typeof window.saveAll==="function")window.saveAll();else if(typeof window.savePatients==="function")window.savePatients(window.getPatients?.()||[])};

function hash(value){let result=0;for(const char of String(value||""))result=((result<<5)-result+char.charCodeAt(0))|0;return Math.abs(result)}
function serviceColor(name){return palette[hash(name)%palette.length]}
function normalizeServiceRecords(tooth={}){
  const source=Array.isArray(tooth.serviceRecords)?tooth.serviceRecords:Array.isArray(tooth.services)?tooth.services:[];
  return source.map((item,index)=>typeof item==="string"?{id:`legacy-${index}-${hash(item)}`,name:item,color:serviceColor(item),createdAt:tooth.updatedAt||"",doctor:tooth.doctor||""}:{
    id:String(item?.id||`service-${index}-${hash(item?.name)}`),name:String(item?.name||item?.label||""),color:String(item?.color||serviceColor(item?.name)),createdAt:String(item?.createdAt||item?.at||""),doctor:String(item?.doctor||"")
  }).filter(item=>item.name);
}
function clinicServiceNames(tooth={}){
  const priced=Array.isArray(window.DCOS1559?.getPrices?.())?window.DCOS1559.getPrices().map(item=>String(item?.name||"").trim()).filter(Boolean):[];
  const offered=priced.length?priced:fallbackServices;
  return [...new Set([...offered,...normalizeServiceRecords(tooth).map(item=>item.name)])];
}
function planList(p){return Array.isArray(p?.treatmentPlans)?p.treatmentPlans:[]}
function planTeeth(plan){
  if(contract?.normalizeTarget)return contract.normalizeTarget(plan).teeth.map(String);
  return [...new Set([...(Array.isArray(plan?.teeth)?plan.teeth:[]),plan?.tooth].map(String).filter(Boolean))];
}
function relatedPlans(p,num){return planList(p).filter(plan=>planTeeth(plan).includes(String(num)))}
function planStatus(plan){
  const steps=Array.isArray(plan?.steps)?plan.steps:Array.isArray(plan?.stages)?plan.stages:[];
  const done=steps.filter(step=>step?.done).length,percent=steps.length?Math.round(done*100/steps.length):0;
  if(["done","archived","closed","completed"].includes(String(plan?.status||"").toLowerCase()))return{key:"closed",label:"منتهية",percent:100};
  if(plan?.status==="ready_to_close"||percent===100)return{key:"ready",label:"جاهزة للإنهاء",percent};
  if(plan?.syncState==="pending")return{key:"sync",label:"بانتظار المزامنة",percent};
  if(plan?.priority==="urgent")return{key:"urgent",label:"عاجلة",percent};
  return{key:"active",label:"قيد العلاج",percent};
}
function bridgeList(p){p.dentalBridges=Array.isArray(p.dentalBridges)?p.dentalBridges:[];return p.dentalBridges}
function toothJaw(num){return /^(1|2|5|6)/.test(String(num))?"upper":"lower"}
function bridgeTypeLabel(type){return({porcelain:"خزف",pfm:"خزف معدن",zircon:"زركون"})[type]||type}

function planCards(p,num){
  const related=relatedPlans(p,num);
  if(!related.length)return'<p class="dcos-smart-empty">لا توجد خطة علاج مرتبطة بهذا السن.</p>';
  return related.map(plan=>{
    const status=planStatus(plan),events=Array.isArray(plan.clinicalEvents)?plan.clinicalEvents:[],last=events[events.length-1];
    return `<article class="dcos-smart-plan ${status.key}"><header><b>${esc(plan.serviceName||plan.title||"خطة علاج")}</b><span>${status.label} · ${status.percent}%</span></header><div class="dcos-smart-progress"><i style="width:${status.percent}%"></i></div>${last?`<p><small>آخر تسجيل من المساعد</small>${esc(last.summary||"")}</p>`:""}</article>`;
  }).join("");
}

function bridgeCards(p,num){
  const found=bridgeList(p).filter(item=>(item.teeth||[]).map(String).includes(String(num)));
  if(!found.length)return"";
  return `<section class="dcos-smart-bridges"><h4>الجسور المسجلة</h4>${found.map(item=>`<div><span style="--bridge-color:${esc(item.color||bridgeColor)}"></span><b>${esc(bridgeTypeLabel(item.type))}</b><small>${esc((item.teeth||[]).join("، "))}</small><button type="button" onclick="removeDentalBridge('${esc(item.id)}')">حذف</button></div>`).join("")}</section>`;
}

function openSmartToothModal(num){
  const p=current();if(!p)return;
  document.getElementById("toothModal")?.remove();
  p.teeth=p.teeth||{};const tooth=p.teeth[String(num)]||{states:[],note:""},records=normalizeServiceRecords(tooth),selected=new Set(records.map(item=>item.name));
  const modal=document.createElement("div");modal.className="modal tooth-modal tooth-modal-clean dcos-smart-tooth-modal";modal.id="toothModal";
  modal.innerHTML=`<div class="modalBox tooth-modal-box tooth-editor-box dcos-smart-tooth-box">
    <header class="tooth-editor-header"><div><h3>السن ${esc(window.getPalmerLabel?.(num)||num)}</h3><p>FDI ${esc(num)}</p></div><span>${esc(doctor()||"الطبيب غير محدد")}</span></header>
    <section class="dcos-smart-section"><h4>حالة خطط العلاج</h4>${planCards(p,num)}</section>
    ${bridgeCards(p,num)}
    <section class="dcos-smart-section dcos-service-picker"><div class="dcos-smart-section-title"><h4>الخدمات المسجلة على السن</h4><small>ألوانها تظهر تلقائياً على خريطة الأسنان</small></div>
      <div class="dcos-service-options">${clinicServiceNames(tooth).map(name=>{const color=serviceColor(name);return`<label class="dcos-service-option ${selected.has(name)?"selected":""}" style="--service-color:${color}"><input type="checkbox" data-service-name="${esc(name)}" data-service-color="${color}" ${selected.has(name)?"checked":""}><i></i><span>${esc(name)}</span></label>`}).join("")}</div>
    </section>
    <label class="dcos-smart-note"><span>ملاحظات السن</span><textarea id="toothNote" placeholder="ملاحظة العلاج أو الإجراء">${esc(tooth.note||"")}</textarea></label>
    <div class="modal-actions tooth-editor-actions"><button type="button" onclick="saveSmartTooth('${esc(num)}')">حفظ</button><button type="button" onclick="openTreatmentPlanManager('${esc(num)}')">🦷 إنشاء خطة علاج</button><button type="button" class="danger" onclick="clearSmartTooth('${esc(num)}')">تفريغ السن</button><button type="button" onclick="closeSmartToothModal()">إغلاق</button></div>
  </div>`;
  modal.addEventListener("click",event=>{if(event.target===modal)closeSmartToothModal()});
  modal.querySelectorAll(".dcos-service-option input").forEach(input=>input.addEventListener("change",()=>input.closest("label").classList.toggle("selected",input.checked)));
  document.body.appendChild(modal);
}
function closeSmartToothModal(){document.getElementById("toothModal")?.remove()}
function saveSmartTooth(num){
  const p=current(),modal=document.getElementById("toothModal");if(!p||!modal)return;
  p.teeth=p.teeth||{};const previous=p.teeth[String(num)]||{states:[]},oldRecords=normalizeServiceRecords(previous),oldByName=new Map(oldRecords.map(item=>[item.name,item]));
  const serviceRecords=[...modal.querySelectorAll(".dcos-service-option input:checked")].map(input=>{
    const name=String(input.dataset.serviceName||""),old=oldByName.get(name);return old||{id:`service-${Date.now()}-${hash(name)}`,name,color:String(input.dataset.serviceColor||serviceColor(name)),createdAt:stamp(),doctor:doctor()};
  });
  p.teeth[String(num)]={...previous,serviceRecords,services:serviceRecords.map(item=>item.name),note:String(modal.querySelector("#toothNote")?.value||"").trim(),doctor:doctor(),updatedAt:stamp()};
  save();closeSmartToothModal();window.renderToothChart?.();
}
function clearSmartTooth(num){
  const p=current();if(!p||!confirm(`هل تريد تفريغ بيانات السن ${num}؟`))return;
  p.teeth=p.teeth||{};delete p.teeth[String(num)];
  p.dentalBridges=bridgeList(p).filter(item=>!(item.teeth||[]).map(String).includes(String(num)));
  save();closeSmartToothModal();window.renderToothChart?.();
}

function typePicker(){
  document.getElementById("dcosBridgePicker")?.remove();
  const overlay=document.createElement("div");overlay.id="dcosBridgePicker";overlay.className="dcos-bridge-picker-overlay";
  overlay.innerHTML=`<div class="dcos-bridge-picker"><h3>إضافة جسر</h3><p>اختر نوع الجسر، ثم علّم الأسنان من الخريطة.</p><div><button type="button" data-type="porcelain">خزف</button><button type="button" data-type="pfm">خزف معدن</button><button type="button" data-type="zircon">زركون</button></div><button type="button" class="cancel">إلغاء</button></div>`;
  overlay.querySelectorAll("[data-type]").forEach(button=>button.onclick=()=>{bridgeMode={type:button.dataset.type,selected:new Set(),jaw:""};overlay.remove();decorateChart()});
  overlay.querySelector(".cancel").onclick=()=>overlay.remove();overlay.onclick=event=>{if(event.target===overlay)overlay.remove()};document.body.appendChild(overlay);
}
function cancelBridge(){bridgeMode=null;decorateChart()}
function toggleBridgeTooth(num){
  if(!bridgeMode)return;const jaw=toothJaw(num);
  if(bridgeMode.selected.size&&bridgeMode.jaw!==jaw){alert("يجب أن تكون أسنان الجسر ضمن الفك نفسه.");return}
  if(bridgeMode.selected.has(num))bridgeMode.selected.delete(num);else{bridgeMode.selected.add(num);bridgeMode.jaw=jaw}
  if(!bridgeMode.selected.size)bridgeMode.jaw="";decorateChart();
}
function saveDentalBridge(){
  const p=current();if(!p||!bridgeMode)return;const teeth=[...bridgeMode.selected];if(teeth.length<2)return alert("اختر سنّين على الأقل للجسر.");
  const id=`bridge-${Date.now()}`,type=bridgeMode.type,label=`جسر ${bridgeTypeLabel(type)}`,record={id,type,label,teeth,color:bridgeColor,createdAt:stamp(),doctor:doctor()};
  bridgeList(p).push(record);p.teeth=p.teeth||{};
  teeth.forEach(num=>{const tooth=p.teeth[num]||{states:[],note:""};tooth.states=Array.isArray(tooth.states)?tooth.states:[];if(!tooth.states.includes("bridge"))tooth.states.push("bridge");const records=normalizeServiceRecords(tooth).filter(item=>item.id!==`bridge-service-${id}`);records.push({id:`bridge-service-${id}`,name:label,color:bridgeColor,createdAt:record.createdAt,doctor:record.doctor,bridgeId:id});tooth.serviceRecords=records;tooth.services=records.map(item=>item.name);tooth.updatedAt=record.createdAt;p.teeth[num]=tooth});
  bridgeMode=null;save();window.renderToothChart?.();
}
function removeDentalBridge(id){
  const p=current();if(!p||!confirm("هل تريد حذف هذا الجسر من الخريطة؟"))return;
  const removed=bridgeList(p).find(item=>String(item.id)===String(id));p.dentalBridges=bridgeList(p).filter(item=>String(item.id)!==String(id));
  (removed?.teeth||[]).forEach(num=>{const tooth=p.teeth?.[String(num)];if(!tooth)return;tooth.serviceRecords=normalizeServiceRecords(tooth).filter(item=>String(item.bridgeId||"")!==String(id)&&String(item.id)!==`bridge-service-${id}`);tooth.services=tooth.serviceRecords.map(item=>item.name);if(!p.dentalBridges.some(item=>(item.teeth||[]).map(String).includes(String(num))))tooth.states=(tooth.states||[]).filter(state=>state!=="bridge")});
  save();closeSmartToothModal();window.renderToothChart?.();
}

function toothNumber(button){const match=String(button.getAttribute("onclick")||"").match(/openToothModal\(['\"]([^'\"]+)/);return match?.[1]||""}
function bridgeToolbar(container){
  container.querySelector(".dcos-bridge-toolbar")?.remove();if(!bridgeMode)return;
  const bar=document.createElement("div");bar.className="dcos-bridge-toolbar";bar.innerHTML=`<b>جسر ${esc(bridgeTypeLabel(bridgeMode.type))}</b><span>اختر الأسنان من الخريطة (${bridgeMode.selected.size})</span><button type="button" onclick="saveDentalBridge()">حفظ الجسر</button><button type="button" onclick="cancelDentalBridge()">إلغاء</button>`;container.prepend(bar);
}
function drawBridges(container,buttons){
  const stage=container.querySelector(".panorama-stage");if(!stage)return;stage.querySelectorAll(".dcos-bridge-overlay").forEach(node=>node.remove());
  const p=current(),stageRect=stage.getBoundingClientRect();if(!stageRect.width||!stageRect.height)return;
  const byTooth=new Map(buttons.map(button=>[button.dataset.tooth,button]));
  for(const item of bridgeList(p)){
    const points=(item.teeth||[]).map(String).map(num=>byTooth.get(num)).filter(Boolean).map(button=>{const rect=button.getBoundingClientRect();return{x:rect.left-stageRect.left+rect.width/2,y:rect.top-stageRect.top+rect.height*.35}}).sort((a,b)=>a.x-b.x);
    if(points.length<2)continue;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.classList.add("dcos-bridge-overlay");svg.setAttribute("viewBox",`0 0 ${stageRect.width} ${stageRect.height}`);svg.setAttribute("preserveAspectRatio","none");const path=document.createElementNS(svg.namespaceURI,"polyline");path.setAttribute("points",points.map(point=>`${point.x},${point.y}`).join(" "));path.setAttribute("style",`--bridge-color:${item.color||bridgeColor}`);svg.appendChild(path);stage.appendChild(svg);
  }
}
function decorateChart(){
  observer.disconnect();
  const container=document.getElementById("toothChart"),p=current();if(!container||!p){observeOutput();return}
  const head=container.querySelector(".panorama-map-head");if(head&&!head.querySelector(".dcos-add-bridge")){const button=document.createElement("button");button.type="button";button.className="dcos-add-bridge";button.textContent="＋ إضافة جسر";button.onclick=typePicker;head.appendChild(button)}
  bridgeToolbar(container);
  const buttons=[...container.querySelectorAll('button[onclick*="openToothModal"]')];
  buttons.forEach(button=>{
    const num=toothNumber(button);if(!num)return;button.dataset.tooth=num;button.classList.toggle("dcos-bridge-selected",Boolean(bridgeMode?.selected.has(num)));
    button.querySelector(".dcos-tooth-service-dots")?.remove();const records=normalizeServiceRecords(p.teeth?.[num]||{});if(records.length){const dots=document.createElement("span");dots.className="dcos-tooth-service-dots";records.slice(0,4).forEach(item=>{const dot=document.createElement("i");dot.style.background=item.color||serviceColor(item.name);dots.appendChild(dot)});button.appendChild(dots)}
  });
  drawBridges(container,buttons);
  observeOutput();
}

const oldRender=window.renderToothChart;
if(typeof oldRender==="function")window.renderToothChart=function(){const result=oldRender.apply(this,arguments);requestAnimationFrame(decorateChart);return result};
window.openToothModal=openSmartToothModal;
window.closeSmartToothModal=closeSmartToothModal;
window.closeToothModal=closeSmartToothModal;
window.saveSmartTooth=saveSmartTooth;
window.clearSmartTooth=clearSmartTooth;
window.openDentalBridgePicker=typePicker;
window.saveDentalBridge=saveDentalBridge;
window.cancelDentalBridge=cancelBridge;
window.removeDentalBridge=removeDentalBridge;

document.addEventListener("click",event=>{
  if(!bridgeMode)return;const button=event.target.closest?.('#toothChart button[data-tooth]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();toggleBridgeTooth(button.dataset.tooth);
},true);
window.addEventListener("resize",()=>requestAnimationFrame(decorateChart));
let decorateScheduled=false;
const observer=new MutationObserver(()=>{
  if(decorateScheduled)return;decorateScheduled=true;
  requestAnimationFrame(()=>{decorateScheduled=false;decorateChart()});
});
function observeOutput(){observer.observe(document.getElementById("output")||document.body,{childList:true,subtree:true})}
function init(){observeOutput();decorateChart();window.DCOS1572={version:VERSION,decorateChart,openDentalBridgePicker:typePicker}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
