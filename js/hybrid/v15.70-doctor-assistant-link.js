(function(){
"use strict";
const VERSION="15.72-clinical-link";
const contract=window.DTDCClinicalContract;
if(!contract)return console.error("DTDC clinical contract is missing");

const esc=value=>typeof window.escapeHtml==="function"?window.escapeHtml(String(value??"")):String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const current=()=>{try{return patient||window.DCOS_getActivePatient?.()||window.DCOS_CHAIR_DISPLAY?.activePatient?.()||null}catch{return window.DCOS_CHAIR_DISPLAY?.activePatient?.()||null}};
const plans=p=>{if(!p)return[];p.treatmentPlans=Array.isArray(p.treatmentPlans)?p.treatmentPlans:[];return p.treatmentPlans};
const now=()=>typeof window.nowDateTime==="function"?window.nowDateTime():new Date().toISOString();
const doctor=()=>typeof window.getActiveDoctor==="function"?window.getActiveDoctor():"";

function targetLabel(plan){
  const target=contract.normalizeTarget(plan);
  if(target.type==="general")return"عام";
  if(target.type==="jaw")return target.jaw||target.label||"فك";
  if(target.type==="region")return target.region||target.label||"منطقة";
  return target.teeth.length?`الأسنان: ${target.teeth.join("، ")}`:(target.label||"غير محدد");
}
function options(selected=""){
  return contract.SERVICE_CATALOG.map(item=>`<option value="${esc(item.id)}" ${item.id===selected?"selected":""}>${esc(item.name)}</option>`).join("");
}
function stagePreview(serviceId){
  const service=contract.serviceById(serviceId)||contract.serviceById("quick-sync");
  return service.stages.map((title,index)=>`<span><b>${index+1}</b>${esc(title)}</span>`).join("");
}
function normalizeLegacy(plan,index){
  const normalized=contract.normalizePlan(plan,index);
  if(!plan.serviceId)plan.serviceId=normalized.serviceId;
  if(!plan.serviceName)plan.serviceName=normalized.serviceName;
  if(!plan.target)plan.target=normalized.target;
  if(!plan.priority)plan.priority=normalized.priority;
  if(!plan.plannedSessions)plan.plannedSessions=normalized.plannedSessions;
  return normalized;
}
function renderSummary(p){
  const list=plans(p);
  if(!list.length)return'<p class="dtdc-plan-empty">لا توجد خطة علاج بعد.</p>';
  const renderCard=(plan,index)=>{
    const normalized=normalizeLegacy(plan,index),steps=Array.isArray(plan.steps)?plan.steps:normalized.stages.map(stage=>({text:stage.title,done:stage.done}));
    const done=steps.filter(step=>step.done).length,percent=steps.length?Math.round(done*100/steps.length):0,isDone=plan.status==="done"||plan.status==="archived",ready=plan.status==="ready_to_close"||(!isDone&&percent===100);
    const statusClass=isDone?"closed":ready?"ready":plan.syncState==="pending"?"sync-pending":"active",statusLabel=isDone?"مكتملة ومؤرشفة":ready?"جاهزة للإنهاء من المساعد":plan.syncState==="pending"?"بانتظار المزامنة":"قيد التنفيذ في المساعد";
    const clinicalEvents=Array.isArray(plan.clinicalEvents)?plan.clinicalEvents:[],lastEvent=clinicalEvents[clinicalEvents.length-1];
    return `<article class="treatment-plan-card dtdc-linked-plan ${isDone?"completed-plan":""}" data-plan-id="${esc(normalized.planId)}">
      <div class="plan-top"><b>${esc(normalized.serviceName)}</b><span>${isDone?100:percent}%</span></div>
      <div class="dtdc-plan-tags"><small>${esc(targetLabel(plan))}</small><small>${normalized.priority==="urgent"?"عاجلة":normalized.priority==="high"?"أولوية عالية":"عادية"}</small><small>${normalized.plannedSessions} جلسة</small></div>
      <div class="plan-progress"><i style="width:${isDone?100:percent}%"></i></div>
      ${plan.note?`<p>${esc(plan.note)}</p>`:""}
      <div class="plan-meta-line"><small>${Number(plan.cost||0).toLocaleString("en-US")} ${String(plan.currency||"SYP").toUpperCase()==="USD"?"$":"ل.س"}</small><small class="dtdc-status ${statusClass}">${statusLabel}</small></div>
      <div class="plan-steps dtdc-readonly-steps">${steps.map((step,stepIndex)=>`<div class="${step.done?"done-step":""}"><i>${step.done?"✓":stepIndex+1}</i><span>${esc(step.text||step.title||"")}</span>${step.completedAt?`<time>${esc(new Date(step.completedAt).toLocaleString("ar"))}</time>`:""}</div>`).join("")}</div>
      ${lastEvent?`<div class="dtdc-plan-last-event"><small>آخر تسجيل من المساعد · ${esc(new Date(lastEvent.at||lastEvent.createdAt||Date.now()).toLocaleString("ar"))}</small><b>${esc(lastEvent.summary||lastEvent.kind||"")}</b></div>`:""}
      <div class="dtdc-plan-actions"><button type="button" onclick="editTreatmentPlan(${index})" ${isDone?"disabled":""}>✏️ تعديل</button><button type="button" onclick="deleteTreatmentPlan(${index})">🗑 حذف</button></div>
    </article>`;
  };
  const active=list.map((plan,index)=>({plan,index})).filter(item=>!["done","archived"].includes(item.plan.status)),completed=list.map((plan,index)=>({plan,index})).filter(item=>["done","archived"].includes(item.plan.status));
  return `<div class="treatment-plan-list v4-treatment-list dtdc-linked-plans">${active.map(item=>renderCard(item.plan,item.index)).join("")||'<p class="dtdc-plan-empty">لا توجد خطط فعالة.</p>'}</div>${completed.length?`<details class="dtdc-completed-plans"><summary>الخطط المكتملة (${completed.length})</summary><div class="dtdc-linked-plans">${completed.map(item=>renderCard(item.plan,item.index)).join("")}</div></details>`:""}`;
}

function openManager(toothNumber="",editIndex=-1){
  const p=current();if(!p)return alert("افتح ملف مريض أولاً");
  const index=Number(editIndex),editing=Number.isInteger(index)&&index>=0&&plans(p)[index];
  const source=editing?plans(p)[index]:{},normalized=contract.normalizePlan({...source,tooth:source.tooth||toothNumber},index>=0?index:plans(p).length);
  const target=contract.normalizeTarget({...source,tooth:source.tooth||toothNumber});
  const targetValue=target.type==="tooth"||target.type==="teeth"?target.teeth.join("، "):target.type==="region"?target.region:target.type==="jaw"?target.jaw:target.label;
  document.getElementById("output").innerHTML=`<div class="card treatment-manager dtdc-assistant-plan-manager">
    <div class="dtdc-manager-title"><div><small>DTDC Clinical Link</small><h2>خطة المساعد الطبي — ${esc(p.name||p.fullName||"")}</h2></div><span>عقد الربط v1</span></div>
    <form class="treatment-form dtdc-plan-form" onsubmit="event.preventDefault();saveDTDCLinkedPlan()">
      <input type="hidden" id="planEditIndex" value="${editing?index:""}">
      <label>نوع الخدمة<select id="planServiceId" required>${options(normalized.serviceId)}</select></label>
      <label>نوع المنطقة المستهدفة<select id="planTargetType"><option value="tooth" ${target.type==="tooth"?"selected":""}>سن واحد</option><option value="teeth" ${target.type==="teeth"?"selected":""}>عدة أسنان</option><option value="region" ${target.type==="region"?"selected":""}>منطقة</option><option value="jaw" ${target.type==="jaw"?"selected":""}>فك</option><option value="general" ${target.type==="general"?"selected":""}>عام</option></select></label>
      <label class="dtdc-target-field">التحديد<input id="planTargetValue" value="${esc(targetValue)}" placeholder="مثال: 24 أو 14، 15 أو الفك العلوي"></label>
      <label>الأولوية<select id="planPriority"><option value="normal" ${normalized.priority==="normal"?"selected":""}>عادية</option><option value="high" ${normalized.priority==="high"?"selected":""}>عالية</option><option value="urgent" ${normalized.priority==="urgent"?"selected":""}>عاجلة</option></select></label>
      <label>عدد الجلسات المخطط<input id="planSessions" type="number" min="1" max="99" value="${normalized.plannedSessions}"></label>
      <label>التكلفة<input id="planCost" type="number" min="0" step="any" value="${Number(source.cost||0)}"></label>
      <label>العملة<select id="planCurrency"><option value="SYP" ${normalized.currency==="SYP"?"selected":""}>ل.س</option><option value="USD" ${normalized.currency==="USD"?"selected":""}>$</option></select></label>
      <label class="dtdc-wide">ملاحظات الخطة<textarea id="planNote" placeholder="تعليمات مهمة للطبيب أو للجلسة">${esc(source.note||"")}</textarea></label>
      <div class="dtdc-wide"><b>تسلسل الشاشات المعتمد في تطبيق المساعد</b><div id="dtdcStagePreview" class="dtdc-stage-preview">${stagePreview(normalized.serviceId)}</div></div>
      <div class="dtdc-wide dtdc-form-actions"><button class="primary" type="submit">${editing?"حفظ التعديلات":"إضافة وإرسال الخطة"}</button>${editing?'<button type="button" onclick="openTreatmentPlanManager()">إلغاء التعديل</button>':""}</div>
    </form>
    <h3>الخطط الحالية</h3>${renderSummary(p)}
    <button type="button" onclick="openPatient(patient)">رجوع لملف المريض</button>
  </div>`;
  document.getElementById("backBtn").style.display="block";
  const service=document.getElementById("planServiceId"),targetType=document.getElementById("planTargetType"),targetField=document.querySelector(".dtdc-target-field");
  service.onchange=()=>document.getElementById("dtdcStagePreview").innerHTML=stagePreview(service.value);
  const updateTarget=()=>{const general=targetType.value==="general";targetField.hidden=general;if(general)document.getElementById("planTargetValue").value=""};targetType.onchange=updateTarget;updateTarget();
}

function readTarget(){
  const type=document.getElementById("planTargetType")?.value||"general",value=String(document.getElementById("planTargetValue")?.value||"").trim();
  const teeth=(type==="tooth"||type==="teeth")?value.split(/[،,;\s]+/).map(item=>item.trim()).filter(Boolean):[];
  return {type,teeth,region:type==="region"?value:"",jaw:type==="jaw"?value:"",label:value};
}
function sync(force=true){const p=current();if(!p)return Promise.resolve(false);return Promise.resolve(window.DCOS_CHAIR_DISPLAY?.selectPatient?.(p,force)).catch(()=>false)}
function saveLinkedPlan(){
  const p=current();if(!p)return;
  const serviceId=document.getElementById("planServiceId")?.value||"",service=contract.serviceById(serviceId);if(!service)return alert("اختر نوع الخدمة");
  const target=readTarget();if(target.type!=="general"&&!target.label)return alert("حدد السن أو المنطقة المستهدفة");
  const indexText=document.getElementById("planEditIndex")?.value??"",index=indexText===""?-1:Number(indexText),list=plans(p),old=index>=0?list[index]:null;
  const oldStages=old?contract.normalizePlan(old,index).stages:[];
  const steps=service.stages.map((title,stageIndex)=>{const previous=oldStages[stageIndex]?.title===title?oldStages[stageIndex]:null;return{stageId:`${serviceId}-${stageIndex+1}`,text:title,done:Boolean(previous?.done),completedAt:previous?.completedAt||""}});
  const plan={
    ...(old||{}),id:old?.id||Date.now(),planId:String(old?.planId||old?.id||`PLAN-${Date.now()}`),serviceId,serviceName:service.name,layoutId:serviceId,title:service.name,category:service.category,
    target,tooth:target.teeth[0]||"",teeth:target.teeth,priority:document.getElementById("planPriority")?.value||"normal",plannedSessions:Math.max(1,Number(document.getElementById("planSessions")?.value||1)||1),
    steps,stages:steps.map((step,stageIndex)=>({stageId:step.stageId,index:stageIndex,title:step.text,done:step.done,completedAt:step.completedAt})),
    cost:Math.max(0,Number(document.getElementById("planCost")?.value||0)||0),currency:document.getElementById("planCurrency")?.value==="USD"?"USD":"SYP",note:String(document.getElementById("planNote")?.value||"").trim(),
    status:old?.status||"active",doctor:doctor()||old?.doctor||"",doctorName:doctor()||old?.doctorName||old?.doctor||"",createdAt:old?.createdAt||now(),updatedAt:now()
  };
  try{window.pushUndoSnapshot?.(old?"تعديل خطة المساعد":"إضافة خطة المساعد")}catch{}
  if(old){try{window.removeTreatmentPlanFinanceCharge?.(old)}catch{}list[index]=plan}else list.push(plan);
  try{window.syncTreatmentPlanFinance?.(plan)}catch{}
  try{window.auditPatientAction?.(p,old?"تعديل خطة علاج":"إضافة خطة علاج",`${service.name} - ${targetLabel(plan)}`)}catch{}
  if(typeof window.saveAll==="function")window.saveAll();else if(typeof window.savePatients==="function")window.savePatients(typeof window.getPatients==="function"?window.getPatients():[p]);
  sync(true);openManager();
}
function edit(index){openManager("",Number(index))}

function samePatientIdentity(candidate,patientId,fileNo){
  if(!candidate)return false;
  const localIds=[candidate.id,candidate.patientId,candidate.fileNo,candidate.fileNumber].map(value=>String(value||"")).filter(Boolean);
  const remoteIds=[patientId,fileNo].map(value=>String(value||"")).filter(Boolean);
  return remoteIds.some(value=>localIds.includes(value));
}

function applyClinicalEvents(events){
  if(!Array.isArray(events)||!events.length)return;
  const patientList=typeof window.getPatients==="function"?window.getPatients():[],active=current();let changed=false;
  for(const event of events){
    const p=patientList.find(item=>samePatientIdentity(item,event.patientId,event.fileNo))||(samePatientIdentity(active,event.patientId,event.fileNo)?active:null);
    if(!p)continue;
    const plan=plans(p).find(item=>String(item.planId||item.id)===String(event.planId||""));if(!plan)continue;
    const payload=event.payload||{};plan.assistantSessions=Array.isArray(plan.assistantSessions)?plan.assistantSessions:[];
    if(event.type==="assistant_stage_updated"){
      const stageId=String(event.stageId||payload.stageId||""),completed=Boolean(payload.completed??payload.status==="completed");
      for(const collection of [plan.steps,plan.stages]){(collection||[]).forEach(step=>{if(String(step.stageId||step.id)===stageId){step.done=completed;step.status=payload.status||"completed";step.completedAt=payload.completedAt||event.createdAt;step.summary=payload.summary||step.summary||""}})}
      plan.progress=Number(payload.progress||0);plan.status=payload.planStatus||plan.status||"active";plan.lastCompletedStageId=completed?stageId:plan.lastCompletedStageId;plan.lastAssistantUpdateAt=event.createdAt;
    }
    if(event.type==="assistant_session_saved"){
      if(!plan.assistantSessions.some(item=>String(item.sessionId)===String(payload.sessionId)))plan.assistantSessions.push({sessionId:payload.sessionId,completedAt:payload.completedAt||event.createdAt,summary:payload.summary||""});
      const completed=new Set(payload.completedStageIds||[]);(plan.steps||[]).forEach(step=>{if(completed.has(step.stageId)){step.done=true;step.completedAt=payload.completedAt||event.createdAt}});plan.lastSessionAt=payload.completedAt||event.createdAt;
    }
    if(event.type==="assistant_event"){
      const eventId=String(payload.eventId||payload.id||event.eventId||"");
      plan.clinicalEvents=Array.isArray(plan.clinicalEvents)?plan.clinicalEvents:[];
      if(!eventId||!plan.clinicalEvents.some(item=>String(item.eventId||item.id||"")===eventId)){
        plan.clinicalEvents.push({
          eventId,id:eventId,at:payload.at||event.createdAt,createdAt:event.createdAt,
          kind:String(payload.kind||"clinical_action"),summary:String(payload.summary||"تم تسجيل إجراء سريري"),
          screenId:String(payload.screenId||""),screenTitle:String(payload.screenTitle||""),stage:String(payload.stage||""),
          tooth:String(payload.tooth||""),canal:String(payload.canal||""),serviceId:String(payload.serviceId||plan.serviceId||""),treatment:String(payload.treatment||""),
          details:payload.details&&typeof payload.details==="object"?JSON.parse(JSON.stringify(payload.details)):{},
          action:String(payload.action||""),control:String(payload.control||""),value:payload.value??null
        });
        if(plan.clinicalEvents.length>1500)plan.clinicalEvents.splice(0,plan.clinicalEvents.length-1500);
      }
      plan.lastAssistantAction=String(payload.summary||"");
      plan.lastAssistantUpdateAt=payload.at||event.createdAt;
    }
    if(event.type==="assistant_plan_closed"){
      plan.status="done";plan.doneAt=event.createdAt;plan.doctorDone=payload.doctorName||plan.doctorName||plan.doctor||"";
      try{window.applyTreatmentPlanToTooth?.(plan);window.auditPatientAction?.(p,"إتمام خطة علاج من المساعد",plan.serviceName||plan.title||"")}catch{}
    }
    plan.updatedAt=event.createdAt;changed=true;
  }
  if(changed){
    if(typeof window.savePatients==="function")window.savePatients(patientList);
    try{const refreshed=patientList.find(item=>active&&String(item.id||item.fileNo||"")===String(active.id||active.fileNo||""));if(refreshed)patient=refreshed}catch{}
    sync(true);
    if(document.querySelector(".dtdc-assistant-plan-manager"))setTimeout(()=>openManager(),0);
  }
}
function reconcileSnapshot(context){
  if(!context?.patient||!Array.isArray(context.plans))return;const active=current();if(!samePatientIdentity(active,context.patient.patientId,context.patient.fileNo))return;let changed=false;
  for(const closed of Array.isArray(context.closedPlans)?context.closedPlans:[]){const local=plans(active).find(item=>String(item.planId||item.id)===String(closed.planId||""));if(local&&!['done','archived'].includes(local.status)){local.status='done';local.doneAt=closed.closedAt||now();local.doctorDone=closed.doctorName||local.doctorName||local.doctor||'';try{window.applyTreatmentPlanToTooth?.(local)}catch{}changed=true}}
  for(const remote of context.plans){const local=plans(active).find(item=>String(item.planId||item.id)===String(remote.planId));if(!local)continue;const remoteStages=Array.isArray(remote.stages)?remote.stages:[];for(const collection of [local.steps,local.stages]){(collection||[]).forEach(step=>{const found=remoteStages.find(item=>String(item.stageId)===String(step.stageId||step.id));if(found&&Boolean(step.done)!==Boolean(found.done)){step.done=Boolean(found.done);step.completedAt=found.completedAt||step.completedAt||"";changed=true}})}if(remote.status&&local.status!==remote.status){local.status=remote.status;changed=true}if(Number.isFinite(remote.progress)&&local.progress!==remote.progress){local.progress=remote.progress;changed=true}}
  if(changed){localSave();if(document.querySelector(".dtdc-assistant-plan-manager"))setTimeout(()=>openManager(),0)}
}
function localSave(){if(typeof window.saveAll==="function")window.saveAll();else if(typeof window.savePatients==="function")window.savePatients(typeof window.getPatients==="function"?window.getPatients():[])}
let lastEventAt=Number(sessionStorage.getItem("dtdc_clinical_events_since")||0);
async function pollEvents(){
  try{const response=await fetch(`http://127.0.0.1:8765/clinical/events?since=${lastEventAt}`,{cache:"no-store",credentials:"omit"});if(!response.ok)return;const data=await response.json();applyClinicalEvents(data.events||[]);reconcileSnapshot(data.context);lastEventAt=Math.max(lastEventAt,Number(data.latestAt||0));sessionStorage.setItem("dtdc_clinical_events_since",String(lastEventAt))}catch{}
}

const oldDelete=window.deleteTreatmentPlan,oldToggle=window.toggleTreatmentStep,oldMark=window.markTreatmentPlanDone;
window.openTreatmentPlanManager=openManager;
window.renderTreatmentPlanSummary=renderSummary;
window.addTreatmentPlan=saveLinkedPlan;
window.saveDTDCLinkedPlan=saveLinkedPlan;
window.editTreatmentPlan=edit;
if(typeof oldDelete==="function")window.deleteTreatmentPlan=function(){const result=oldDelete.apply(this,arguments);setTimeout(()=>sync(true),0);return result};
if(typeof oldToggle==="function")window.toggleTreatmentStep=function(index){const linked=plans(current())[Number(index)];if(linked?.serviceId){alert("تُسجّل هذه المرحلة تلقائياً من تطبيق مساعد الطبيب.");return false}const result=oldToggle.apply(this,arguments);setTimeout(()=>sync(true),0);return result};
if(typeof oldMark==="function")window.markTreatmentPlanDone=function(index){const linked=plans(current())[Number(index)];if(linked?.serviceId){alert("إنهاء الخطة يتم بالضغط المطوّل على بطاقتها في تطبيق المساعد.");return false}const result=oldMark.apply(this,arguments);setTimeout(()=>sync(true),0);return result};

const SERVICE_TOOTH_EFFECTS=Object.freeze({
  restoration:["filling"],"fissure-sealant":["filling"],endo:["rootCanal"],retreatment:["rootCanal"],apicoectomy:["rootCanal"],
  "fiber-post":["fiberPost"],"metal-core":["fiberPost"],fixed:["crown"],veneer:["crown"],cementation:["crown"],implant:["implant"],extraction:["extraction"]
});
function planTeeth(plan){return contract.normalizeTarget(plan).teeth.map(String)}
function linkedPlansForTooth(p,num){return plans(p).filter(plan=>planTeeth(plan).includes(String(num)))}
function workflowStatus(plan){const stages=Array.isArray(plan.steps)?plan.steps:plan.stages||[],done=stages.filter(stage=>stage.done).length,percent=stages.length?Math.round(done*100/stages.length):0;if(["done","archived"].includes(plan.status))return{key:"completed",label:"مكتملة",percent:100};if(plan.status==="ready_to_close"||percent===100)return{key:"ready",label:"جاهزة للإنهاء",percent};if(plan.syncState==="pending")return{key:"sync",label:"بانتظار المزامنة",percent};if(plan.priority==="urgent")return{key:"attention",label:"عاجلة",percent};return{key:"active",label:"قيد التنفيذ",percent}}
const legacyApplyToTooth=window.applyTreatmentPlanToTooth;
window.applyTreatmentPlanToTooth=function(plan){
  const p=current();if(!p||!plan||!["done","archived"].includes(plan.status))return;const effects=SERVICE_TOOTH_EFFECTS[plan.serviceId]||[],teeth=planTeeth(plan);if(!effects.length||!teeth.length)return;
  p.teeth=p.teeth||{};for(const num of teeth){const tooth=p.teeth[num]||{states:[],note:""};tooth.states=Array.isArray(tooth.states)?tooth.states:[];effects.forEach(effect=>{if(!tooth.states.includes(effect))tooth.states.push(effect)});const marker=`[${plan.planId||plan.id}]`,line=`${marker} خطة مكتملة: ${plan.serviceName||plan.title||""}`;if(!String(tooth.note||"").includes(marker))tooth.note=String(tooth.note||"").trim()?`${tooth.note}\n${line}`:line;tooth.updatedAt=plan.doneAt||now();tooth.doctor=plan.doctorDone||plan.doctorName||plan.doctor||doctor();p.teeth[num]=tooth}
  localSave();try{window.renderToothChart?.()}catch{}
};
const legacyRenderPanoramaTooth=window.renderPanoramaTooth;
if(typeof legacyRenderPanoramaTooth==="function")window.renderPanoramaTooth=function(num){
  let html=legacyRenderPanoramaTooth.apply(this,arguments),p=current(),tooth=p?.teeth?.[String(num)]||{},related=linkedPlansForTooth(p,num);if((tooth.states||[]).includes("fiberPost"))html=html.replace('class="','class="tooth-fiber-post ');if(!related.length)return html;const rank={attention:5,sync:4,active:3,ready:2,completed:1},ranked=related.map(workflowStatus).sort((a,b)=>rank[b.key]-rank[a.key])[0];
  html=html.replace('class="','class="dtdc-plan-ring dtdc-plan-'+ranked.key+' ').replace('</button>',`<span class="dtdc-tooth-plan-badge">${related.length}</span></button>`);return html;
};
const legacyOpenToothModal=window.openToothModal;
if(typeof legacyOpenToothModal==="function")window.openToothModal=function(num){
  const result=legacyOpenToothModal.apply(this,arguments),p=current(),related=linkedPlansForTooth(p,num),box=document.querySelector("#toothModal .tooth-modal-box");if(!box)return result;const tooth=p?.teeth?.[String(num)]||{states:[]},stateNames={extraction:"مفقود / قلع",rootCanal:"معالجة لبية",filling:"ترميم",crown:"تتويج",implant:"زرعة",bridge:"جسر",watch:"مراقبة",fiberPost:"وتد فايبر"};
  const section=document.createElement("section");section.className="dtdc-tooth-workflow";section.innerHTML=`<div class="dtdc-tooth-current"><b>الحالة السريرية الحالية</b><div>${(tooth.states||[]).map(state=>`<span>${esc(stateNames[state]||state)}</span>`).join("")||'<small>لا توجد حالة مسجلة</small>'}</div></div><div class="dtdc-tooth-plans"><b>خطط هذا السن</b>${related.map(plan=>{const status=workflowStatus(plan),stages=plan.steps||plan.stages||[],last=[...stages].reverse().find(stage=>stage.done);return`<article class="${status.key}"><header><strong>${esc(plan.serviceName||plan.title||"")}</strong><span>${status.percent}% · ${status.label}</span></header><div class="plan-progress"><i style="width:${status.percent}%"></i></div>${last?`<small>آخر مرحلة مكتملة: ${esc(last.text||last.title||"")}</small>`:""}</article>`}).join("")||'<small>لا توجد خطة مرتبطة بهذا السن</small>'}</div><p>التعديلات اليدوية أدناه مخصصة لتصحيح السجل السريري فقط؛ تقدم الخطة يأتي تلقائياً من تطبيق المساعد.</p>`;const grid=box.querySelector(".tooth-state-grid");if(grid&&!grid.querySelector('input[value="fiberPost"]')){const label=document.createElement("label");label.className=`tooth-state-pill ${(tooth.states||[]).includes("fiberPost")?"active":""}`;label.innerHTML=`<input type="checkbox" value="fiberPost" ${(tooth.states||[]).includes("fiberPost")?"checked":""}> وتد فايبر`;label.querySelector("input").addEventListener("change",event=>label.classList.toggle("active",event.target.checked));grid.appendChild(label)}box.insertBefore(section,grid||box.firstChild);return result;
};
window.DTDC_ASSISTANT_LINK={version:VERSION,contract,sync,pollEvents};
setInterval(pollEvents,5000);setTimeout(pollEvents,1200);
})();
