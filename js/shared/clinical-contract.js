(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.DTDCClinicalContract=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const NAME="dtdc-clinical-link-v1";
  const VERSION=1;
  const TRANSPORT_PROTOCOL=5;
  const SERVICE_CATALOG=Object.freeze([
    {id:"restoration",name:"معالجة ترميمية",category:"restorative",stages:["تجريف محافظ للنخر","ترميم دائم","ترميم دائم","إنهاء"]},
    {id:"fiber-post",name:"وتد فايبر",category:"restorative",stages:["فتح الحجرة","تحديد القناة","التحضير للوتد","تثبيت الوتد","تخريش الدعامة","ترميم الدعامة","إنهاء"]},
    {id:"sensitivity",name:"علاج حساسية الأسنان",category:"restorative",stages:["علاج الحساسية"]},
    {id:"endo",name:"معالجة لبية",category:"endodontic",stages:["تجريف النخر","فتح الحجرة","اكتشاف الأقنية","تحضير الأقنية","حشو الأقنية","ختم حجروي","ترميم دائم","إنهاء"]},
    {id:"retreatment",name:"إعادة علاج العصب",category:"endodontic",stages:["فتح الحجرة","معالجة لبية","إنهاء"]},
    {id:"apicoectomy",name:"قطع الذروة",category:"surgery",stages:["سنكرة خاصة"]},
    {id:"fixed",name:"تعويض ثابت",category:"prosthodontic",stages:["تجهيز","تحضير","طبعات","التجربة","تثبيت","إنهاء"]},
    {id:"veneer",name:"وجه",category:"prosthodontic",stages:["تجهيز","تحضير","طبعات","التجربة","تهيئة","ترميل","تخريش","إلصاق","إنهاء"]},
    {id:"metal-core",name:"قلب ووتد معدني",category:"prosthodontic",stages:["فتح الحجرة","تحديد القناة","التحضير للوتد","طبعات","تجريب","إلصاق","إنهاء"]},
    {id:"partial-denture",name:"بدلة جزئية",category:"prosthodontic",stages:["طبعة","تجريب الصفائح والأسنان","إنهاء"]},
    {id:"full-denture",name:"بدلة كاملة",category:"prosthodontic",stages:["طبعة","كير","كير","تحديد البعد العمودي عند الراحة","تحديد البعد العمودي للإطباق","تجريب الصفائح والأسنان","تجريب الأسنان","التسليم","التسليم","التسليم","التسليم","إنهاء"]},
    {id:"fluoride",name:"تطبيق الفلورايد",category:"preventive",stages:["تطبيق الفلورايد"]},
    {id:"fissure-sealant",name:"سد الشقوق الوقائي للأطفال",category:"preventive",stages:["سد الشقوق الوقائي"]},
    {id:"space-maintainer",name:"حافظة مسافة",category:"pediatric",stages:["تحضير","تحضير","إنهاء"]},
    {id:"cleaning",name:"تنظيف وتقليح",category:"periodontal",stages:["تحضير","تقليح","تلميع","إنهاء"]},
    {id:"laser-whitening",name:"تبييض ليزري",category:"esthetic",stages:["تحضير","تقليح","تلميع","تبييض","إنهاء"]},
    {id:"home-whitening",name:"تبييض منزلي",category:"esthetic",stages:["تحضير","تقليح","تلميع","تبييض","بداية في المنزل","إنهاء"]},
    {id:"clear-ortho",name:"تقويم شفاف",category:"orthodontic",stages:["نتوءات","طبعات","قوالب الحركة","إنهاء"]},
    {id:"metal-ortho",name:"تقويم معدني",category:"orthodontic",stages:["تقويم معدني"]},
    {id:"periodontal-curettage",name:"تجريف لثة",category:"periodontal",stages:["سنكرة خاصة"]},
    {id:"gingivectomy",name:"قطع لثة",category:"periodontal",stages:["سنكرة خاصة"]},
    {id:"frenectomy",name:"تحرير اللجام",category:"surgery",stages:["سنكرة خاصة"]},
    {id:"cementation",name:"إلصاق",category:"prosthodontic",stages:["إلصاق"]},
    {id:"extraction",name:"قلع",category:"surgery",stages:["قلع"]},
    {id:"implant",name:"زرع",category:"surgery",stages:["سنكرة خاصة"]},
    {id:"quick-sync",name:"سنكرة خاصة",category:"general",stages:["سنكرة خاصة"]}
  ]);
  const SERVICE_BY_ID=new Map(SERVICE_CATALOG.map(item=>[item.id,item]));
  const SERVICE_BY_NAME=new Map(SERVICE_CATALOG.map(item=>[item.name,item]));
  const ALIASES=new Map([
    ["علاج لبية","endo"],["معالجة العصب","endo"],["عصب","endo"],
    ["حشوة","restoration"],["حشو","restoration"],["معالجة ترميمية","restoration"],
    ["وتد","fiber-post"],["فينير","veneer"],["تاج","fixed"],
    ["تبييض","laser-whitening"],["تقليح","cleaning"],["تنظيف","cleaning"]
  ]);

  function text(value){return String(value??"").trim();}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function serviceById(id){return SERVICE_BY_ID.get(text(id))||null;}
  function resolveServiceId(plan={}){
    const explicit=text(plan.serviceId||plan.layoutId);
    if(SERVICE_BY_ID.has(explicit))return explicit;
    const title=text(plan.serviceName||plan.title||plan.name);
    if(SERVICE_BY_NAME.has(title))return SERVICE_BY_NAME.get(title).id;
    for(const [alias,id] of ALIASES)if(title===alias||title.includes(alias))return id;
    return "quick-sync";
  }
  function cleanTeeth(value){
    const list=Array.isArray(value)?value:String(value||"").split(/[،,;\s]+/);
    return [...new Set(list.map(text).filter(Boolean))];
  }
  function normalizeTarget(plan={}){
    const source=plan.target&&typeof plan.target==="object"?plan.target:{};
    const teeth=cleanTeeth(source.teeth||plan.teeth||plan.tooth||"");
    const requested=text(source.type||plan.targetType);
    let type=["tooth","teeth","region","jaw","general"].includes(requested)?requested:"";
    if(!type)type=teeth.length>1?"teeth":teeth.length===1?"tooth":text(source.region||plan.region)?"region":"general";
    return {
      type,
      teeth,
      region:text(source.region||plan.region),
      jaw:text(source.jaw||plan.jaw),
      label:text(source.label||plan.targetLabel||plan.tooth)
    };
  }
  function normalizeStages(plan,service){
    const source=Array.isArray(plan.stages)&&plan.stages.length?plan.stages:Array.isArray(plan.steps)&&plan.steps.length?plan.steps:service.stages;
    return source.map((stage,index)=>{
      const item=typeof stage==="string"?{title:stage}:stage||{};
      return {
        stageId:text(item.stageId||item.id||`${service.id}-${index+1}`),
        index,
        title:text(item.title||item.text||service.stages[index]||`المرحلة ${index+1}`),
        done:Boolean(item.done),
        completedAt:text(item.completedAt)
      };
    });
  }
  function normalizePlan(plan={},index=0){
    const serviceId=resolveServiceId(plan),service=serviceById(serviceId)||serviceById("quick-sync");
    const target=normalizeTarget(plan),stages=normalizeStages(plan,service);
    return {
      planId:text(plan.planId||plan.id||`plan-${index+1}`),
      serviceId,
      serviceName:service.name,
      category:service.category,
      target,
      tooth:target.teeth[0]||text(plan.tooth),
      teeth:target.teeth,
      priority:["normal","urgent","high"].includes(text(plan.priority))?text(plan.priority):"normal",
      plannedSessions:Math.max(1,Number(plan.plannedSessions||plan.sessions||1)||1),
      cost:Math.max(0,Number(plan.cost||0)||0),
      currency:text(plan.currency||"SYP").toUpperCase()==="USD"?"USD":"SYP",
      note:text(plan.note||plan.notes),
      status:text(plan.status||"active")||"active",
      doctorName:text(plan.doctorName||plan.doctor),
      createdAt:text(plan.createdAt),
      updatedAt:text(plan.updatedAt),
      stages
    };
  }
  function normalizePatient(patient={}){
    const fullName=text(patient.fullName||patient.name);
    const fileNo=text(patient.fileNo||patient.fileNumber);
    return {
      patientId:text(patient.patientId||patient.id||fileNo),
      fileNo,
      fullName,
      firstName:text(patient.firstName||patient.displayName||fullName.split(/\s+/)[0]),
      gender:["male","female"].includes(text(patient.gender).toLowerCase())?text(patient.gender).toLowerCase():"",
      doctorName:text(patient.doctorName||patient.doctor),
      clinicId:text(patient.clinicId),
      clinicName:text(patient.clinicName),
      sessionId:text(patient.sessionId)
    };
  }
  function buildContext(patient={},meta={}){
    const normalizedPatient=normalizePatient({...patient,...meta});
    const source=Array.isArray(meta.plans)?meta.plans:Array.isArray(patient.treatmentPlans)?patient.treatmentPlans:[];
    return {
      type:"assistant_patient_context",
      contract:NAME,
      contractVersion:VERSION,
      protocol:TRANSPORT_PROTOCOL,
      contextId:text(meta.contextId)||`${normalizedPatient.patientId||normalizedPatient.fileNo||"patient"}-${Date.now()}`,
      patient:normalizedPatient,
      plans:source.filter(plan=>!["done","completed","closed","archived","deleted"].includes(text(plan.status||"active").toLowerCase())).map(normalizePlan),
      sentAt:text(meta.sentAt)||new Date().toISOString()
    };
  }
  function fingerprint(context){
    return JSON.stringify({patient:context.patient,plans:context.plans.map(plan=>({planId:plan.planId,serviceId:plan.serviceId,status:plan.status,updatedAt:plan.updatedAt,stages:plan.stages.map(stage=>[stage.stageId,stage.done])}))});
  }

  return Object.freeze({NAME,VERSION,TRANSPORT_PROTOCOL,SERVICE_CATALOG:clone(SERVICE_CATALOG),serviceById,resolveServiceId,normalizeTarget,normalizePlan,normalizePatient,buildContext,fingerprint});
});
