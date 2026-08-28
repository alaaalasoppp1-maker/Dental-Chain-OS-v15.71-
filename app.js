let patient = null;

let rxType = "";
let selectedMeds = [];
let rxHistory = [];
let rxPreview = null;
let currentProtocolList = [];
let currentProtocolName = "";
let rxPregnantMode = false;

/* =========================
   STORAGE + IDS
========================= */
function getPatients(){
return JSON.parse(localStorage.getItem("patients")) || [];
}

function savePatients(list){
localStorage.setItem("patients", JSON.stringify(list));
}

function padNumber(n){
return String(n).padStart(4,"0");
}

function getNextPatientNumber(){
let patients = getPatients();
let max = 0;
patients.forEach(p=>{
let raw = (p.fileNo || "").replace("P-","");
let num = parseInt(raw,10);
if(!isNaN(num) && num > max) max = num;
});
return "P-" + padNumber(max + 1);
}

function ensurePatientFileNo(p){
if(!p.fileNo){
p.fileNo = getNextPatientNumber();
}
return p;
}

function nowDateTime(){
const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
let h = d.getHours();
const m = String(d.getMinutes()).padStart(2,"0");
const s = String(d.getSeconds()).padStart(2,"0");
const ampm = h >= 12 ? "PM" : "AM";
h = h % 12;
if(h === 0) h = 12;
return `${date} ${h}:${m}:${s} ${ampm}`;
}


function prescriptionPrintDate(value){
const raw = String(value || "").trim();
if(!raw) return "";
const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
if(isoMatch) return isoMatch[1];
const localMatch = raw.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
if(localMatch) return localMatch[1];
return raw.split(" ")[0] || raw;
}

function getFieldValue(id){
const el=document.getElementById(id);
return el ? el.value : "";
}

function setFieldValue(id,value){
const el=document.getElementById(id);
if(el) el.value = value || "";
}

function normalizePatientGender(value){
value=String(value||"").toLowerCase();
return value==="male" || value==="female" ? value : "";
}

function getSelectedPatientGender(){
const selected=document.querySelector('#dcosPatientGenderField [data-dcos-gender]:checked, #dcosPatientGenderProfile [data-dcos-gender]:checked');
return normalizePatientGender(selected ? selected.value : "");
}

function setSelectedPatientGender(value){
const gender=normalizePatientGender(value);
document.querySelectorAll('[data-dcos-gender]').forEach(input=>{ input.checked=input.value===gender; });
return gender;
}

function fillPatientFields(p){
setFieldValue("fileNo", p.fileNo || "");
setFieldValue("name", p.name || "");
setFieldValue("age", p.age || "");
setFieldValue("phone", p.phone || "");
setFieldValue("allergy", p.allergy || "");
setFieldValue("chronic", p.chronic || "");
setFieldValue("notes", p.notes || "");
}

/* =========================
   PATIENT CORE
========================= */
function getCurrentPatient(){

const name = getFieldValue("name").trim();
const phone = getFieldValue("phone").trim();
const fileNo = getFieldValue("fileNo").trim();

if(!name) return null;

let patients = getPatients();

let found = patients.find(p =>
(fileNo && (p.fileNo || "") === fileNo) ||
((p.name || "").trim().toLowerCase() === name.toLowerCase()) ||
(phone && (p.phone || "").trim() === phone)
);

if(found){
patient = ensurePatientFileNo(found);
fillPatientFields(patient);
saveAll();
return patient;
}

return null;
}

function registerPatient(){

const name = getFieldValue("name").trim();
const age = getFieldValue("age");
const phone = getFieldValue("phone").trim();
const allergy = getFieldValue("allergy");
const chronic = getFieldValue("chronic");
const notes = getFieldValue("notes");

if(!name){
alert("أدخل اسم المريض");
return;
}

let patients = getPatients();

let duplicate = patients.find(p =>
((p.name || "").trim().toLowerCase() === name.toLowerCase()) ||
(phone && (p.phone || "").trim() === phone)
);

if(duplicate){
duplicate = ensurePatientFileNo(duplicate);
alert("انتبه لوجود ملف سابق للمريض");
openPatient(duplicate);
savePatients(patients);
return;
}

patient = {
fileNo:getNextPatientNumber(),
name,
age,
phone,
allergy,
chronic,
notes,
visits:[],
prescriptions:[]
};

patients.push(patient);
savePatients(patients);

alert("تم تسجيل المريض بنجاح");
openPatient(patient);
}

function saveAll(){

if(!patient) return;
patient = ensurePatientFileNo(patient);

let patients = getPatients();
let exists = false;

patients = patients.map(p=>{
if((p.fileNo && p.fileNo === patient.fileNo) || p.name === patient.name){
exists = true;
return patient;
}
return p;
});

if(!exists) patients.push(patient);

savePatients(patients);
}

/* =========================
   VISITS
========================= */
function openVisit(){

const p = getCurrentPatient();

if(!p){
alert("سجّل المريض أولاً أو افتح ملفه من قائمة المرضى");
return;
}

patient = p;
document.getElementById("visitModal").classList.remove("hidden");
}

function closeVisit(){
document.getElementById("visitModal").classList.add("hidden");
}

function saveVisit(){

if(!patient){
alert("لا يوجد مريض محدد");
return;
}

let text = getFieldValue("visitText").trim();

if(!text){
alert("اكتب ملاحظات الزيارة");
return;
}

patient.visits.push({
date:nowDateTime(),
text
});

setFieldValue("visitText", "");

saveAll();
closeVisit();
openPatient(patient);
}

/* =========================
   PATIENTS
========================= */
function showPatients(){

document.getElementById("output").innerHTML=`
<h3>المرضى</h3>
<div id="list"></div>
`;

document.getElementById("searchBox").style.display="block";
document.getElementById("backBtn").style.display="block";

renderPatients(getPatients());
}

function renderPatients(list){

let container=document.getElementById("list");
if(!container) return;

container.innerHTML="";

list.forEach(p=>{
ensurePatientFileNo(p);
let div=document.createElement("div");
div.className="card";

div.innerHTML=`
<b>${p.name || ""}</b><br>
رقم الملف: ${p.fileNo || ""}<br>
العمر: ${p.age || ""}<br>
الهاتف: ${p.phone || ""}<br>
التحسس الدوائي: ${p.allergy || ""}<br>
الأمراض المزمنة: ${p.chronic || ""}<br>
${p.notes || ""}
`;

div.onclick=()=>openPatient(p);

container.appendChild(div);

});
savePatients(getPatients().map(p=>ensurePatientFileNo(p)));
}

function searchPatients(){

let q=getFieldValue("searchInput").trim().toLowerCase();
let patients=getPatients();

let filtered=patients.filter(p =>
(p.name || "").toLowerCase().includes(q) ||
(p.phone || "").includes(q) ||
(p.fileNo || "").toLowerCase().includes(q)
);

renderPatients(filtered);
renderSuggestions(q, patients, filtered);

let btn=document.getElementById("createNewBtn");

if(q && filtered.length===0){
btn.style.display="inline-block";
btn.dataset.name=q;
}else{
btn.style.display="none";
btn.dataset.name="";
}
}

function renderSuggestions(q, patients, filtered){

let box=document.getElementById("suggestionsBox");
if(!box) return;

box.innerHTML="";

if(!q || q.length < 2) return;

let filteredKeys = filtered.map(p => (p.fileNo || "") + "|" + (p.name || ""));

let suggestions = patients
.filter(p => !filteredKeys.includes((p.fileNo || "") + "|" + (p.name || "")))
.map(p => ({ patient:p, score:similarity(q, (p.name || "").toLowerCase()) }))
.filter(x => x.score >= 0.45)
.sort((a,b)=>b.score-a.score)
.slice(0,5);

if(suggestions.length===0) return;

box.innerHTML=`
<h4>اقتراحات مشابهة:</h4>
${suggestions.map((x,i)=>`
<div class="suggestion-item" data-index="${i}">
<b>${x.patient.name || ""}</b><br>
<small>${x.patient.fileNo || ""} - ${x.patient.phone || ""}</small>
</div>
`).join("")}
`;

box.querySelectorAll(".suggestion-item").forEach((el,i)=>{
el.onclick = ()=>openPatientFromSuggestion(suggestions[i].patient);
});
}

function similarity(a,b){
let distance = levenshtein(a,b);
let maxLen = Math.max(a.length,b.length);
if(maxLen === 0) return 1;
return 1 - distance / maxLen;
}

function levenshtein(a,b){
let matrix=[];
for(let i=0;i<=b.length;i++) matrix[i]=[i];
for(let j=0;j<=a.length;j++) matrix[0][j]=j;
for(let i=1;i<=b.length;i++){
for(let j=1;j<=a.length;j++){
if(b.charAt(i-1) === a.charAt(j-1)) matrix[i][j]=matrix[i-1][j-1];
else matrix[i][j]=Math.min(matrix[i-1][j-1]+1,matrix[i][j-1]+1,matrix[i-1][j]+1);
}
}
return matrix[b.length][a.length];
}

function openPatientFromSuggestion(p){
openPatient(p);
const box=document.getElementById("suggestionsBox");
if(box) box.innerHTML="";
}

function createNewPatientFromSearch(){

let searchedName=document.getElementById("createNewBtn").dataset.name;

setFieldValue("fileNo", "");
setFieldValue("name", searchedName);
setFieldValue("age", "");
setFieldValue("phone", "");
setFieldValue("allergy", "");
setFieldValue("chronic", "");
setFieldValue("notes", "");

document.getElementById("searchBox").style.display="none";
document.getElementById("output").innerHTML="";

alert("أكمل معلومات المريض ثم اضغط تسجيل مريض");
}


/* =========================
   DASHBOARD + FINANCE + TIMELINE HELPERS
========================= */

function getClinicStats(){
let patients = getPatients();
let visits = 0;
let prescriptions = 0;
let totalCharges = 0;
let totalPayments = 0;

patients.forEach(p=>{
visits += (p.visits || []).length;
prescriptions += (p.prescriptions || []).length;

let finance = p.finance || {charges:[], payments:[]};
(finance.charges || []).forEach(x=> totalCharges += Number(x.amount || 0));
(finance.payments || []).forEach(x=> totalPayments += Number(x.amount || 0));
});

return {
patients:patients.length,
visits,
prescriptions,
balance:totalCharges - totalPayments
};
}

function renderDashboard_legacy_v10_disabled(){

let stats = getClinicStats();
let today = new Date().toLocaleDateString();

const output = document.getElementById("output");
if(!output) return;

output.innerHTML = `
<section class="dashboard-hero">
<div class="hero-glow"></div>
<div class="hero-content">
<div>
<span class="hero-label">Clinic EMR</span>
<h1>د. طاهر الأجا</h1>
<p>DDS, PhD-Endodontics · نظام إدارة العيادة</p>
</div>
<div class="hero-date">${today}</div>
</div>
</section>

<section class="stats-grid">
<button type="button" class="stat-card stat-card-btn" onclick="showPatients()">
<span>👥</span>
<b>${stats.patients}</b>
<small>المرضى</small>
</button>
<button type="button" class="stat-card stat-card-btn" onclick="openRxLibraryManager()">
<span>🧾</span>
<b>${stats.prescriptions}</b>
<small>الوصفات</small>
</button>
<div class="stat-card">
<span>🦷</span>
<b>${stats.visits}</b>
<small>الزيارات</small>
</div>
<div class="stat-card">
<span>💰</span>
<b>${formatMoney(stats.balance)}</b>
<small>الرصيد المتبقي</small>
</div>
</section>

<section class="quick-actions">
<button onclick="exportBackup()">📦 نسخة احتياطية</button>
</section>

<section class="dashboard-note">
ابدأ بإدخال بيانات المريض بالأعلى، أو افتح ملف مريض من قائمة المرضى.
</section>
`;

const backBtn = document.getElementById("backBtn");
if(backBtn) backBtn.style.display = "none";
if(typeof DCOS_bindDashboardCounters === "function") DCOS_bindDashboardCounters();
}

function formatMoney(value){
let n = Number(value || 0);
return n.toLocaleString();
}

function getPatientFinance(p){
p.finance = p.finance || {charges:[], payments:[]};
p.finance.charges = p.finance.charges || [];
p.finance.payments = p.finance.payments || [];
return p.finance;
}

function getFinanceTotals(p){
let finance = getPatientFinance(p);
let totalCharges = finance.charges.reduce((sum,x)=>sum + Number(x.amount || 0),0);
let totalPayments = finance.payments.reduce((sum,x)=>sum + Number(x.amount || 0),0);
return {
totalCharges,
totalPayments,
balance:totalCharges - totalPayments
};
}

function renderFinancialSummary(p){
let totals = getFinanceTotals(p);
let statusClass = totals.balance > 0 ? "finance-due" : "finance-ok";

return `
<div class="finance-summary">
<div>
<small>التكلفة الإجمالية</small>
<b>${formatMoney(totals.totalCharges)}</b>
</div>
<div>
<small>المدفوع</small>
<b>${formatMoney(totals.totalPayments)}</b>
</div>
<div class="${statusClass}">
<small>الباقي</small>
<b>${formatMoney(totals.balance)}</b>
</div>
</div>
<button onclick="openFinanceManager()">💰 الكشف المالي</button>
`;
}

function getMedicalAlerts(p){
let alerts = [];

let allergy = (p.allergy || "").trim();
let chronic = (p.chronic || "").trim();
let age = parseInt(p.age,10);

if(allergy) alerts.push("⚠ تحسس دوائي: " + allergy);
if(chronic) alerts.push("🩺 أمراض مزمنة: " + chronic);
if(!isNaN(age) && age <= 7) alerts.push("🧒 مريض طفل: انتبه للجرعات المناسبة للعمر والوزن");
if(!isNaN(age) && age >= 60) alerts.push("👴 مريض كبير بالعمر: راجع القصة المرضية والأدوية العامة");

let c = chronic.toLowerCase();
if(c.includes("سكري") || c.includes("diabetes")) alerts.push("⚠ مريض سكري: انتبه للإنتان والشفاء بعد الجراحة");
if(c.includes("ضغط") || c.includes("hypertension")) alerts.push("⚠ مريض ضغط: تأكد من السيطرة الدوائية قبل العمل");

return alerts;
}

function renderMedicalAlerts(p){
let alerts = getMedicalAlerts(p);
if(alerts.length === 0) return "";

return `
<div class="medical-alerts">
<h3>تنبيهات طبية</h3>
${alerts.map(a=>`<div class="alert-pill">${a}</div>`).join("")}
</div>
`;
}

function getPatientTimelineItems(p){
let items = [];

(p.visits || []).forEach(v=>{
items.push({
date:v.date || "",
icon:"📝",
title:"زيارة",
text:v.text || ""
});
});

(p.prescriptions || []).forEach(rx=>{
items.push({
date:rx.date || "",
icon:"🧾",
title:rx.title || rx.type || "وصفة",
text:(rx.meds || []).map(m=>m.name).join("، ")
});
});

if(p.teeth){
Object.keys(p.teeth).forEach(num=>{
let t = p.teeth[num];
if(t && ((t.states || []).length || t.note)){
items.push({
date:t.updatedAt || "",
icon:"🦷",
title:"السن " + num,
text:[...(t.states || []), t.note || ""].filter(Boolean).join(" - ")
});
}
});
}

let media = p.media || {xrays:[], photos:[]};
(media.xrays || []).forEach(m=>{
items.push({date:m.uploadedAt || "", icon:"📷", title:"أشعة", text:m.name || ""});
});
(media.photos || []).forEach(m=>{
items.push({date:m.uploadedAt || "", icon:"🖼", title:"صورة فوتوغرافية", text:m.name || ""});
});

return items.reverse();
}

function renderPatientTimeline(p){
let items = getPatientTimelineItems(p);
if(items.length === 0) return "<p>لا توجد أحداث بعد.</p>";

return `
<div class="timeline">
${items.map(item=>`
<div class="timeline-item">
<div class="timeline-icon">${item.icon}</div>
<div class="timeline-content">
<b>${item.title}</b>
<small>${item.date || ""}</small>
<p>${escapeHtml(item.text || "")}</p>
</div>
</div>
`).join("")}
</div>
`;
}

function renderLegacyVisits(p){
return (p.visits||[]).length ? (p.visits||[]).map(v=>`
<div><b>${v.date || ""}</b><br>${v.text || ""}<hr></div>
`).join("") : "<p>لا توجد زيارات</p>";
}

function renderLegacyPrescriptions(p){
return (p.prescriptions||[]).length ? (p.prescriptions||[]).map((pr,i)=>`
<div>
<b>${pr.date || ""}</b> - ${pr.title || pr.type || ""}<br>
${(pr.meds||[]).map(m=>`
<div>- ${m.name || ""} ${m.dose || ""}</div>
`).join("")}
<br>
<button onclick="viewOldPrescription(${i})">👁 عرض</button>
<button onclick="reusePrescription(${i})">✏ إعادة استخدام</button>
<button onclick="deletePrescription(${i})">🗑 حذف الوصفة</button>
<hr>
</div>
`).join("") : "<p>لا توجد وصفات</p>";
}

function renderFinanceHistory(p){
let finance = getPatientFinance(p);
let rows = [];

(finance.charges || []).forEach((x,i)=>rows.push({...x, kind:"charge", index:i}));
(finance.payments || []).forEach((x,i)=>rows.push({...x, kind:"payment", index:i}));

if(rows.length === 0) return "<p>لا توجد حركات مالية بعد.</p>";

return `
<div class="finance-history">
${rows.map(r=>`
<div class="finance-row ${r.kind === "charge" ? "charge-row" : "payment-row"}">
<div>
<b>${r.kind === "charge" ? "تكلفة" : "دفعة"}</b>
<small>${r.date || ""}</small>
<p>${escapeHtml(r.label || r.note || "")}</p>
</div>
<div>
<strong>${formatMoney(r.amount)}</strong>
<button onclick="deleteFinanceItem('${r.kind}',${r.index})">حذف</button>
</div>
</div>
`).join("")}
</div>
`;
}

function openFinanceManager(){
if(!patient){
alert("افتح ملف مريض أولاً");
return;
}

getPatientFinance(patient);
let totals = getFinanceTotals(patient);

document.getElementById("output").innerHTML = `
<div class="card finance-manager">
<h2>💰 الكشف المالي - ${patient.name || ""}</h2>

${renderFinancialSummary(patient)}

<div class="finance-form">
<h3>إضافة تكلفة علاج</h3>
<input id="chargeLabel" placeholder="البيان: مثال علاج عصب سن 26">
<input id="chargeAmount" type="number" placeholder="المبلغ">
<button onclick="addFinanceCharge()">➕ إضافة تكلفة</button>
</div>

<div class="finance-form">
<h3>إضافة دفعة</h3>
<input id="paymentLabel" placeholder="ملاحظة الدفعة">
<input id="paymentAmount" type="number" placeholder="المبلغ المدفوع">
<button onclick="addFinancePayment()">➕ إضافة دفعة</button>
</div>

<h3>سجل الحركات</h3>
${renderFinanceHistory(patient)}

<br>
<button onclick="openPatient(patient)">رجوع لملف المريض</button>
</div>
`;

document.getElementById("backBtn").style.display="block";
}

function addFinanceCharge(){
if(!patient) return;
let label = getFieldValue("chargeLabel").trim();
let amount = Number(getFieldValue("chargeAmount") || 0);

if(!amount || amount <= 0){
alert("أدخل مبلغ صحيح");
return;
}

let finance = getPatientFinance(patient);
finance.charges.push({
date:nowDateTime(),
label,
amount
});

saveAll();
openFinanceManager();
}

function addFinancePayment(){
if(!patient) return;
let label = getFieldValue("paymentLabel").trim();
let amount = Number(getFieldValue("paymentAmount") || 0);

if(!amount || amount <= 0){
alert("أدخل مبلغ صحيح");
return;
}

let finance = getPatientFinance(patient);
finance.payments.push({
date:nowDateTime(),
label,
amount
});

saveAll();
openFinanceManager();
}

function deleteFinanceItem(kind,index){
if(!patient) return;
if(!confirm("حذف الحركة المالية؟")) return;

let finance = getPatientFinance(patient);

if(kind === "charge"){
finance.charges.splice(index,1);
}else{
finance.payments.splice(index,1);
}

saveAll();
openFinanceManager();
}

function printPatientReport(){
if(!patient){
alert("افتح ملف مريض أولاً");
return;
}

let totals = getFinanceTotals(patient);
let alerts = getMedicalAlerts(patient);
let timelineItems = [];

try{
timelineItems = getPatientTimelineItems(patient).slice(0,7);
}catch(e){
timelineItems = [];
}

let teethRows = "";
if(patient.teeth && Object.keys(patient.teeth).length){
teethRows = Object.keys(patient.teeth).slice(0,8).map(num=>{
let t = patient.teeth[num] || {};
let text = [...(t.states || []), t.note || ""].filter(Boolean).join(" - ");
return `
<div class="compact-report-row">
<b>سن ${escapeHtml(num)}</b>
<span>${escapeHtml(text || "ملاحظة مسجلة")}</span>
</div>
`;
}).join("");
}else{
teethRows = `<p class="empty-report">لا توجد ملاحظات أسنان.</p>`;
}

let treatmentRows = "";
if(patient.treatmentPlan && patient.treatmentPlan.length){
treatmentRows = patient.treatmentPlan.slice(0,5).map(item=>`
<div class="compact-report-row">
<b>🦷 ${escapeHtml(item.tooth || "")} - ${escapeHtml(item.title || item.name || "خطة علاج")}</b>
<span>${escapeHtml(item.status || "")} ${item.cost ? " - " + formatMoney(item.cost) : ""}</span>
</div>
`).join("");
}

let printArea = document.getElementById("printArea");

printArea.innerHTML = `
<div class="report-page a5-report">

<div class="report-header">
<h1>تقرير مريض</h1>
<p>Dr. Taher Alaja Clinic</p>
</div>

<div class="report-grid compact-report-grid">
<div><b>الاسم:</b> ${escapeHtml(patient.name || "")}</div>
<div><b>رقم الملف:</b> ${escapeHtml(patient.fileNo || "")}</div>
<div><b>العمر:</b> ${escapeHtml(patient.age || "")}</div>
<div><b>الهاتف:</b> ${escapeHtml(patient.phone || "")}</div>
<div><b>التحسس:</b> ${escapeHtml(patient.allergy || "لا يوجد")}</div>
<div><b>الأمراض:</b> ${escapeHtml(patient.chronic || "لا يوجد")}</div>
</div>

${alerts.length ? `
<h2>التنبيهات الطبية</h2>
${alerts.slice(0,3).map(a=>`<div class="report-alert">${escapeHtml(a)}</div>`).join("")}
` : ""}

<h2>الكشف المالي</h2>
<div class="report-money">
<div><small>الإجمالي</small><b>${formatMoney(totals.totalCharges)}</b></div>
<div><small>المدفوع</small><b>${formatMoney(totals.totalPayments)}</b></div>
<div><small>الباقي</small><b>${formatMoney(totals.balance)}</b></div>
</div>

${treatmentRows ? `
<h2>خطة العلاج</h2>
${treatmentRows}
` : ""}

<h2>الخط الزمني</h2>
<div class="compact-report-timeline">
${timelineItems.length ? timelineItems.map(i=>`
<div class="compact-report-row">
<b>${escapeHtml((i.icon || "") + " " + (i.title || ""))}</b>
<span>${escapeHtml(i.date || "")}${i.text ? " - " + escapeHtml(i.text || "") : ""}</span>
</div>
`).join("") : `<p class="empty-report">لا توجد أحداث.</p>`}
</div>

<h2>ملاحظات الأسنان</h2>
${teethRows}

</div>
`;

printArea.style.display = "block";

setTimeout(()=>{
window.print();
},100);
}

function renderTeethReport(p){
if(!p.teeth || Object.keys(p.teeth).length === 0) return "<p>لا توجد ملاحظات أسنان.</p>";

return Object.keys(p.teeth).map(num=>{
let t = p.teeth[num];
return `
<div class="report-tooth-row">
<b>السن ${num}</b>
<span>${escapeHtml((t.states || []).join(" - "))}</span>
<p>${escapeHtml(t.note || "")}</p>
</div>
`;
}).join("");
}

function openPatient(p){

patient=ensurePatientFileNo(p);
patient.teeth = patient.teeth || {};
patient.media = patient.media || {xrays:[], photos:[]};
patient.finance = patient.finance || {charges:[], payments:[]};
fillPatientFields(patient);

const chartType = getDentitionType(patient.age);
const chartTitle = chartType === "adult" ? "خريطة أسنان الكبار" : (chartType === "mixed" ? "خريطة الأسنان المختلطة" : "خريطة أسنان الأطفال");

document.getElementById("output").innerHTML=`
<div class="patient-file-layout">

<div class="patient-main-card card patient-profile-card">

<div class="profile-header">
<div>
<h2>${patient.name || ""}</h2>
<p>رقم الملف: ${patient.fileNo || ""}</p>
</div>
<div class="profile-badge">ملف مريض</div>
</div>

${renderMedicalAlerts(patient)}

<div class="patient-info-grid">
<div><small>العمر</small><b>${patient.age || ""}</b></div>
<div><small>الهاتف</small><b>${patient.phone || ""}</b></div>
<div><small>التحسس الدوائي</small><b>${patient.allergy || "لا يوجد"}</b></div>
<div><small>الأمراض المزمنة</small><b>${patient.chronic || "لا يوجد"}</b></div>
</div>

<p class="patient-notes">الملاحظات: ${patient.notes || ""}</p>

<div class="profile-actions">
<button onclick="openPrescription()">🧾 وصفة</button>
<button onclick="openVisit()">➕ زيارة</button>
<button onclick="openFinanceManager()">💰 الكشف المالي</button>
<button onclick="printPatientReport()">📄 تقرير المريض</button>
<button onclick="editPatient()">✏️ تعديل</button>
<button onclick="deletePatient()">🗑 حذف</button>
</div>

<hr>

<h3>الكشف المالي</h3>
${renderFinancialSummary(patient)}

<hr>

<h3>الخط الزمني</h3>
${renderPatientTimeline(patient)}

<hr>

<details>
<summary>الزيارات القديمة</summary>
${renderLegacyVisits(patient)}
</details>

<details>
<summary>الوصفات السابقة</summary>
${renderLegacyPrescriptions(patient)}
</details>

<hr>

<h3>صور المريض</h3>
<div class="media-buttons">
<button onclick="triggerPatientMedia('xrays')">📷 استيراد صور الأشعة</button>
<button onclick="triggerPatientMedia('photos')">🖼 استيراد الصور الفوتوغرافية</button>
<input id="xrayInput" type="file" accept="image/*" multiple style="display:none" onchange="importPatientMedia('xrays', event)">
<input id="photoInput" type="file" accept="image/*" multiple style="display:none" onchange="importPatientMedia('photos', event)">
</div>
<div id="patientMediaBox"></div>

</div>

<div class="tooth-chart-card card">
<h3>${chartTitle}</h3>
<p class="tooth-chart-hint">اضغط على أي سن لتسجيل العلاج أو الحالة</p>
<div id="toothChart"></div>
</div>

</div>
`;

document.getElementById("backBtn").style.display="block";
renderToothChart();
renderPatientMedia();
saveAll();
}


function editPatient(){

if(!patient) return;

let oldFileNo = patient.fileNo;
let oldName = patient.name;

patient.fileNo = oldFileNo || getNextPatientNumber();
patient.name=getFieldValue("name").trim();
patient.age=getFieldValue("age");
patient.phone=getFieldValue("phone").trim();
patient.allergy=getFieldValue("allergy");
patient.chronic=getFieldValue("chronic");
patient.notes=getFieldValue("notes");

if(!patient.name){
alert("اسم المريض مطلوب");
return;
}

let patients=getPatients();

let duplicate = patients.find(p =>
p !== patient &&
((p.fileNo && p.fileNo !== oldFileNo && p.fileNo === patient.fileNo) ||
((p.name || "").trim().toLowerCase() === patient.name.toLowerCase() && p.name !== oldName) ||
(patient.phone && (p.phone || "").trim() === patient.phone && p.fileNo !== oldFileNo))
);

if(duplicate){
alert("انتبه لوجود ملف سابق للمريض");
openPatient(duplicate);
return;
}

patients = patients.map(p=>{
if((oldFileNo && p.fileNo === oldFileNo) || p.name === oldName) return patient;
return p;
});

savePatients(patients);
openPatient(patient);
}

function deletePatient(){

if(!patient) return;
if(!confirm("حذف المريض؟")) return;

let patients=getPatients().filter(p=>p.fileNo!==patient.fileNo && p.name!==patient.name);
savePatients(patients);

clearPatientFields();
patient=null;
alert("تم الحذف");
}

/* =========================
   BACKUP / RESTORE
========================= */
function exportBackup(){
let data = {
exportedAt: nowDateTime(),
patients: getPatients()
};
let blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
let url = URL.createObjectURL(blob);
let a = document.createElement("a");
a.href = url;
a.download = "clinic-backup.json";
a.click();
URL.revokeObjectURL(url);
}

function importBackup(event){
let file = event.target.files[0];
if(!file) return;
let reader = new FileReader();
reader.onload = function(e){
try{
let data = JSON.parse(e.target.result);
let patients = Array.isArray(data) ? data : data.patients;
if(!Array.isArray(patients)) throw new Error("bad file");
patients = patients.map(p=>ensurePatientFileNo(p));
savePatients(patients);
alert("تم استيراد النسخة الاحتياطية");
showPatients();
}catch(err){
alert("ملف النسخة الاحتياطية غير صحيح");
}
};
reader.readAsText(file);
event.target.value="";
}

function triggerImportBackup(){
let input=document.getElementById("backupInput");
if(input) input.click();
}

const READY_RX = {
adult:[
{
title:"قلع",
meds:[
{name:"Amoxicillin/Clavulanic Acid",dose:"875/125 mg tab",note:"كل 12 ساعة × 5 أيام"},
{name:"Paracetamol",dose:"500 mg tab",note:"كل 6–8 ساعات عند الحاجة"},
{name:"Chlorhexidine",dose:"0.12%",note:"مرتين يومياً × 7 أيام - يبدأ بعد 24 ساعة"}
],
instructions:[
"الامتناع عن الأكل حتى زوال التخدير.",
"يمنع التدخين لمدة 24 ساعة على الأقل.",
"يمنع التفريش على مكان القلع خلال أول 24 ساعة.",
"تناول أطعمة طرية وباردة أو فاترة خلال أول يوم.",
"تجنب الأطعمة الساخنة والقاسية والمضغ على جهة القلع."
]
},
{
title:"التهاب لثة ونخور",
meds:[
{name:"Metronidazole",dose:"500 mg tab",note:"كل 8 ساعات × 5 أيام"},
{name:"Ibuprofen",dose:"400 mg tab",note:"كل 8 ساعات بعد الطعام"},
{name:"Chlorhexidine",dose:"0.12%",note:"مرتين يومياً × 10 أيام - التفريش بفرشاة ناعمة والتنظيف بالخيط يومياً"}
],
instructions:[
"التفريش مرتين يومياً بفرشاة ناعمة.",
"عدم إيقاف التفريش بسبب النزف واستخدم الخيط برفق.",
"ضع الفرشاة بزاوية 45° نحو اللثة، حرّكها بحركات اهتزازية صغيرة، ثم اسحبها بعيداً عن اللثة."
]
},
{
title:"بعد اللبية مع خراج",
meds:[
{name:"Amoxicillin/Clavulanic Acid",dose:"875/125 mg tab",note:"كل 12 ساعة × 5 أيام"},
{name:"Ibuprofen",dose:"400 mg tab",note:"كل 8 ساعات بعد الطعام"},
{name:"Agilomox",dose:"300 mg",note:"كل 8 ساعات بعد الطعام"}
],
instructions:[]
},
{
title:"خراج وتورم قبل العمل",
meds:[
{name:"Amoxicillin/Clavulanic Acid",dose:"875/125 mg tab",note:"كل 12 ساعة × 5 أيام"},
{name:"Metronidazole",dose:"500 mg cab",note:"كل 8 ساعات"},
{name:"Chlorhexidine",dose:"0.12%",note:"مرتين يومياً × 7 أيام - قبل العمل بيوم/ين"}
],
instructions:[]
}
],

child:[
{
title:"التهاب لثة ونخور",
meds:[
{name:"Metronidazole",dose:"syr 250 mg",note:"كل 8 ساعات - 3-4 سنوات ملعقة صغيرة / 5-9 سنوات ملعقة وسط / 9-12 سنوات ملعقة كبيرة"},
{name:"Ibuprofen",dose:"syr 100 mg / syr 200 mg",note:"كل 8 ساعات - 1-4 سنوات ملعقة وسط بعد الأكل / 4-12 سنة ملعقة وسط بعد الأكل"},
{name:"Chlorhexidine أو ماء وملح",dose:"",note:"كل 12 ساعة"}
],
instructions:[]
},
{
title:"بعد اللبية مع خراج",
meds:[
{name:"Augmentin",dose:"Syr 156 mg / Syr 457 mg",note:"كل 8 ساعات - 0-4 أشهر / 3-4 سنوات ملعقة صغيرة / 5-9 سنوات ملعقة وسط / 9-12 سنوات ملعقة كبيرة"},
{name:"Ibuprofen",dose:"syr 100 mg / syr 200 mg",note:"كل 8 ساعات - 1-4 سنوات ملعقة وسط بعد الأكل / 4-12 سنة ملعقة وسط بعد الأكل"}
],
instructions:[]
},
{
title:"خراج تحضير قبل العمل",
meds:[
{name:"Augmentin",dose:"Syr 156 mg / Syr 457 mg",note:"كل 8 ساعات - 0-4 أشهر / 3-4 سنوات ملعقة صغيرة / 5-9 سنوات ملعقة وسط / 9-12 سنوات ملعقة كبيرة"},
{name:"Paracetamol",dose:"syr 160 mg / syr 250 mg",note:"كل 8 ساعات"},
{name:"Chlorhexidine أو ماء وملح",dose:"",note:"كل 12 ساعة"}
],
instructions:[]
},
{
title:"قلع",
meds:[
{name:"Augmentin",dose:"Syr 156 mg / Syr 457 mg",note:"كل 8 ساعات - 0-4 أشهر / 3-4 سنوات ملعقة صغيرة / 5-9 سنوات ملعقة وسط / 9-12 سنوات ملعقة كبيرة"},
{name:"Paracetamol",dose:"syr 160 mg / syr 250 mg",note:"كل 8 ساعات"},
{name:"Chlorhexidine أو ماء وملح",dose:"",note:"كل 12 ساعة"}
],
instructions:[]
}
]
};

const DRUG_GUIDE = {

adult:{

"بعد قلع الأسنان":[
{name:"Paracetamol",dose:"500 mg tab",note:"كل 6–8 ساعات عند الحاجة"},
{name:"Ibuprofen",dose:"400 mg tab",note:"كل 8 ساعات بعد الطعام"},
{name:"Amoxicillin",dose:"500 mg tab",note:"كل 8 ساعات × 5 أيام",warning:"عند الحاجة فقط"},
{name:"Amoxicillin/Clavulanic Acid",dose:"875/125 mg tab",note:"كل 12 ساعة × 5 أيام"},
{name:"Cefixime",dose:"400 mg tab",note:"كل 24 ساعة",warning:"بديل التحسس"},
{name:"Cefixime + Metronidazole",dose:"400 mg + 500 mg",note:"الحالات الشديدة"},
{name:"Chlorhexidine",dose:"0.12%",note:"مرتين يومياً × 7 أيام"}
],

"قبل المعالجة اللبية":[
{name:"Chlorhexidine",dose:"0.12%",note:"مرتين يومياً × 7 أيام"},
{name:"Metronidazole",dose:"500 mg tab",note:"كل 8 ساعات"},
{name:"Amoxicillin/Clavulanic Acid",dose:"875/125 mg tab",note:"كل 12 ساعة × 5 أيام"}
],

"بعد المعالجة اللبية":[
{name:"Paracetamol",dose:"500 mg tab",note:"كل 6–8 ساعات عند الحاجة"},
{name:"Ibuprofen",dose:"400 mg tab",note:"كل 8 ساعات بعد الطعام"},
{name:"Amoxicillin/Clavulanic Acid",dose:"875/125 mg tab",note:"كل 12 ساعة × 5 أيام"},
{name:"Cefixime",dose:"400 mg tab",note:"كل 24 ساعة"},
{name:"Lincomycin",dose:"600 mg amp",note:"كل 24 ساعة × 3 أيام"}
],

"التهاب الرباط":[
{name:"Ibuprofen",dose:"400 mg tab",note:"كل 8 ساعات"},
{name:"Surgam",dose:"300 mg tab",note:"كل 24 ساعة"},
{name:"Agilomox",dose:"300 mg tab",note:"كل 8 ساعات"},
{name:"Cefixime",dose:"400 mg tab",note:"مع تورم وحركة سن"}
],

"التهاب اللثة - متوسط":[
{name:"Chlorhexidine",dose:"0.12%",note:"مرتين يومياً × 10 أيام"}
],

"التهاب اللثة - حاد غير نخري":[
{name:"Chlorhexidine",dose:"0.12%",note:"مرتين يومياً × 10 أيام"},
{name:"Ibuprofen",dose:"400 mg tab",note:"كل 8 ساعات بعد الطعام"}
],

"التهاب اللثة - حاد نخري":[
{name:"Chlorhexidine",dose:"0.12%",note:"مرتين يومياً × 10 أيام"},
{name:"Ibuprofen",dose:"400 mg tab",note:"كل 8 ساعات بعد الطعام"},
{name:"Metronidazole",dose:"500 mg tab",note:"كل 8 ساعات × 5 أيام"}
]

},

child:{

"التهاب لثة ونخور":[
{name:"Metronidazole",dose:"Syr 250 mg",note:"3-4 سنوات ملعقة صغيرة / 5-9 سنوات ملعقة وسط / 9-12 سنوات ملعقة كبيرة"},
{name:"Ibuprofen",dose:"Syr 100 mg أو Syr 200 mg",note:"كل 8 ساعات بعد الطعام"},
{name:"Chlorhexidine أو ماء وملح",dose:"",note:"كل 12 ساعة"}
],

"بعد اللبية مع خراج":[
{name:"Augmentin",dose:"Syr 156 mg",note:"0-4 أشهر"},
{name:"Augmentin",dose:"Syr 457 mg",note:"3-12 سنة حسب العمر"},
{name:"Ibuprofen",dose:"Syr 100 mg أو Syr 200 mg",note:"كل 8 ساعات بعد الطعام"}
],

"خراج قبل العمل":[
{name:"Augmentin",dose:"Syr 156 mg",note:"0-4 أشهر"},
{name:"Augmentin",dose:"Syr 457 mg",note:"3-12 سنة حسب العمر"},
{name:"Paracetamol",dose:"Syr 160 mg أو Syr 250 mg",note:"كل 8 ساعات"},
{name:"Chlorhexidine أو ماء وملح",dose:"",note:"كل 12 ساعة"}
],

"قلع":[
{name:"Augmentin",dose:"Syr 156 mg",note:"0-4 أشهر"},
{name:"Augmentin",dose:"Syr 457 mg",note:"3-12 سنة حسب العمر"},
{name:"Paracetamol",dose:"Syr 160 mg أو Syr 250 mg",note:"كل 8 ساعات"},
{name:"Chlorhexidine أو ماء وملح",dose:"",note:"كل 12 ساعة"}
]

}

};

/* =========================
   RX FLOW
========================= */

function openPrescription(){

const p=getCurrentPatient();

if(!p){
alert("أدخل اسم المريض");
return;
}

patient=p;

rxType="";
selectedMeds=[];
rxHistory=[];
currentProtocolList=[];
currentProtocolName="";
rxPreview=null;
rxPregnantMode=false;

document.getElementById("printArea").style.display="none";

rxHistory.push("type");
renderTypeStep();
}

function renderTypeStep(){

document.getElementById("output").innerHTML=`
<div class="card prescription-type-card">
<h3>إنشاء وصفة</h3>
<p class="type-hint">اختر فئة الوصفة. خيار الحمل خاص بالوصفة الحالية فقط ولا يظهر في بيانات المريض.</p>
<div class="rx-type-grid">
<button onclick="selectType('adult', false)">👨 بالغ</button>
<button onclick="selectType('child', false)">🧒 طفل</button>
<button class="pregnant-rx-btn" onclick="selectType('adult', true)">🤰 بالغة حامل</button>
</div>
<br>
<button onclick="goBack()">⬅ رجوع</button>
</div>
`;

document.getElementById("backBtn").style.display="block";
}

function selectType(type, pregnantMode=false){
rxType=type;
rxPregnantMode=Boolean(pregnantMode);
rxHistory.push("mode");
renderModeStep();
}

function renderModeStep(){
let label = rxType === "child" ? "طفل" : (rxPregnantMode ? "بالغة حامل" : "بالغ");
document.getElementById("output").innerHTML=`
<div class="card">
<h3>${label}</h3>
${rxPregnantMode ? `<div class="pregnancy-prescription-alert">🤰 هذه الوصفة لمريضة حامل: سيتم تلوين الأدوية غير المناسبة وإظهار تحذير قبل الحفظ.</div>` : ""}
<button onclick="openReadyList()">📋 وصفة جاهزة</button>
<button onclick="openCustomProtocols()">✍️ أنشئ بنفسك</button>
<br><br>
<button onclick="goBack()">⬅ رجوع</button>
</div>
`;
}

/* READY */

function openReadyList(){

rxHistory.push("ready");

let list = getReadyRxData()[rxType] || [];

document.getElementById("output").innerHTML=`
<div class="card">

<h3>الوصفات الجاهزة</h3>

<div class="cards-grid">
${list.map((r,i)=>`
<div class="med-card" onclick="applyReadyRx(${i})">
<h4>${r.title}</h4>
<p>${r.meds.length} أدوية</p>
</div>
`).join("")}
</div>

<br>
<button onclick="goBack()">⬅ رجوع</button>

</div>
`;
}

function applyReadyRx(index){

let ready = (getReadyRxData()[rxType] || [])[index];

if(hasAllergyConflict(ready.meds)){
if(!confirm("⚠ انتبه: يوجد تحسس دوائي مسجل وقد تتعارض هذه الوصفة. هل تريد المتابعة؟")){
return;
}
}

let rx={
date:nowDateTime(),
type:rxType,
title:ready.title,
meds:[...ready.meds],
instructions:[...(ready.instructions || [])]
};

patient.prescriptions.push(rx);
saveAll();

rxPreview=rx;
renderGeneratedRx(rx);
previewPrescription();
}

/* CUSTOM */

function openCustomProtocols(){

rxHistory.push("protocols");
renderProtocols();
}

function renderProtocols(){

let data=getDrugGuideData()[rxType] || {};

document.getElementById("output").innerHTML=`
<div class="card">
<h3>اختر مجموعة الأدوية</h3>
<div class="cards-grid" id="protocolList"></div>
<br>
<button onclick="goBack()">⬅ رجوع</button>
</div>
`;

let c=document.getElementById("protocolList");

Object.keys(data).forEach(k=>{
let d=document.createElement("div");
d.className="med-card";
d.innerHTML=`
<h4>${k}</h4>
<button onclick="openProtocol('${k}')">فتح</button>
`;
c.appendChild(d);
});
}

function openProtocol(key){

currentProtocolName=key;
let guide = getDrugGuideData();
currentProtocolList=(guide[rxType] && guide[rxType][key]) || [];
rxHistory.push("meds");
renderMeds();
}

function renderMeds(){

selectedMeds=[];

document.getElementById("output").innerHTML=`
<div class="card">

<h3>${currentProtocolName}</h3>

<div class="cards-grid" id="medList"></div>

<br>

<button onclick="generateRx()">🧾 إنشاء الوصفة</button>
<button onclick="goBack()">⬅ رجوع</button>

</div>
`;

let c=document.getElementById("medList");

currentProtocolList.forEach(m=>{

let d=document.createElement("div");
d.className="med-card";

d.innerHTML=`
${m.warning ? `<div class="med-warning">${m.warning}</div>` : ""}
<h4>${m.name || ""}</h4>
<p><b>${m.dose || ""}</b></p>
<p>${m.note || ""}</p>
`;

d.onclick=()=>{

if(selectedMeds.includes(m)){
selectedMeds=selectedMeds.filter(x=>x!==m);
d.classList.remove("selected-med");
}else{
selectedMeds.push(m);
d.classList.add("selected-med");
}

};

c.appendChild(d);
});
}

function generateRx(){

if(selectedMeds.length===0){
alert("اختر دواء واحد على الأقل");
return;
}

if(hasAllergyConflict(selectedMeds)){
if(!confirm("⚠ انتبه: يوجد تحسس دوائي مسجل وقد تتعارض بعض الأدوية المختارة. هل تريد المتابعة؟")){
return;
}
}

let rx={
date:nowDateTime(),
type:rxType,
title:currentProtocolName || "وصفة مخصصة",
meds:[...selectedMeds],
instructions:[]
};

patient.prescriptions.push(rx);
saveAll();

rxPreview=rx;
renderGeneratedRx(rx);
previewPrescription();
}

function renderGeneratedRx(rx){

document.getElementById("output").innerHTML=`
<div class="card">

<h2>الوصفة</h2>

<p>${patient.name || ""}</p>
<p>${rx.date || ""}</p>
<p>${rx.title || rx.type || ""}</p>

<br>

<button onclick="previewPrescription()">👁️ معاينة الطباعة</button>
<button onclick="openPrescription()">⬅ وصفة جديدة</button>

</div>
`;
}

/* =========================
   PRINT PREVIEW
========================= */

function formatRxInstruction(text){
let safe=escapeHtml(String(text == null ? "" : text));
return safe.replace(/\[\[([\s\S]*?)\]\]/g, '<span class="rx-red">$1</span>');
}

function previewPrescription(){

if(!rxPreview){
alert("لا يوجد وصفة");
return;
}

let printArea=document.getElementById("printArea");

printArea.innerHTML=`
<div class="preview-actions">
<button onclick="window.print()">🖨️ طباعة</button>
<button onclick="hidePreview()">❌ إغلاق</button>
</div>

<div class="rx-preview-wrap">
<div class="rx-page">

<img src="rx-template.png" class="template-image" alt="Prescription Template">

<div class="patient-name">${patient.name || ""}</div>
<div class="patient-age">${patient.age || ""}</div>
<div class="rx-date">${prescriptionPrintDate(rxPreview.date)}</div>

<div class="meds">

${(rxPreview.meds || []).map(m=>`
<div class="med-row">
<div class="med-name">${m.name || ""}</div>
<div class="med-dose">${m.dose || ""}</div>
<div class="med-time">${m.note || ""}</div>
</div>
`).join("")}

${(rxPreview.instructions || []).length ? `
<div class="rx-instructions">
${rxPreview.instructions.map(i=>`<div>- ${formatRxInstruction(i)}</div>`).join("")}
</div>
` : ""}

</div>

</div>
</div>
`;

printArea.style.display="block";

window.scrollTo({
top:printArea.offsetTop,
behavior:"smooth"
});
}

function hidePreview(){
document.getElementById("printArea").style.display="none";
}


/* =========================
   TOOTH CHART + MEDIA
========================= */

function getDentitionType(ageValue){
let age = parseInt(ageValue,10);
if(isNaN(age)) return "adult";
if(age <= 7) return "child";
if(age < 16) return "mixed";
return "adult";
}

function getTeethNumbers(){
let type = getDentitionType(patient && patient.age);
if(type === "child"){
return {
upper:["55","54","53","52","51","61","62","63","64","65"],
lower:["85","84","83","82","81","71","72","73","74","75"]
};
}
if(type === "mixed"){
return {
upper:["16","55","54","53","12","11","21","22","63","64","65","26"],
lower:["46","85","84","83","42","41","31","32","73","74","75","36"]
};
}
return {
upper:["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"],
lower:["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"]
};
}

function renderToothChart(){
if(!patient) return;
let container = document.getElementById("toothChart");
if(!container) return;
patient.teeth = patient.teeth || {};
let groups = getTeethNumbers();
container.innerHTML = `
<div class="tooth-arch-label">الفك العلوي</div>
<div class="tooth-row upper-row">
${groups.upper.map(n=>renderToothButton(n)).join("")}
</div>
<div class="tooth-midline"></div>
<div class="tooth-row lower-row">
${groups.lower.map(n=>renderToothButton(n)).join("")}
</div>
<div class="tooth-arch-label">الفك السفلي</div>
`;
}

function renderToothButton(num){
let t = (patient.teeth && patient.teeth[num]) || {states:[], note:""};
let states = t.states || [];
let cls = ["tooth-btn"];
if(states.includes("extraction")) cls.push("tooth-missing");
if(states.includes("rootCanal")) cls.push("tooth-root");
if(states.includes("filling")) cls.push("tooth-filling");
if(states.includes("crown")) cls.push("tooth-crown");
if(states.includes("implant")) cls.push("tooth-implant");
if(states.includes("bridge")) cls.push("tooth-bridge");
let icon = states.includes("implant") ? "🔩" : (states.includes("extraction") ? "" : "🦷");
let label = states.includes("extraction") ? "فراغ" : num;
return `<button class="${cls.join(" ")}" onclick="openToothModal('${num}')"><span>${icon}</span><small>${label}</small></button>`;
}

function openToothModal(num){
if(!patient) return;
patient.teeth = patient.teeth || {};
let t = patient.teeth[num] || {states:[], note:""};
let states = t.states || [];
let modal = document.createElement("div");
modal.className = "modal tooth-modal";
modal.id = "toothModal";
modal.innerHTML = `
<div class="modalBox tooth-modal-box">
<h3>السن ${num}</h3>
<p class="modal-hint">يمكن اختيار حالة واحدة أو عدة حالات</p>
<label><input type="checkbox" value="extraction" ${states.includes("extraction") ? "checked" : ""}> قلع / فراغ</label>
<label><input type="checkbox" value="rootCanal" ${states.includes("rootCanal") ? "checked" : ""}> علاج عصب</label>
<label><input type="checkbox" value="filling" ${states.includes("filling") ? "checked" : ""}> حشو</label>
<label><input type="checkbox" value="crown" ${states.includes("crown") ? "checked" : ""}> تتويج</label>
<label><input type="checkbox" value="implant" ${states.includes("implant") ? "checked" : ""}> زرعة</label>
<label><input type="checkbox" value="bridge" ${states.includes("bridge") ? "checked" : ""}> جسر</label>
<label><input type="checkbox" value="watch" ${states.includes("watch") ? "checked" : ""}> مراقبة / ملاحظة</label>
<textarea id="toothNote" placeholder="ملاحظة العلاج أو الإجراء">${t.note || ""}</textarea>
<div class="modal-actions">
<button onclick="saveToothState('${num}')">حفظ</button>
<button onclick="clearToothState('${num}')">تفريغ السن</button>
<button onclick="closeToothModal()">إغلاق</button>
</div>
</div>
`;
document.body.appendChild(modal);
}

function saveToothState(num){
let modal = document.getElementById("toothModal");
if(!modal || !patient) return;
let states = Array.from(modal.querySelectorAll("input[type='checkbox']:checked")).map(x=>x.value);
let note = document.getElementById("toothNote").value;
patient.teeth = patient.teeth || {};
patient.teeth[num] = {
states,
note,
updatedAt:nowDateTime()
};
saveAll();
closeToothModal();
renderToothChart();
}

function clearToothState(num){
if(!patient) return;
if(patient.teeth) delete patient.teeth[num];
saveAll();
closeToothModal();
renderToothChart();
}

function closeToothModal(){
let modal = document.getElementById("toothModal");
if(modal) modal.remove();
}

function triggerPatientMedia(type){
if(!patient){ alert("افتح ملف مريض أولاً"); return; }
let id = type === "xrays" ? "xrayInput" : "photoInput";
let input = document.getElementById(id);
if(input) input.click();
}

function importPatientMedia(type,event){
if(!patient) return;
let files = Array.from(event.target.files || []);
if(files.length === 0) return;
patient.media = patient.media || {xrays:[], photos:[]};
patient.media[type] = patient.media[type] || [];
let remaining = files.length;
files.forEach(file=>{
let reader = new FileReader();
reader.onload = function(e){
patient.media[type].push({
name:file.name,
data:e.target.result,
uploadedAt:nowDateTime()
});
remaining--;
if(remaining === 0){
saveAll();
renderPatientMedia();
alert(type === "xrays" ? "تم حفظ صور الأشعة داخل ملف المريض" : "تم حفظ الصور الفوتوغرافية داخل ملف المريض");
}
};
reader.readAsDataURL(file);
});
event.target.value="";
}

function renderPatientMedia(){
let box = document.getElementById("patientMediaBox");
if(!box || !patient) return;
patient.media = patient.media || {xrays:[], photos:[]};
box.innerHTML = `
<div class="media-section"><h4>${patient.name || "مريض"} + أشعة</h4>${renderMediaList("xrays")}</div>
<div class="media-section"><h4>${patient.name || "مريض"} + فوتوغراف</h4>${renderMediaList("photos")}</div>
`;
}

function renderMediaList(type){
let arr = (patient.media && patient.media[type]) || [];
if(arr.length === 0) return "<p>لا توجد صور محفوظة</p>";
return `<div class="media-grid">${arr.map((m,i)=>`
<div class="media-item">
<img src="${m.data}" alt="${m.name}">
<small>${m.name}</small>
<button onclick="deletePatientMedia('${type}',${i})">حذف</button>
</div>
`).join("")}</div>`;
}

function deletePatientMedia(type,index){
if(!patient || !patient.media || !patient.media[type]) return;
if(!confirm("حذف الصورة؟")) return;
patient.media[type].splice(index,1);
saveAll();
renderPatientMedia();
}


/* =========================
   READY RX + DRUG GUIDE MANAGER
   Uses localStorage and does not remove the original READY_RX / DRUG_GUIDE
========================= */
let rxManagerMode = "ready";
let rxManagerType = "adult";
let readyEditIndex = null;
let readyEditMeds = [];
let guideEditProtocol = "";
let guideEditMedIndex = null;

function cloneData(obj){
return JSON.parse(JSON.stringify(obj));
}

function getReadyRxData(){
let saved = localStorage.getItem("customReadyRxLibrary");
if(saved){
try{return JSON.parse(saved);}catch(e){}
}
return cloneData(READY_RX);
}

function saveReadyRxData(data){
localStorage.setItem("customReadyRxLibrary", JSON.stringify(data));
}

function getDrugGuideData(){
let saved = localStorage.getItem("customDrugGuideLibrary");
if(saved){
try{return JSON.parse(saved);}catch(e){}
}
return cloneData(DRUG_GUIDE);
}

function saveDrugGuideData(data){
localStorage.setItem("customDrugGuideLibrary", JSON.stringify(data));
}

function escapeHtml(value){
return String(value || "")
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/\"/g,"&quot;")
.replace(/'/g,"&#039;");
}

function medNoteFromParts(time,note){
let t = (time || "").trim();
let n = (note || "").trim();
if(t && n) return t + " - " + n;
return t || n;
}

function splitMedNote(note){
return {time: note || "", note: ""};
}

function flattenGuideMeds(type){
let guide = getDrugGuideData();
let out = [];
let data = guide[type] || {};
Object.keys(data).forEach(protocol=>{
(data[protocol] || []).forEach(m=>{
out.push({protocol, med:cloneData(m)});
});
});
return out;
}

function openRxLibraryManager(){
rxManagerMode = "ready";
rxManagerType = "adult";
readyEditIndex = null;
readyEditMeds = [];
guideEditProtocol = "";
guideEditMedIndex = null;
renderRxLibraryManager();
}

function renderRxLibraryManager(){
let modeTitle = rxManagerMode === "ready" ? "إدارة الوصفات الجاهزة" : "إدارة دليل الأدوية";
document.getElementById("output").innerHTML = `
<div class="card rx-manager">
<h2>⚙️ ${modeTitle}</h2>

<div class="manager-toolbar">
<button onclick="setRxManagerMode('ready')">📋 الوصفات الجاهزة</button>
<button onclick="setRxManagerMode('guide')">💊 دليل الأدوية</button>
<button onclick="setRxManagerType('adult')">👨 كبار</button>
<button onclick="setRxManagerType('child')">🧒 أطفال</button>
<button onclick="resetRxLibraries()">↩️ استرجاع الافتراضي</button>
<button onclick="backToHome()">رجوع</button>
</div>

<p><b>الفئة الحالية:</b> ${rxManagerType === "adult" ? "كبار" : "أطفال"}</p>
<div id="rxManagerBody"></div>
</div>
`;
document.getElementById("backBtn").style.display="block";
if(rxManagerMode === "ready") renderReadyManager();
else renderGuideManager();
}

function setRxManagerMode(mode){
rxManagerMode = mode;
readyEditIndex = null;
guideEditProtocol = "";
guideEditMedIndex = null;
renderRxLibraryManager();
}

function setRxManagerType(type){
rxManagerType = type;
readyEditIndex = null;
readyEditMeds = [];
guideEditProtocol = "";
guideEditMedIndex = null;
renderRxLibraryManager();
}

function resetRxLibraries(passwordVerified){
if(passwordVerified !== true){
let code=prompt("كلمة سر استرجاع الافتراضي للوصفات:");
let expected=(window.ADMIN_PASS || "DTDC2026");
if(code!==expected){ alert("كلمة السر غير صحيحة"); return; }
}
if(!confirm("سيتم حذف تعديلات الوصفات والأدوية والرجوع للقيم الافتراضية. متابعة؟")) return;
localStorage.removeItem("customReadyRxLibrary");
localStorage.removeItem("customDrugGuideLibrary");
readyEditIndex = null;
readyEditMeds = [];
guideEditProtocol = "";
guideEditMedIndex = null;
renderRxLibraryManager();
}

/* ---------- Ready prescriptions manager ---------- */
function renderReadyManager(){
let data = getReadyRxData();
let list = data[rxManagerType] || [];
let body = document.getElementById("rxManagerBody");
body.innerHTML = `
<div class="manager-section">
<h3>الوصفات الجاهزة</h3>
<button onclick="newReadyPrescription()">➕ وصفة جاهزة جديدة</button>
<div class="manager-list">
${list.map((r,i)=>`
<div class="manager-item">
<b>${escapeHtml(r.title)}</b><br>
<small>${(r.meds || []).length} أدوية</small><br>
<button onclick="editReadyPrescription(${i})">✏️ تعديل</button>
<button onclick="deleteReadyPrescription(${i})">🗑 حذف</button>
</div>
`).join("") || "<p>لا توجد وصفات</p>"}
</div>
</div>
<div id="readyEditor"></div>
`;
}

function newReadyPrescription(){
readyEditIndex = null;
readyEditMeds = [];
renderReadyEditor({title:"", meds:[], instructions:[]});
}

function editReadyPrescription(index){
let data = getReadyRxData();
let rx = (data[rxManagerType] || [])[index];
if(!rx) return;
readyEditIndex = index;
readyEditMeds = cloneData(rx.meds || []);
renderReadyEditor(rx);
}

function deleteReadyPrescription(index){
if(!confirm("حذف هذه الوصفة الجاهزة؟")) return;
let data = getReadyRxData();
data[rxManagerType].splice(index,1);
saveReadyRxData(data);
readyEditIndex = null;
readyEditMeds = [];
renderReadyManager();
}

function renderReadyEditor(rx){
let guideMeds = flattenGuideMeds(rxManagerType);
let editor = document.getElementById("readyEditor");
editor.innerHTML = `
<div class="manager-editor">
<h3>${readyEditIndex === null ? "إضافة وصفة جاهزة" : "تعديل وصفة جاهزة"}</h3>

<label>اسم الوصفة</label>
<input id="readyTitle" value="${escapeHtml(rx.title || "")}" placeholder="مثال: قلع">

<label>تعليمات آخر الوصفة</label>
<textarea id="readyInstructions" placeholder="كل تعليمة بسطر مستقل — استخدم [[النص]] لتلوينه بالأحمر">${escapeHtml((rx.instructions || []).join("\n"))}</textarea>

<h4>أدوية الوصفة</h4>
<div id="readyMedsList">${renderReadyMedsList()}</div>

<h4>إضافة دواء من دليل الأدوية</h4>
<select id="readyExistingMedSelect">
<option value="">اختر دواء...</option>
${guideMeds.map((x,i)=>`<option value="${i}">${escapeHtml(x.protocol)} - ${escapeHtml(x.med.name)} ${escapeHtml(x.med.dose)}</option>`).join("")}
</select>
<button onclick="addExistingMedToReady()">إضافة من الدليل</button>

<h4>إضافة دواء جديد يدويًا</h4>
<div class="manual-med-grid">
<input id="readyMedName" placeholder="اسم الدواء">
<input id="readyMedDose" placeholder="الجرعة">
<input id="readyMedTime" placeholder="أوقات الدواء">
<input id="readyMedNote" placeholder="ملاحظات">
</div>
<button onclick="addManualMedToReady()">➕ إضافة الدواء للوصفة</button>

<br><br>
<button onclick="saveReadyPrescriptionEditor()">💾 حفظ الوصفة الجاهزة</button>
<button onclick="renderReadyManager()">إلغاء</button>
</div>
`;
}

function renderReadyMedsList(){
if(!readyEditMeds.length) return "<p>لا توجد أدوية بعد</p>";
return readyEditMeds.map((m,i)=>`
<div class="manager-med-row">
<b>${escapeHtml(m.name)}</b> - ${escapeHtml(m.dose)}<br>
<small>${escapeHtml(m.note)}</small><br>
<button onclick="removeReadyMed(${i})">حذف من الوصفة</button>
</div>
`).join("");
}

function refreshReadyMedsList(){
let box = document.getElementById("readyMedsList");
if(box) box.innerHTML = renderReadyMedsList();
}

function addExistingMedToReady(){
let select = document.getElementById("readyExistingMedSelect");
if(!select || select.value === "") return;
let med = flattenGuideMeds(rxManagerType)[parseInt(select.value,10)].med;
readyEditMeds.push(cloneData(med));
select.value = "";
refreshReadyMedsList();
}

function addManualMedToReady(){
let name = getFieldValue("readyMedName").trim();
let dose = getFieldValue("readyMedDose").trim();
let time = getFieldValue("readyMedTime").trim();
let note = getFieldValue("readyMedNote").trim();
if(!name){ alert("اكتب اسم الدواء"); return; }
readyEditMeds.push({name,dose,note:medNoteFromParts(time,note)});
setFieldValue("readyMedName","");
setFieldValue("readyMedDose","");
setFieldValue("readyMedTime","");
setFieldValue("readyMedNote","");
refreshReadyMedsList();
}

function removeReadyMed(index){
readyEditMeds.splice(index,1);
refreshReadyMedsList();
}

function saveReadyPrescriptionEditor(){
let title = getFieldValue("readyTitle").trim();
let instructions = getFieldValue("readyInstructions").split("\n").map(x=>x.trim()).filter(Boolean);
if(!title){ alert("اكتب اسم الوصفة"); return; }
if(readyEditMeds.length === 0){ alert("أضف دواء واحد على الأقل"); return; }
let data = getReadyRxData();
data[rxManagerType] = data[rxManagerType] || [];
let rx = {title, meds:cloneData(readyEditMeds), instructions};
if(readyEditIndex === null) data[rxManagerType].push(rx);
else data[rxManagerType][readyEditIndex] = rx;
saveReadyRxData(data);
alert("تم حفظ الوصفة الجاهزة");
readyEditIndex = null;
readyEditMeds = [];
renderReadyManager();
}

/* ---------- Drug guide manager ---------- */
function renderGuideManager(){
let data = getDrugGuideData();
let protocols = data[rxManagerType] || {};
let body = document.getElementById("rxManagerBody");
body.innerHTML = `
<div class="manager-section">
<h3>دليل الأدوية</h3>
<div class="protocol-add-row">
<input id="newProtocolName" placeholder="اسم بروتوكول جديد">
<button onclick="addGuideProtocol()">➕ إضافة بروتوكول</button>
</div>
<div class="manager-list">
${Object.keys(protocols).map(k=>`
<div class="manager-item">
<b>${escapeHtml(k)}</b><br>
<small>${(protocols[k] || []).length} أدوية</small><br>
<button onclick="editGuideProtocol('${escapeHtml(k)}')">فتح / تعديل</button>
<button onclick="deleteGuideProtocol('${escapeHtml(k)}')">حذف البروتوكول</button>
</div>
`).join("") || "<p>لا توجد بروتوكولات</p>"}
</div>
</div>
<div id="guideEditor"></div>
`;
if(guideEditProtocol) renderGuideProtocolEditor();
}

function addGuideProtocol(){
let name = getFieldValue("newProtocolName").trim();
if(!name){ alert("اكتب اسم البروتوكول"); return; }
let data = getDrugGuideData();
data[rxManagerType] = data[rxManagerType] || {};
if(data[rxManagerType][name]){ alert("هذا البروتوكول موجود"); return; }
data[rxManagerType][name] = [];
saveDrugGuideData(data);
guideEditProtocol = name;
guideEditMedIndex = null;
renderGuideManager();
}

function editGuideProtocol(name){
guideEditProtocol = name;
guideEditMedIndex = null;
renderGuideManager();
}

function deleteGuideProtocol(name){
if(!confirm("حذف البروتوكول مع كل أدويته؟")) return;
let data = getDrugGuideData();
if(data[rxManagerType]) delete data[rxManagerType][name];
saveDrugGuideData(data);
if(guideEditProtocol === name) guideEditProtocol = "";
renderGuideManager();
}

function renderGuideProtocolEditor(){
let data = getDrugGuideData();
let meds = (data[rxManagerType] && data[rxManagerType][guideEditProtocol]) || [];
let editing = guideEditMedIndex !== null ? meds[guideEditMedIndex] : null;
let parts = splitMedNote(editing ? editing.note : "");
let editor = document.getElementById("guideEditor");
if(!editor) return;
editor.innerHTML = `
<div class="manager-editor">
<h3>بروتوكول: ${escapeHtml(guideEditProtocol)}</h3>
<div class="manager-list">
${meds.map((m,i)=>`
<div class="manager-med-row">
${m.warning ? `<div class="med-warning">${escapeHtml(m.warning)}</div>` : ""}
<b>${escapeHtml(m.name)}</b> - ${escapeHtml(m.dose)}<br>
<small>${escapeHtml(m.note)}</small><br>
<button onclick="startEditGuideMed(${i})">✏️ تعديل</button>
<button onclick="deleteGuideMed(${i})">🗑 حذف</button>
</div>
`).join("") || "<p>لا توجد أدوية في هذا البروتوكول</p>"}
</div>

<h4>${editing ? "تعديل دواء" : "إضافة دواء جديد"}</h4>
<div class="manual-med-grid">
<input id="guideMedName" placeholder="اسم الدواء" value="${escapeHtml(editing ? editing.name : "")}">
<input id="guideMedDose" placeholder="الجرعة" value="${escapeHtml(editing ? editing.dose : "")}">
<input id="guideMedTime" placeholder="أوقات الدواء" value="${escapeHtml(parts.time)}">
<input id="guideMedNote" placeholder="ملاحظات" value="${escapeHtml(parts.note)}">
<input id="guideMedWarning" placeholder="تحذير يظهر بالأحمر" value="${escapeHtml(editing ? editing.warning : "")}">
</div>
<button onclick="saveGuideMedEditor()">💾 ${editing ? "حفظ تعديل الدواء" : "إضافة الدواء"}</button>
${editing ? `<button onclick="cancelGuideMedEdit()">إلغاء التعديل</button>` : ""}
</div>
`;
}

function startEditGuideMed(index){
guideEditMedIndex = index;
renderGuideProtocolEditor();
}

function cancelGuideMedEdit(){
guideEditMedIndex = null;
renderGuideProtocolEditor();
}

function saveGuideMedEditor(){
let name = getFieldValue("guideMedName").trim();
let dose = getFieldValue("guideMedDose").trim();
let time = getFieldValue("guideMedTime").trim();
let note = getFieldValue("guideMedNote").trim();
let warning = getFieldValue("guideMedWarning").trim();
if(!name){ alert("اكتب اسم الدواء"); return; }
let data = getDrugGuideData();
data[rxManagerType] = data[rxManagerType] || {};
data[rxManagerType][guideEditProtocol] = data[rxManagerType][guideEditProtocol] || [];
let med = {name,dose,note:medNoteFromParts(time,note)};
if(warning) med.warning = warning;
if(guideEditMedIndex === null) data[rxManagerType][guideEditProtocol].push(med);
else data[rxManagerType][guideEditProtocol][guideEditMedIndex] = med;
saveDrugGuideData(data);
guideEditMedIndex = null;
renderGuideProtocolEditor();
}

function deleteGuideMed(index){
if(!confirm("حذف الدواء؟")) return;
let data = getDrugGuideData();
data[rxManagerType][guideEditProtocol].splice(index,1);
saveDrugGuideData(data);
guideEditMedIndex = null;
renderGuideProtocolEditor();
}

/* =========================
   BACK
========================= */

function goBack(){

if(rxHistory.length<=1){

if(patient){
openPatient(patient);
}else{
backToHome();
}

return;
}

rxHistory.pop();

let step=rxHistory[rxHistory.length-1];

if(step==="type"){
renderTypeStep();
}else if(step==="mode"){
renderModeStep();
}else if(step==="ready"){
renderModeStep();
}else if(step==="protocols"){
renderModeStep();
}else if(step==="meds"){
renderProtocols();
}else{
openPrescription();
}
}


function hasAllergyConflict(meds){
let allergyText = ((patient && patient.allergy) || getFieldValue("allergy") || "").toLowerCase();
if(!allergyText.trim()) return false;

let riskyWords = [
"amoxicillin","augmentin","clavulanic","penicillin","بنسلين","اموكس","اوغمنتين","أوغمنتين"
];

let allergyMentionsPenicillin = riskyWords.some(w => allergyText.includes(w));
if(!allergyMentionsPenicillin) return false;

return (meds || []).some(m=>{
let txt = ((m.name||"") + " " + (m.dose||"") + " " + (m.note||"")).toLowerCase();
return riskyWords.some(w => txt.includes(w));
});
}

function viewOldPrescription(index){
if(!patient || !patient.prescriptions || !patient.prescriptions[index]) return;
rxPreview = patient.prescriptions[index];
previewPrescription();
}

function reusePrescription(index){
if(!patient || !patient.prescriptions || !patient.prescriptions[index]) return;
let old = patient.prescriptions[index];
rxPreview = {
date:nowDateTime(),
type:old.type || "",
title:(old.title || "وصفة سابقة") + " - نسخة جديدة",
meds:[...(old.meds || [])],
instructions:[...(old.instructions || [])]
};
patient.prescriptions.push(rxPreview);
saveAll();
renderGeneratedRx(rxPreview);
previewPrescription();
}

function deletePrescription(index){
if(!patient || !patient.prescriptions || !patient.prescriptions[index]) return;
if(!confirm("حذف هذه الوصفة؟")) return;
patient.prescriptions.splice(index,1);
saveAll();
openPatient(patient);
}

function clearPatientFields(){

["name","age","phone","allergy","chronic","notes","fileNo"].forEach(id=>{
const el = document.getElementById(id);
if(el) el.value = "";
});

const output = document.getElementById("output");
if(output) output.innerHTML = "";

const printArea = document.getElementById("printArea");
if(printArea){
printArea.innerHTML = "";
printArea.style.display = "none";
}

const searchBox = document.getElementById("searchBox");
if(searchBox) searchBox.style.display = "none";

const suggestionsBox = document.getElementById("suggestionsBox");
if(suggestionsBox) suggestionsBox.innerHTML = "";

const createNewBtn = document.getElementById("createNewBtn");
if(createNewBtn) createNewBtn.style.display = "none";

patient = null;
rxPreview = null;
selectedMeds = [];
rxType = "";
rxHistory = [];
currentProtocolList = [];
currentProtocolName = "";
}

function backToHome(){
const searchBox=document.getElementById("searchBox");
if(searchBox) searchBox.style.display="none";
const backBtn=document.getElementById("backBtn");
if(backBtn) backBtn.style.display="none";
const printArea=document.getElementById("printArea");
if(printArea) printArea.style.display="none";
renderDashboard();
}


document.addEventListener("DOMContentLoaded", function(){
renderDashboard();
});


/* =========================================================
   ADVANCED CLINIC MODULES
   Appointments + Treatment Plan + Advanced Media + Compare
   Installments + Professional Tooth Chart
   Added safely as overrides; original prescription/print logic stays unchanged.
========================================================= */

function todayISO(){
const d = new Date();
return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function safeArray(v){
return Array.isArray(v) ? v : [];
}

function ensureAdvancedPatientData(p){
if(!p) return p;
p.appointments = safeArray(p.appointments);
p.treatmentPlans = safeArray(p.treatmentPlans);
p.teeth = p.teeth || {};
p.media = p.media || {};
p.media.xrays = safeArray(p.media.xrays);
p.media.photos = safeArray(p.media.photos);
p.finance = p.finance || {charges:[], payments:[], installments:[]};
p.finance.charges = safeArray(p.finance.charges);
p.finance.payments = safeArray(p.finance.payments);
p.finance.installments = safeArray(p.finance.installments);
return p;
}

function getAllAppointments(){
let out = [];
getPatients().forEach(p=>{
ensureAdvancedPatientData(p);
(p.appointments || []).forEach((a,i)=>{
out.push({patient:p, appointment:a, index:i});
});
});
return out;
}

function getAppointmentStats(){
let today = todayISO();
let all = getAllAppointments();
let todayCount = all.filter(x => (x.appointment.date || "") === today && x.appointment.status !== "done").length;
let overdue = all.filter(x => (x.appointment.date || "") < today && x.appointment.status !== "done").length;
return {todayCount, overdue, total:all.length};
}

function getUpcomingAppointments(limit=5){
let today = todayISO();
return getAllAppointments()
.filter(x => (x.appointment.date || "") >= today && x.appointment.status !== "done")
.sort((a,b)=>((a.appointment.date||"")+(a.appointment.time||"")).localeCompare((b.appointment.date||"")+(b.appointment.time||"")))
.slice(0,limit);
}

/* =========================
   DASHBOARD OVERRIDE
========================= */
function renderDashboard(){

let stats = getClinicStats();
let apptStats = getAppointmentStats();
let upcoming = getUpcomingAppointments(6);
let today = new Date().toLocaleDateString();

const output = document.getElementById("output");
if(!output) return;

output.innerHTML = `
<section class="dashboard-hero pro-hero">
<div class="hero-glow"></div>
<div class="hero-content">
<div>
<span class="hero-label">Dental Chain | Dr. Taher</span>
<h1>نظام عيادة د. طاهر الأجا</h1>
<p>DDS, PhD-Endodontics · إدارة المرضى والوصفات والخطة العلاجية</p>
</div>
<div class="hero-date">${today}</div>
</div>
</section>

<section class="stats-grid">
<div class="stat-card"><span>👥</span><b>${stats.patients}</b><small>المرضى</small></div>
<div class="stat-card"><span>📅</span><b>${apptStats.todayCount}</b><small>مواعيد اليوم</small></div>
<div class="stat-card"><span>🧾</span><b>${stats.prescriptions}</b><small>الوصفات</small></div>
<div class="stat-card"><span>💰</span><b>${formatMoney(stats.balance)}</b><small>الرصيد المتبقي</small></div>
</section>

<section class="quick-actions">
<button onclick="openAppointmentsManager()">📅 المواعيد</button>
<button onclick="exportBackup()">📦 نسخة احتياطية</button>
</section>

<section class="dashboard-panels">
<div class="card dashboard-panel">
<h3>📅 المواعيد القادمة</h3>
${upcoming.length ? upcoming.map(x=>`
<div class="mini-appointment">
<b>${escapeHtml(x.patient.name || "")}</b>
<span>${escapeHtml(x.appointment.date || "")} ${escapeHtml(x.appointment.time || "")}</span>
<small>${escapeHtml(x.appointment.type || "")}</small>
</div>
`).join("") : "<p>لا توجد مواعيد قادمة.</p>"}
</div>

<div class="card dashboard-panel">
<h3>⚠ تنبيهات سريعة</h3>
${apptStats.overdue ? `<div class="alert-pill">يوجد ${apptStats.overdue} موعد متأخر عن المراجعة</div>` : `<div class="alert-pill ok-alert">لا توجد مواعيد متأخرة</div>`}
<div class="alert-pill">تأكد من أخذ نسخة احتياطية بشكل دوري</div>
</div>
</section>
`;

const backBtn = document.getElementById("backBtn");
if(backBtn) backBtn.style.display = "none";
}

/* =========================
   APPOINTMENTS
========================= */
function openAppointmentsManager(){
let all = getAllAppointments()
.sort((a,b)=>((a.appointment.date||"")+(a.appointment.time||"")).localeCompare((b.appointment.date||"")+(b.appointment.time||"")));

document.getElementById("output").innerHTML = `
<div class="card appointments-manager">
<h2>📅 إدارة المواعيد</h2>

<div class="appointment-form">
<h3>${patient ? "موعد جديد للمريض: " + escapeHtml(patient.name || "") : "افتح ملف مريض لإضافة موعد خاص به"}</h3>
<input id="apptDate" type="date" value="${todayISO()}">
<input id="apptTime" type="time">
<input id="apptType" placeholder="نوع الموعد: مراجعة / قلع / لبية / صورة">
<textarea id="apptNote" placeholder="ملاحظات الموعد"></textarea>
<button onclick="addAppointmentFromManager()">➕ حفظ الموعد</button>
</div>

<h3>كل المواعيد</h3>
<div class="appointments-list">
${all.length ? all.map(x=>`
<div class="appointment-row ${x.appointment.status === "done" ? "done-appointment" : ""}">
<div>
<b>${escapeHtml(x.patient.name || "")}</b>
<small>${escapeHtml(x.patient.fileNo || "")}</small>
<p>${escapeHtml(x.appointment.date || "")} - ${escapeHtml(x.appointment.time || "")}</p>
<p>${escapeHtml(x.appointment.type || "")} ${x.appointment.note ? " - " + escapeHtml(x.appointment.note) : ""}</p>
</div>
<div>
<button onclick="openPatientByFileNo('${escapeHtml(x.patient.fileNo || "")}')">فتح الملف</button>
<button onclick="markAppointmentDone('${escapeHtml(x.patient.fileNo || "")}',${x.index})">تم</button>
<button onclick="deleteAppointment('${escapeHtml(x.patient.fileNo || "")}',${x.index})">حذف</button>
</div>
</div>
`).join("") : "<p>لا توجد مواعيد.</p>"}
</div>

<button onclick="backToHome()">رجوع</button>
</div>
`;
document.getElementById("backBtn").style.display="block";
}

function openPatientByFileNo(fileNo){
let p = getPatients().find(x => (x.fileNo || "") === fileNo);
if(p) openPatient(p);
}

function addAppointmentFromManager(){
if(!patient){
alert("افتح ملف مريض أولاً أو اختر ساعة من جدول اليوم ثم اختر المريض");
return;
}
ensureAdvancedPatientData(patient);

let date = normalizeAppointmentDate(getFieldValue("apptDate"));
let time = normalizeAppointmentTime(getFieldValue("apptTime") || getFieldValue("apptTimeDisplay"));
let type = getFieldValue("apptType").trim();
let note = getFieldValue("apptNote").trim();

if(!date){
alert("حدد تاريخ الموعد");
return;
}
if(!time){
alert("حدد ساعة الموعد من جدول اليوم");
return;
}

let conflict = getAppointmentsForDate(date).find(x => normalizeAppointmentTime(x.appointment.time) === time && (x.patient.fileNo || "") !== (patient.fileNo || ""));
if(conflict){
alert("هذه الساعة محجوزة لمريض آخر");
return;
}

patient.appointments.push({
date,
time,
type,
note,
status:"pending",
createdAt:nowDateTime()
});

saveAll();
alert("تم حفظ الموعد");
openAppointmentsManager(date);
}

function markAppointmentDone(fileNo,index){
let patients = getPatients();
let p = patients.find(x => (x.fileNo || "") === fileNo);
if(!p || !p.appointments || !p.appointments[index]) return;
p.appointments[index].status = "done";
p.appointments[index].doneAt = nowDateTime();
savePatients(patients);
if(patient && patient.fileNo === fileNo) patient = p;
openAppointmentsManager();
}

function deleteAppointment(fileNo,index){
if(!confirm("حذف الموعد؟")) return;
let patients = getPatients();
let p = patients.find(x => (x.fileNo || "") === fileNo);
if(!p || !p.appointments) return;
p.appointments.splice(index,1);
savePatients(patients);
if(patient && patient.fileNo === fileNo) patient = p;
openAppointmentsManager();
}

function renderPatientAppointments(p){
ensureAdvancedPatientData(p);
let arr = p.appointments || [];
if(arr.length === 0) return "<p>لا توجد مواعيد لهذا المريض.</p>";
return `
<div class="appointments-list">
${arr.map((a,i)=>`
<div class="appointment-row ${a.status === "done" ? "done-appointment" : ""}">
<div>
<b>${escapeHtml(a.date || "")} ${escapeHtml(a.time || "")}</b>
<p>${escapeHtml(a.type || "")}</p>
<small>${escapeHtml(a.note || "")}</small>
</div>
<div>
<button onclick="markAppointmentDone('${escapeHtml(p.fileNo || "")}',${i})">تم</button>
<button onclick="deleteAppointment('${escapeHtml(p.fileNo || "")}',${i})">حذف</button>
</div>
</div>
`).join("")}
</div>
`;
}

/* =========================
   TREATMENT PLAN
========================= */
function getTreatmentPlans(p){
ensureAdvancedPatientData(p);
return p.treatmentPlans;
}

function renderTreatmentPlanSummary(p){
let plans = getTreatmentPlans(p);
if(plans.length === 0) return "<p>لا توجد خطة علاج بعد.</p>";

return `
<div class="treatment-plan-list">
${plans.map((plan,i)=>{
let steps = safeArray(plan.steps);
let done = steps.filter(s=>s.done).length;
let percent = steps.length ? Math.round(done * 100 / steps.length) : 0;
return `
<div class="treatment-plan-card">
<div class="plan-top">
<b>🦷 ${escapeHtml(plan.tooth || "عام")} - ${escapeHtml(plan.title || "")}</b>
<span>${percent}%</span>
</div>
<div class="plan-progress"><i style="width:${percent}%"></i></div>
<p>${escapeHtml(plan.note || "")}</p>
<small>التكلفة: ${formatMoney(plan.cost || 0)}</small>
<div class="plan-steps">
${steps.map((s,si)=>`
<label class="${s.done ? "done-step" : ""}">
<input type="checkbox" ${s.done ? "checked" : ""} onchange="toggleTreatmentStep(${i},${si})">
${escapeHtml(s.text || "")}
</label>
`).join("")}
</div>
<button onclick="editTreatmentPlan(${i})">✏️ تعديل</button>
<button onclick="deleteTreatmentPlan(${i})">🗑 حذف</button>
</div>
`;
}).join("")}
</div>
`;
}

function openTreatmentPlanManager(toothNumber=""){
if(!patient){
alert("افتح ملف مريض أولاً");
return;
}
ensureAdvancedPatientData(patient);

document.getElementById("output").innerHTML = `
<div class="card treatment-manager">
<h2>🦷 خطة العلاج - ${escapeHtml(patient.name || "")}</h2>

<div class="treatment-form">
<input id="planTooth" placeholder="رقم السن أو عام" value="${escapeHtml(toothNumber)}">
<input id="planTitle" placeholder="عنوان الخطة: لبية / تاج / زرعة / حشوات">
<textarea id="planSteps" placeholder="اكتب كل خطوة بسطر مستقل&#10;مثال: فتح حجرة&#10;تحضير قنوات&#10;حشو قنوات"></textarea>
<input id="planCost" type="number" placeholder="التكلفة المتوقعة">
<textarea id="planNote" placeholder="ملاحظات الخطة"></textarea>
<button onclick="addTreatmentPlan()">➕ إضافة الخطة</button>
</div>

<h3>الخطط الحالية</h3>
${renderTreatmentPlanSummary(patient)}

<br>
<button onclick="openPatient(patient)">رجوع لملف المريض</button>
</div>
`;
document.getElementById("backBtn").style.display="block";
}

function addTreatmentPlan(){
if(!patient) return;
let tooth = getFieldValue("planTooth").trim();
let title = getFieldValue("planTitle").trim();
let rawSteps = getFieldValue("planSteps");
let cost = Number(getFieldValue("planCost") || 0);
let note = getFieldValue("planNote").trim();

if(!title){
alert("اكتب عنوان الخطة");
return;
}

let steps = rawSteps.split("\n").map(x=>x.trim()).filter(Boolean).map(text=>({text, done:false}));
if(steps.length === 0) steps = [{text:"بدء العلاج", done:false}];

getTreatmentPlans(patient).push({
id:Date.now(),
tooth,
title,
steps,
cost,
note,
createdAt:nowDateTime()
});

if(cost > 0){
let finance = getPatientFinance(patient);
finance.charges.push({
date:nowDateTime(),
label:"خطة علاج: " + title + (tooth ? " - سن " + tooth : ""),
amount:cost
});
}

saveAll();
openTreatmentPlanManager();
}

function editTreatmentPlan(index){
let plans = getTreatmentPlans(patient);
let plan = plans[index];
if(!plan) return;
let title = prompt("عنوان الخطة", plan.title || "");
if(title === null) return;
let cost = prompt("التكلفة", plan.cost || "");
if(cost === null) return;
let currency = prompt("العملة: اكتب SYP أو USD", getTreatmentPlanCurrency(plan));
if(currency === null) return;
let note = prompt("ملاحظات", plan.note || "");
if(note === null) return;

let newCost = Number(cost || 0);
if(newCost < 0){
alert("التكلفة لا يمكن أن تكون سالبة");
return;
}

plan.title = title;
plan.cost = newCost;
plan.currency = normalizeCurrency(currency);
plan.note = note;
plan.updatedAt = nowDateTime();
upsertTreatmentPlanFinanceCharge(plan);

saveAll();
openTreatmentPlanManager();
}

function toggleTreatmentStep(planIndex, stepIndex){
let plans = getTreatmentPlans(patient);
if(!plans[planIndex] || !plans[planIndex].steps[stepIndex]) return;
plans[planIndex].steps[stepIndex].done = !plans[planIndex].steps[stepIndex].done;
plans[planIndex].updatedAt = nowDateTime();
saveAll();
openPatient(patient);
}

function deleteTreatmentPlan(index){
if(!patient) return;
if(!confirm("حذف خطة العلاج؟ سيتم حذف التكلفة المالية المرتبطة بها أيضاً.")) return;
let plans = getTreatmentPlans(patient);
let plan = plans[index];
if(plan){
removeTreatmentPlanFinanceCharge(plan);
}
plans.splice(index,1);
saveAll();
openTreatmentPlanManager();
}

/* =========================
   FINANCE INSTALLMENTS
========================= */
function renderInstallments(p){
let finance = getPatientFinance(p);
finance.installments = safeArray(finance.installments);
if(finance.installments.length === 0) return "<p>لا توجد أقساط مجدولة.</p>";

return `
<div class="installment-list">
${finance.installments.map((x,i)=>`
<div class="installment-row ${x.status === "paid" ? "paid-installment" : ""}">
<div>
<b>${formatMoney(x.amount)}</b>
<small>${escapeHtml(x.dueDate || "")}</small>
<p>${escapeHtml(x.note || "")}</p>
</div>
<div>
<button onclick="toggleInstallment(${i})">${x.status === "paid" ? "إلغاء الدفع" : "تسديد"}</button>
<button onclick="deleteInstallment(${i})">حذف</button>
</div>
</div>
`).join("")}
</div>
`;
}

function openFinanceManager(){
if(!patient){
alert("افتح ملف مريض أولاً");
return;
}

getPatientFinance(patient);

document.getElementById("output").innerHTML = `
<div class="card finance-manager">
<h2>💰 الكشف المالي والأقساط - ${escapeHtml(patient.name || "")}</h2>

${renderFinancialSummary(patient)}

<div class="finance-form">
<h3>إضافة تكلفة علاج</h3>
<input id="chargeLabel" placeholder="البيان: مثال علاج عصب سن 26">
<input id="chargeAmount" type="number" placeholder="المبلغ">
<button onclick="addFinanceCharge()">➕ إضافة تكلفة</button>
</div>

<div class="finance-form">
<h3>إضافة دفعة</h3>
<input id="paymentLabel" placeholder="ملاحظة الدفعة">
<input id="paymentAmount" type="number" placeholder="المبلغ المدفوع">
<button onclick="addFinancePayment()">➕ إضافة دفعة</button>
</div>

<div class="finance-form">
<h3>جدولة قسط</h3>
<input id="installmentAmount" type="number" placeholder="قيمة القسط">
<input id="installmentDate" type="date">
<input id="installmentNote" placeholder="ملاحظة القسط">
<button onclick="addInstallment()">➕ إضافة قسط</button>
</div>

<h3>الأقساط</h3>
${renderInstallments(patient)}

<h3>سجل الحركات</h3>
${renderFinanceHistory(patient)}

<br>
<button onclick="openPatient(patient)">رجوع لملف المريض</button>
</div>
`;

document.getElementById("backBtn").style.display="block";
}

function addInstallment(){
if(!patient) return;
let amount = Number(getFieldValue("installmentAmount") || 0);
let dueDate = getFieldValue("installmentDate");
let note = getFieldValue("installmentNote").trim();

if(!amount || amount <= 0){
alert("أدخل قيمة القسط");
return;
}
if(!dueDate){
alert("حدد تاريخ القسط");
return;
}

let finance = getPatientFinance(patient);
finance.installments = safeArray(finance.installments);
finance.installments.push({
amount,
dueDate,
note,
status:"pending",
createdAt:nowDateTime()
});

saveAll();
openFinanceManager();
}

function toggleInstallment(index){
let finance = getPatientFinance(patient);
let item = finance.installments[index];
if(!item) return;

if(item.status === "paid"){
item.status = "pending";
}else{
item.status = "paid";
item.paidAt = nowDateTime();
finance.payments.push({
date:nowDateTime(),
label:"تسديد قسط: " + (item.note || item.dueDate || ""),
amount:Number(item.amount || 0)
});
}
saveAll();
openFinanceManager();
}

function deleteInstallment(index){
if(!confirm("حذف القسط؟")) return;
let finance = getPatientFinance(patient);
finance.installments.splice(index,1);
saveAll();
openFinanceManager();
}

/* =========================
   ADVANCED MEDIA + COMPARE
========================= */
function ensureMediaCategories(p){
ensureAdvancedPatientData(p);
p.media.xrays.forEach(m=>{ if(!m.category) m.category = "xray"; });
p.media.photos.forEach(m=>{ if(!m.category) m.category = "photo"; });
}

function triggerPatientMediaCategory(type, category){
if(!patient){ alert("افتح ملف مريض أولاً"); return; }
let input = document.createElement("input");
input.type = "file";
input.accept = "image/*";
input.multiple = true;
input.onchange = function(e){ importPatientMedia(type, e, category); };
input.click();
}

function triggerPatientMedia(type){
if(!patient){ alert("افتح ملف مريض أولاً"); return; }
triggerPatientMediaCategory(type, type === "xrays" ? "xray" : "photo");
}

function importPatientMedia(type,event,category){
if(!patient) return;
let files = Array.from(event?.target?.files || []);
if(event && event.target) event.target.value="";
if(files.length === 0) return;
if(window.DCOSPatientArchive && typeof window.DCOSPatientArchive.importFilesToCategory === "function"){
window.DCOSPatientArchive.importFilesToCategory(patient,type,category,files)
.then(result=>{
alert(`تم نسخ ${result.saved || files.length} صورة إلى مجلد المريض فقط. لم تُحفظ داخل المتصفح أو Firebase.`);
if(window.DCOSPatientArchive.openExplorer) window.DCOSPatientArchive.openExplorer(type,category);
})
.catch(error=>alert("تعذر نسخ الصور: " + (error.message || error)));
return;
}
alert("نظام مجلد الصور لم يكتمل تحميله بعد. أعد فتح ملف المريض ثم حاول مجدداً.");
}


function mediaCategoryLabel(cat){
const map = {
xray:"أشعة",
photo:"فوتوغراف",
before:"قبل العلاج",
after:"بعد العلاج",
intra:"داخل الفم",
panorama:"بانوراما",
other:"أخرى"
};
return map[cat] || cat || "صورة";
}

function collectPatientMedia(p){
ensureAdvancedPatientData(p);
ensureMediaCategories(p);
let out = [];
(p.media.xrays || []).forEach((m,i)=>out.push({...m, type:"xrays", index:i}));
(p.media.photos || []).forEach((m,i)=>out.push({...m, type:"photos", index:i}));
return out;
}

function renderPatientMedia(){
let box = document.getElementById("patientMediaBox");
if(!box || !patient) return;

let all = collectPatientMedia(patient);
let grouped = {};
all.forEach(m=>{
let key = m.category || "other";
grouped[key] = grouped[key] || [];
grouped[key].push(m);
});

box.innerHTML = `
<div class="advanced-media-actions">
<button onclick="triggerPatientMediaCategory('xrays','panorama')">☢️ أشعة بانوراما</button>
<button onclick="triggerPatientMediaCategory('xrays','xray')">📷 أشعة</button>
<button onclick="triggerPatientMediaCategory('photos','before')">🦷 صورة قبل</button>
<button onclick="triggerPatientMediaCategory('photos','after')">✅ صورة بعد</button>
<button onclick="triggerPatientMediaCategory('photos','intra')">👄 داخل الفم</button>
<button onclick="openImageCompare()">↔ مقارنة الصور</button>
</div>

${Object.keys(grouped).length ? Object.keys(grouped).map(cat=>`
<div class="media-section">
<h4>${mediaCategoryLabel(cat)}</h4>
<div class="media-grid">
${grouped[cat].map(m=>`
<div class="media-item">
<img src="${m.data}" alt="${escapeHtml(m.name)}" onclick="openImageLightbox('${m.type}',${m.index})">
<small>${escapeHtml(m.name)}</small>
<small>${escapeHtml(m.uploadedAt || "")}</small>
<button onclick="deletePatientMedia('${m.type}',${m.index})">حذف</button>
</div>
`).join("")}
</div>
</div>
`).join("") : "<p>لا توجد صور محفوظة.</p>"}
`;
}

function openImageLightbox(type,index){
let arr = (patient && patient.media && patient.media[type]) || [];
let m = arr[index];
if(!m) return;
let modal = document.createElement("div");
modal.className = "modal image-lightbox";
modal.id = "imageLightbox";
modal.innerHTML = `
<div class="image-lightbox-box">
<img src="${m.data}" alt="${escapeHtml(m.name)}">
<p>${escapeHtml(m.name)} - ${mediaCategoryLabel(m.category)}</p>
<button onclick="document.getElementById('imageLightbox').remove()">إغلاق</button>
</div>
`;
document.body.appendChild(modal);
}

function openImageCompare(){
if(!patient) return;
let all = collectPatientMedia(patient);
if(all.length < 2){
alert("أضف صورتين على الأقل للمقارنة");
return;
}
let opts = all.map((m,i)=>`<option value="${i}">${mediaCategoryLabel(m.category)} - ${escapeHtml(m.name)}</option>`).join("");
let modal = document.createElement("div");
modal.className = "modal compare-modal";
modal.id = "compareModal";
modal.innerHTML = `
<div class="modalBox compare-box">
<h3>↔ مقارنة الصور</h3>
<select id="compareA">${opts}</select>
<select id="compareB">${opts}</select>
<button onclick="renderImageComparison()">عرض المقارنة</button>
<div id="compareResult"></div>
<button onclick="document.getElementById('compareModal').remove()">إغلاق</button>
</div>
`;
document.body.appendChild(modal);
}

function renderImageComparison(){
let all = collectPatientMedia(patient);
let a = all[Number(getFieldValue("compareA"))];
let b = all[Number(getFieldValue("compareB"))];
let box = document.getElementById("compareResult");
if(!a || !b || !box) return;
box.innerHTML = `
<div class="compare-grid">
<div><h4>${mediaCategoryLabel(a.category)}</h4><img src="${a.data}" alt=""></div>
<div><h4>${mediaCategoryLabel(b.category)}</h4><img src="${b.data}" alt=""></div>
</div>
`;
}

/* =========================
   PROFESSIONAL PANORAMA TOOTH CHART - WIDE NATURAL VERSION
   يحافظ على نفس نافذة السن والحالات، ويغيّر شكل وتوزيع الأسنان فقط
========================= */
function toothStateClasses(states){
let cls = [];
if(states.includes("extraction")) cls.push("tooth-missing");
if(states.includes("rootCanal")) cls.push("tooth-root");
if(states.includes("filling")) cls.push("tooth-filling");
if(states.includes("crown")) cls.push("tooth-crown");
if(states.includes("implant")) cls.push("tooth-implant");
if(states.includes("bridge")) cls.push("tooth-bridge");
return cls.join(" ");
}

function getToothNaturalType(num){
let n = String(num || "");
let d = parseInt(n.slice(-1),10);
if(d === 1 || d === 2) return "incisor";
if(d === 3) return "canine";
if(d === 4 || d === 5) return "premolar";
return "molar";
}

function renderToothChart(){
if(!patient) return;
let container = document.getElementById("toothChart");
if(!container) return;

patient.teeth = patient.teeth || {};
let groups = getTeethNumbers();
let chartType = getDentitionType(patient.age);
let chartName = chartType === "adult" ? "Panorama Adult" : (chartType === "mixed" ? "Panorama Mixed" : "Panorama Child");

container.innerHTML = `
<div class="panorama-dental-map panorama-wide-map">

<div class="panorama-map-head">
<div>
<h3>Panorama Dental Map</h3>
<p>${chartName} · خريطة الأسنان البانورامية</p>
</div>
<div class="panorama-view-pill">🦷 Panorama</div>
</div>

<div class="panorama-stage">
<div class="panorama-bg-glow"></div>
<div class="panorama-soft-xray upper-xray"></div>
<div class="panorama-soft-xray lower-xray"></div>
<div class="panorama-arch-guide upper-guide"></div>
<div class="panorama-arch-guide lower-guide"></div>

<div class="panorama-jaw panorama-upper">
${groups.upper.map((n,i)=>renderPanoramaTooth(n,i,groups.upper.length,"upper")).join("")}
</div>

<div class="panorama-center-label">
<span>الفك العلوي</span>
<b></b>
<span>الفك السفلي</span>
</div>

<div class="panorama-jaw panorama-lower">
${groups.lower.map((n,i)=>renderPanoramaTooth(n,i,groups.lower.length,"lower")).join("")}
</div>
</div>

<div class="panorama-legend">
<span><i class="legend-healthy"></i> سليم</span>
<span><i class="legend-filling"></i> حشو</span>
<span><i class="legend-root"></i> لبية</span>
<span><i class="legend-crown"></i> تاج</span>
<span><i class="legend-implant"></i> زرعة</span>
<span><i class="legend-missing"></i> مفقود</span>
</div>

<div class="panorama-hint">اضغط على أي سن لفتح الملاحظات والحالات وخطة العلاج المرتبطة به.</div>

</div>
`;
}

function renderPanoramaTooth(num,index,total,arch){
let t = (patient.teeth && patient.teeth[num]) || {states:[], note:""};
let states = t.states || [];
let missing = states.includes("extraction");
let implant = states.includes("implant");
let kind = getToothNaturalType(num);
let cls = "svg-tooth-btn pano-svg-tooth natural-tooth tooth-" + kind + " " + toothStateClasses(states);
let label = missing ? "فراغ" : num;

let middle = (total - 1) / 2;
let d = index - middle;
let abs = Math.abs(d);
let max = Math.max(middle,1);

/* توزيع بانورامي مفرود: الأسنان الأمامية بالوسط والأرحاء على الأطراف */
let spread = total <= 10 ? 8.6 : 5.55;
let left = 50 + (d * spread);
let normalized = abs / max;
let curve = Math.pow(normalized, 1.75);
let top = arch === "upper" ? (18 + curve * 118) : (142 - curve * 118);
let rotate = d * (arch === "upper" ? 5.2 : -5.2);
let scale = 1 - Math.min(normalized * 0.11, 0.11);

let svg = implant ? renderImplantSvg() : renderNaturalToothSvg(kind);

return `
<button
class="${cls}"
style="left:${left}%; top:${top}px; transform:translateX(-50%) rotate(${rotate}deg) scale(${scale});"
onclick="openToothModal('${num}')"
title="السن ${num}">
${svg}
<small>${label}</small>
</button>
`;
}

function renderNaturalToothSvg(kind){
if(kind === "incisor"){
return `
<svg viewBox="0 0 70 110" aria-hidden="true">
<path class="root single-root" d="M35 46 C27 63 28 90 35 103 C43 90 43 63 35 46 Z"></path>
<path class="crown incisor-crown" d="M18 16 C19 5 30 6 35 12 C40 6 52 5 53 17 C55 35 48 50 38 55 C35 57 31 57 28 55 C19 50 16 34 18 16 Z"></path>
<path class="enamel-shine" d="M28 15 C24 27 24 39 29 49"></path>
<circle class="tooth-filling-dot" cx="35" cy="30" r="8"></circle>
<path class="tooth-root-canal" d="M35 48 C34 64 34 82 35 98"></path>
</svg>`;
}

if(kind === "canine"){
return `
<svg viewBox="0 0 70 118" aria-hidden="true">
<path class="root long-root" d="M35 48 C25 68 27 101 35 113 C44 101 45 68 35 48 Z"></path>
<path class="crown canine-crown" d="M17 18 C19 5 31 7 35 13 C39 7 52 5 54 18 C56 36 47 48 36 58 C34 60 32 60 30 58 C19 48 15 36 17 18 Z"></path>
<path class="enamel-shine" d="M29 16 C25 29 26 42 31 52"></path>
<circle class="tooth-filling-dot" cx="35" cy="31" r="8"></circle>
<path class="tooth-root-canal" d="M35 50 C34 70 34 91 35 108"></path>
</svg>`;
}

if(kind === "premolar"){
return `
<svg viewBox="0 0 78 112" aria-hidden="true">
<path class="root premolar-root-left" d="M32 48 C23 66 24 92 32 106 C38 88 39 66 37 49 Z"></path>
<path class="root premolar-root-right" d="M45 48 C54 66 53 92 45 106 C39 88 38 66 40 49 Z"></path>
<path class="crown premolar-crown" d="M18 18 C20 5 32 7 39 13 C46 7 58 5 61 19 C64 36 55 51 45 57 C40 60 35 60 31 57 C21 51 15 36 18 18 Z"></path>
<path class="cusp-line" d="M28 30 C35 24 44 24 51 30"></path>
<circle class="tooth-filling-dot" cx="39" cy="33" r="8"></circle>
<path class="tooth-root-canal" d="M39 50 C38 66 38 85 39 102"></path>
</svg>`;
}

return `
<svg viewBox="0 0 92 116" aria-hidden="true">
<path class="root molar-root-left" d="M35 51 C24 68 24 96 34 111 C42 92 43 70 42 52 Z"></path>
<path class="root molar-root-right" d="M57 51 C68 68 68 96 58 111 C50 92 49 70 50 52 Z"></path>
<path class="crown molar-crown" d="M16 21 C18 7 31 7 38 14 C44 6 53 6 59 14 C68 8 78 12 80 25 C83 43 72 56 59 62 C51 65 41 65 33 62 C20 56 13 42 16 21 Z"></path>
<path class="cusp-line" d="M28 31 C38 24 52 24 64 32"></path>
<path class="cusp-line second" d="M29 43 C42 48 54 48 66 42"></path>
<circle class="tooth-filling-dot" cx="46" cy="37" r="9"></circle>
<path class="tooth-root-canal" d="M46 54 C45 72 45 92 46 108"></path>
</svg>`;
}

function renderImplantSvg(){
return `
<svg viewBox="0 0 76 112" aria-hidden="true">
<path class="implant-crown" d="M20 18 C21 7 33 8 38 14 C43 8 55 7 57 19 C60 35 52 48 43 53 C39 56 35 56 31 53 C22 48 17 35 20 18 Z"></path>
<path class="implant-screw-body" d="M38 52 C31 64 31 96 38 109 C45 96 45 64 38 52 Z"></path>
<path class="implant-thread" d="M28 62 L48 68 M28 74 L48 80 M28 86 L48 92 M30 98 L46 103"></path>
<ellipse class="implant-head" cx="38" cy="53" rx="13" ry="5"></ellipse>
</svg>`;
}

function openToothModal(num){
if(!patient) return;
patient.teeth = patient.teeth || {};
let t = patient.teeth[num] || {states:[], note:""};
let states = t.states || [];
let modal = document.createElement("div");
modal.className = "modal tooth-modal";
modal.id = "toothModal";
modal.innerHTML = `
<div class="modalBox tooth-modal-box">
<h3>السن ${num}</h3>
<p class="modal-hint">يمكن اختيار حالة واحدة أو عدة حالات، أو إنشاء خطة علاج مرتبطة بهذا السن</p>
<label><input type="checkbox" value="extraction" ${states.includes("extraction") ? "checked" : ""}> قلع / فراغ</label>
<label><input type="checkbox" value="rootCanal" ${states.includes("rootCanal") ? "checked" : ""}> علاج عصب</label>
<label><input type="checkbox" value="filling" ${states.includes("filling") ? "checked" : ""}> حشو</label>
<label><input type="checkbox" value="crown" ${states.includes("crown") ? "checked" : ""}> تتويج</label>
<label><input type="checkbox" value="implant" ${states.includes("implant") ? "checked" : ""}> زرعة</label>
<label><input type="checkbox" value="bridge" ${states.includes("bridge") ? "checked" : ""}> جسر</label>
<label><input type="checkbox" value="watch" ${states.includes("watch") ? "checked" : ""}> مراقبة / ملاحظة</label>
<textarea id="toothNote" placeholder="ملاحظة العلاج أو الإجراء">${escapeHtml(t.note || "")}</textarea>
<div class="modal-actions">
<button onclick="saveToothState('${num}')">حفظ</button>
<button onclick="openTreatmentPlanManager('${num}')">🦷 خطة علاج لهذا السن</button>
<button onclick="clearToothState('${num}')">تفريغ السن</button>
<button onclick="closeToothModal()">إغلاق</button>
</div>
</div>
`;
document.body.appendChild(modal);
}

/* =========================
   TIMELINE OVERRIDE
========================= */
function getPatientTimelineItems(p){
let items = [];
ensureAdvancedPatientData(p);

(p.appointments || []).forEach(a=>{
items.push({date:a.date || "", icon:"📅", title:"موعد", text:`${a.time || ""} ${a.type || ""} ${a.status === "done" ? " - تم" : ""}`});
});

(p.treatmentPlans || []).forEach(plan=>{
let steps = safeArray(plan.steps);
let done = steps.filter(s=>s.done).length;
items.push({date:plan.updatedAt || plan.createdAt || "", icon:"🦷", title:"خطة علاج " + (plan.tooth || ""), text:`${plan.title || ""} - ${done}/${steps.length} خطوات`});
});

(p.visits || []).forEach(v=>items.push({date:v.date || "", icon:"📝", title:"زيارة", text:v.text || ""}));
(p.prescriptions || []).forEach(rx=>items.push({date:rx.date || "", icon:"🧾", title:rx.title || rx.type || "وصفة", text:(rx.meds || []).map(m=>m.name).join("، ")}));

if(p.teeth){
Object.keys(p.teeth).forEach(num=>{
let t = p.teeth[num];
if(t && ((t.states || []).length || t.note)){
items.push({date:t.updatedAt || "", icon:"🦷", title:"السن " + num, text:[...(t.states || []), t.note || ""].filter(Boolean).join(" - ")});
}
});
}

let media = collectPatientMedia(p);
media.forEach(m=>items.push({date:m.uploadedAt || "", icon:"🖼", title:mediaCategoryLabel(m.category), text:m.name || ""}));

return items.reverse();
}

/* =========================
   OPEN PATIENT OVERRIDE
========================= */
function openPatient(p){

patient=ensurePatientFileNo(p);
ensureAdvancedPatientData(patient);
ensureMediaCategories(patient);
fillPatientFields(patient);

const chartType = getDentitionType(patient.age);
const chartTitle = chartType === "adult" ? "خريطة أسنان الكبار" : (chartType === "mixed" ? "خريطة الأسنان المختلطة" : "خريطة أسنان الأطفال");

document.getElementById("output").innerHTML=`
<div class="patient-file-layout">

<div class="patient-main-card card patient-profile-card">

<div class="profile-header">
<div>
<h2>${escapeHtml(patient.name || "")}</h2>
<p>رقم الملف: ${escapeHtml(patient.fileNo || "")}</p>
</div>
<div class="profile-badge">ملف مريض</div>
</div>

${renderMedicalAlerts(patient)}

<div class="patient-info-grid">
<div><small>العمر</small><b>${escapeHtml(patient.age || "")}</b></div>
<div><small>الهاتف</small><b>${escapeHtml(patient.phone || "")}</b></div>
<div><small>التحسس الدوائي</small><b>${escapeHtml(patient.allergy || "لا يوجد")}</b></div>
<div><small>الأمراض المزمنة</small><b>${escapeHtml(patient.chronic || "لا يوجد")}</b></div>
</div>

<p class="patient-notes">الملاحظات: ${escapeHtml(patient.notes || "")}</p>

<div class="profile-actions">
<button onclick="openPrescription()">🧾 وصفة</button>
<button onclick="openVisit()">➕ زيارة</button>
<button onclick="openAppointmentsManager()">📅 موعد</button>
<button onclick="openTreatmentPlanManager()">🦷 خطة علاج</button>
<button onclick="openFinanceManager()">💰 كشف مالي وأقساط</button>
<button onclick="printPatientReport()">📄 تقرير المريض</button>
<button onclick="editPatient()">✏️ تعديل</button>
<button onclick="deletePatient()">🗑 حذف</button>
</div>

<hr>

<h3>الكشف المالي</h3>
${renderFinancialSummary(patient)}

<hr>

<h3>المواعيد</h3>
${renderPatientAppointments(patient)}

<hr>

<h3>خطة العلاج</h3>
${renderTreatmentPlanSummary(patient)}

<hr>

<h3>الخط الزمني</h3>
${renderPatientTimeline(patient)}

<hr>

<details>
<summary>الزيارات القديمة</summary>
${renderLegacyVisits(patient)}
</details>

<details>
<summary>الوصفات السابقة</summary>
${renderLegacyPrescriptions(patient)}
</details>

<hr>

<h3>صور المريض</h3>
<div id="patientMediaBox"></div>

</div>

<div class="tooth-chart-card card">
<h3>${chartTitle}</h3>
<p class="tooth-chart-hint">اضغط على أي سن لتسجيل العلاج أو الحالة أو خطة علاج</p>
<div id="toothChart"></div>
</div>

</div>
`;

document.getElementById("backBtn").style.display="block";
renderToothChart();
renderPatientMedia();
saveAll();
}


/* =========================================================
   PATCH: MULTI-CURRENCY FINANCE + MIXED DENTITION + WEEK CALENDAR
   Added safely at end to override previous functions without removing features.
========================================================= */

function normalizeCurrency(value){
return value === "USD" ? "USD" : "SYP";
}

function currencyLabel(value){
return normalizeCurrency(value) === "USD" ? "$" : "ل.س";
}

function formatMoneyWithCurrency(amount,currency){
return formatMoney(amount) + " " + currencyLabel(currency);
}

function getFinanceTotals(p){
let finance = getPatientFinance(p);
let totals = {
SYP:{totalCharges:0,totalPayments:0,balance:0},
USD:{totalCharges:0,totalPayments:0,balance:0}
};

(finance.charges || []).forEach(x=>{
let c = normalizeCurrency(x.currency);
totals[c].totalCharges += Number(x.amount || 0);
});

(finance.payments || []).forEach(x=>{
let c = normalizeCurrency(x.currency);
totals[c].totalPayments += Number(x.amount || 0);
});

Object.keys(totals).forEach(c=>{
totals[c].balance = totals[c].totalCharges - totals[c].totalPayments;
});

return totals;
}

function renderFinancialSummary(p){
let totals = getFinanceTotals(p);
return `
<div class="finance-summary multi-currency-summary">
<div>
<small>الإجمالي بالسوري</small>
<b>${formatMoneyWithCurrency(totals.SYP.totalCharges,"SYP")}</b>
</div>
<div>
<small>سلفة بالسوري</small>
<b>${formatMoneyWithCurrency(totals.SYP.totalPayments,"SYP")}</b>
</div>
<div class="${totals.SYP.balance > 0 ? "finance-due" : "finance-ok"}">
<small>الباقي بالسوري</small>
<b>${formatMoneyWithCurrency(totals.SYP.balance,"SYP")}</b>
</div>
<div>
<small>الإجمالي بالدولار</small>
<b>${formatMoneyWithCurrency(totals.USD.totalCharges,"USD")}</b>
</div>
<div>
<small>سلفة بالدولار</small>
<b>${formatMoneyWithCurrency(totals.USD.totalPayments,"USD")}</b>
</div>
<div class="${totals.USD.balance > 0 ? "finance-due" : "finance-ok"}">
<small>الباقي بالدولار</small>
<b>${formatMoneyWithCurrency(totals.USD.balance,"USD")}</b>
</div>
</div>
<button onclick="openFinanceManager()">💰 الكشف المالي</button>
`;
}

function renderFinanceHistory(p){
let finance = getPatientFinance(p);
let rows = [];
(finance.charges || []).forEach((x,i)=>rows.push({...x, currency:normalizeCurrency(x.currency), kind:"charge", index:i}));
(finance.payments || []).forEach((x,i)=>rows.push({...x, currency:normalizeCurrency(x.currency), kind:"payment", index:i}));

if(rows.length === 0) return "<p>لا توجد حركات مالية بعد.</p>";

return `
<div class="finance-history">
${rows.map(r=>`
<div class="finance-row ${r.kind === "charge" ? "charge-row" : "payment-row"}">
<div>
<b>${r.kind === "charge" ? "تكلفة" : "دفعة"}</b>
<small>${escapeHtml(r.date || "")}</small>
<p>${escapeHtml(r.label || r.note || "")}</p>
</div>
<div>
<strong>${formatMoneyWithCurrency(r.amount,r.currency)}</strong>
<button onclick="deleteFinanceItem('${r.kind}',${r.index})">حذف</button>
</div>
</div>
`).join("")}
</div>
`;
}

function openFinanceManager(){
if(!patient){
alert("افتح ملف مريض أولاً");
return;
}

getPatientFinance(patient);

document.getElementById("output").innerHTML = `
<div class="card finance-manager">
<h2>💰 الكشف المالي والأقساط - ${escapeHtml(patient.name || "")}</h2>

${renderFinancialSummary(patient)}

<div class="finance-form">
<h3>إضافة تكلفة علاج</h3>
<input id="chargeLabel" placeholder="البيان: مثال علاج عصب سن 26">
<div class="money-line">
<input id="chargeAmount" type="number" placeholder="المبلغ">
<select id="chargeCurrency">
<option value="SYP">ليرة سورية</option>
<option value="USD">دولار</option>
</select>
</div>
<button onclick="addFinanceCharge()">➕ إضافة تكلفة</button>
</div>

<div class="finance-form">
<h3>إضافة دفعة</h3>
<input id="paymentLabel" placeholder="ملاحظة الدفعة">
<div class="money-line">
<input id="paymentAmount" type="number" placeholder="المبلغ المدفوع">
<select id="paymentCurrency">
<option value="SYP">ليرة سورية</option>
<option value="USD">دولار</option>
</select>
</div>
<button onclick="addFinancePayment()">➕ إضافة دفعة</button>
</div>

<div class="finance-form">
<h3>جدولة قسط</h3>
<div class="money-line">
<input id="installmentAmount" type="number" placeholder="قيمة القسط">
<select id="installmentCurrency">
<option value="SYP">ليرة سورية</option>
<option value="USD">دولار</option>
</select>
</div>
<input id="installmentDate" type="date">
<input id="installmentNote" placeholder="ملاحظة القسط">
<button onclick="addInstallment()">➕ إضافة قسط</button>
</div>

<h3>الأقساط</h3>
${renderInstallments(patient)}

<h3>سجل الحركات</h3>
${renderFinanceHistory(patient)}

<br>
<button onclick="openPatient(patient)">رجوع لملف المريض</button>
</div>
`;

document.getElementById("backBtn").style.display="block";
}

function addFinanceCharge(){
if(!patient) return;
let label = getFieldValue("chargeLabel").trim();
let amount = Number(getFieldValue("chargeAmount") || 0);
let currency = normalizeCurrency(getFieldValue("chargeCurrency"));
if(!amount || amount <= 0){ alert("أدخل مبلغ صحيح"); return; }
let finance = getPatientFinance(patient);
finance.charges.push({date:nowDateTime(),label,amount,currency});
saveAll();
openFinanceManager();
}

function addFinancePayment(){
if(!patient) return;
let label = getFieldValue("paymentLabel").trim();
let amount = Number(getFieldValue("paymentAmount") || 0);
let currency = normalizeCurrency(getFieldValue("paymentCurrency"));
if(!amount || amount <= 0){ alert("أدخل مبلغ صحيح"); return; }
let finance = getPatientFinance(patient);
finance.payments.push({date:nowDateTime(),label,amount,currency});
saveAll();
openFinanceManager();
}

function renderInstallments(p){
let finance = getPatientFinance(p);
finance.installments = safeArray(finance.installments);
if(finance.installments.length === 0) return "<p>لا توجد أقساط مجدولة.</p>";

return `
<div class="installment-list">
${finance.installments.map((x,i)=>`
<div class="installment-row ${x.status === "paid" ? "paid-installment" : ""}">
<div>
<b>${formatMoneyWithCurrency(x.amount,x.currency)}</b>
<small>${escapeHtml(x.dueDate || "")}</small>
<p>${escapeHtml(x.note || "")}</p>
</div>
<div>
<button onclick="toggleInstallment(${i})">${x.status === "paid" ? "إلغاء الدفع" : "تسديد"}</button>
<button onclick="deleteInstallment(${i})">حذف</button>
</div>
</div>
`).join("")}
</div>
`;
}

function addInstallment(){
if(!patient) return;
let amount = Number(getFieldValue("installmentAmount") || 0);
let currency = normalizeCurrency(getFieldValue("installmentCurrency"));
let dueDate = getFieldValue("installmentDate");
let note = getFieldValue("installmentNote").trim();
if(!amount || amount <= 0){ alert("أدخل قيمة القسط"); return; }
let finance = getPatientFinance(patient);
finance.installments = safeArray(finance.installments);
finance.installments.push({amount,currency,dueDate,note,status:"pending",createdAt:nowDateTime()});
saveAll();
openFinanceManager();
}

function getDentitionType(ageValue){
let age = parseInt(ageValue,10);
if(isNaN(age)) return "adult";
if(age <= 5) return "child";
if(age >= 6 && age <= 14) return "mixed";
return "adult";
}

function getTeethNumbers(){
let type = getDentitionType(patient && patient.age);
if(type === "child"){
return {
upper:["55","54","53","52","51","61","62","63","64","65"],
lower:["85","84","83","82","81","71","72","73","74","75"]
};
}
if(type === "mixed"){
return {
upperPermanent:["16","12","11","21","22","26"],
upperPrimary:["55","54","53","52","51","61","62","63","64","65"],
lowerPrimary:["85","84","83","82","81","71","72","73","74","75"],
lowerPermanent:["46","42","41","31","32","36"]
};
}
return {
upper:["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"],
lower:["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"]
};
}

function renderToothChart(){
if(!patient) return;
let container = document.getElementById("toothChart");
if(!container) return;
patient.teeth = patient.teeth || {};
let groups = getTeethNumbers();
let chartType = getDentitionType(patient.age);
let chartName = chartType === "adult" ? "Panorama Adult" : (chartType === "mixed" ? "Panorama Mixed 6-14" : "Panorama Child");
let jawsHtml = "";

if(chartType === "mixed"){
jawsHtml = `
<div class="mixed-label">الأسنان الدائمة العلوية</div>
<div class="panorama-jaw panorama-upper mixed-permanent-row">
${groups.upperPermanent.map((n,i)=>renderPanoramaTooth(n,i,groups.upperPermanent.length,"upper")).join("")}
</div>
<div class="mixed-label">الأسنان المؤقتة العلوية</div>
<div class="panorama-jaw panorama-upper mixed-primary-row">
${groups.upperPrimary.map((n,i)=>renderPanoramaTooth(n,i,groups.upperPrimary.length,"upper")).join("")}
</div>
<div class="panorama-center-label"><span>الفك العلوي</span><b></b><span>الفك السفلي</span></div>
<div class="mixed-label">الأسنان المؤقتة السفلية</div>
<div class="panorama-jaw panorama-lower mixed-primary-row">
${groups.lowerPrimary.map((n,i)=>renderPanoramaTooth(n,i,groups.lowerPrimary.length,"lower")).join("")}
</div>
<div class="mixed-label">الأسنان الدائمة السفلية</div>
<div class="panorama-jaw panorama-lower mixed-permanent-row">
${groups.lowerPermanent.map((n,i)=>renderPanoramaTooth(n,i,groups.lowerPermanent.length,"lower")).join("")}
</div>
`;
}else{
jawsHtml = `
<div class="panorama-jaw panorama-upper">
${groups.upper.map((n,i)=>renderPanoramaTooth(n,i,groups.upper.length,"upper")).join("")}
</div>
<div class="panorama-center-label"><span>الفك العلوي</span><b></b><span>الفك السفلي</span></div>
<div class="panorama-jaw panorama-lower">
${groups.lower.map((n,i)=>renderPanoramaTooth(n,i,groups.lower.length,"lower")).join("")}
</div>
`;
}

container.innerHTML = `
<div class="panorama-dental-map panorama-wide-map ${chartType === "mixed" ? "mixed-panorama-map" : ""}">
<div class="panorama-map-head">
<div>
<h3>Panorama Dental Map</h3>
<p>${chartName} · خريطة الأسنان البانورامية</p>
</div>
<div class="panorama-view-pill">🦷 Panorama</div>
</div>
<div class="panorama-stage">
<div class="panorama-bg-glow"></div>
<div class="panorama-soft-xray upper-xray"></div>
<div class="panorama-soft-xray lower-xray"></div>
<div class="panorama-arch-guide upper-guide"></div>
<div class="panorama-arch-guide lower-guide"></div>
${jawsHtml}
</div>
<div class="panorama-legend">
<span><i class="legend-healthy"></i> سليم</span>
<span><i class="legend-filling"></i> حشو</span>
<span><i class="legend-root"></i> لبية</span>
<span><i class="legend-crown"></i> تاج</span>
<span><i class="legend-implant"></i> زرعة</span>
<span><i class="legend-missing"></i> مفقود</span>
</div>
<div class="panorama-hint">اضغط على أي سن لفتح الملاحظات والحالات وخطة العلاج المرتبطة به.</div>
</div>
`;
}


function normalizeAppointmentDate(dateValue){
if(!dateValue) return "";
let v = String(dateValue).trim();
if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
let d = new Date(v);
if(isNaN(d.getTime())) return v;
return toISODate(d);
}

function normalizeAppointmentTime(timeValue){
if(!timeValue) return "";
let v = String(timeValue).trim();
let m = v.match(/^(\d{1,2}):(\d{2})/);
if(m){
let h = Math.max(0, Math.min(23, Number(m[1])));
let min = Math.max(0, Math.min(59, Number(m[2])));
return String(h).padStart(2,"0") + ":" + String(min).padStart(2,"0");
}
m = v.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm|ص|م)?$/);
if(m){
let h = Number(m[1]);
let min = Number(m[2] || 0);
let ap = (m[3] || "").toUpperCase();
if(ap === "PM" || ap === "م"){
if(h < 12) h += 12;
}
if(ap === "AM" || ap === "ص"){
if(h === 12) h = 0;
}
return String(h).padStart(2,"0") + ":" + String(min).padStart(2,"0");
}
return v;
}

function formatTime12(timeValue){
let t = normalizeAppointmentTime(timeValue);
let m = String(t).match(/^(\d{1,2}):(\d{2})/);
if(!m) return t || "";
let h = Number(m[1]);
let min = m[2];
let ampm = h >= 12 ? "PM" : "AM";
h = h % 12;
if(h === 0) h = 12;
return `${h}:${min} ${ampm}`;
}

function findPatientByFileNo(fileNo){
return getPatients().find(x => (x.fileNo || "") === fileNo);
}

function getClinicWorkingSlots(){
let slots = [];
for(let h=12; h<=16; h++) slots.push(String(h).padStart(2,"0") + ":00");
slots.push("18:30");
for(let h=19; h<=22; h++) slots.push(String(h).padStart(2,"0") + ":00");
slots.push("23:00");
return slots;
}

function addDaysToDate(date,days){
let d = new Date(date.getTime());
d.setDate(d.getDate()+days);
return d;
}

function toISODate(d){
return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function arabicDayName(d){
return ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"][d.getDay()];
}

function firstName(fullName){
return (fullName || "").trim().split(/\s+/)[0] || "";
}

function getAppointmentsForDate(dateISO){
let target = normalizeAppointmentDate(dateISO);
return getAllAppointments()
.filter(x => normalizeAppointmentDate(x.appointment.date || "") === target && x.appointment.status !== "done")
.sort((a,b)=>normalizeAppointmentTime(a.appointment.time || "").localeCompare(normalizeAppointmentTime(b.appointment.time || "")));
}

function renderWeekRail(startISO){
let start = startISO ? new Date(normalizeAppointmentDate(startISO) + "T00:00:00") : new Date();
let days = [];
for(let i=0;i<21;i++) days.push(addDaysToDate(start,i));
return `
<div class="week-rail-wrap">
<div class="week-rail-controls">
<button onclick="openAppointmentsManager('${toISODate(addDaysToDate(start,-7))}')">◀ أسبوع سابق</button>
<button onclick="openAppointmentsManager('${todayISO()}')">اليوم</button>
<button onclick="openAppointmentsManager('${toISODate(addDaysToDate(start,7))}')">أسبوع لاحق ▶</button>
</div>
<div class="week-rail">
${days.map((d,i)=>{
let iso = toISODate(d);
let list = getAppointmentsForDate(iso);
let isFriday = d.getDay() === 5;
return `
<div class="week-day-card week-color-${Math.floor(i/7)%3} ${isFriday ? "closed-day" : ""}" onclick="openDaySchedule('${iso}')">
<b>${arabicDayName(d)}</b>
<strong>${d.getDate()}</strong>
<small>${iso}</small>
<div class="day-count">${isFriday ? "مغلق" : list.length + " مواعيد"}</div>
<div class="day-names">${list.slice(0,3).map(x=>`<span>${escapeHtml(firstName(x.patient.name))}</span>`).join("")}</div>
</div>
`;
}).join("")}
</div>
</div>
`;
}

function openAppointmentsManager(startISO=""){
let selectedISO = normalizeAppointmentDate(startISO || todayISO());
let all = getAllAppointments().sort((a,b)=>(normalizeAppointmentDate(a.appointment.date||"") + normalizeAppointmentTime(a.appointment.time||"")).localeCompare(normalizeAppointmentDate(b.appointment.date||"") + normalizeAppointmentTime(b.appointment.time||"")));

document.getElementById("output").innerHTML = `
<div class="card appointments-manager">
<h2>📅 إدارة المواعيد</h2>
${renderWeekRail(selectedISO)}
<div id="dayScheduleBox"></div>
<div class="appointment-form">
<h3>${patient ? "موعد جديد للمريض: " + escapeHtml(patient.name || "") : "اختر ساعة من جدول اليوم لإضافة موعد"}</h3>
<input id="apptDate" type="date" value="${selectedISO}">
<input id="apptTime" type="hidden">
<input id="apptTimeDisplay" readonly placeholder="اضغط على ساعة من جدول اليوم">
<input id="apptType" placeholder="نوع الموعد: مراجعة / قلع / لبية / صورة">
<textarea id="apptNote" placeholder="ملاحظات الموعد"></textarea>
<button onclick="addAppointmentFromManager()">➕ حفظ الموعد</button>
</div>
<h3>كل المواعيد</h3>
<div class="appointments-list">
${all.length ? all.map(x=>`
<div class="appointment-row ${x.appointment.status === "done" ? "done-appointment" : ""}">
<div>
<b>${escapeHtml(x.patient.name || "")}</b>
<small>${escapeHtml(x.patient.fileNo || "")}</small>
<p>${escapeHtml(normalizeAppointmentDate(x.appointment.date || ""))} - ${escapeHtml(formatTime12(x.appointment.time || ""))}</p>
<p>${escapeHtml(x.appointment.type || "")} ${x.appointment.note ? " - " + escapeHtml(x.appointment.note) : ""}</p>
</div>
<div>
<button onclick="openPatientByFileNo('${escapeHtml(x.patient.fileNo || "")}')">فتح الملف</button>
<button onclick="markAppointmentDone('${escapeHtml(x.patient.fileNo || "")}',${x.index})">تم</button>
<button onclick="deleteAppointment('${escapeHtml(x.patient.fileNo || "")}',${x.index})">حذف</button>
</div>
</div>
`).join("") : "<p>لا توجد مواعيد.</p>"}
</div>
<button onclick="backToHome()">رجوع</button>
</div>
`;
document.getElementById("backBtn").style.display="block";
openDaySchedule(selectedISO);
}

function openDaySchedule(dateISO){
let box = document.getElementById("dayScheduleBox");
if(!box) return;
let cleanDate = normalizeAppointmentDate(dateISO);
let d = new Date(cleanDate + "T00:00:00");
let isFriday = d.getDay() === 5;
let list = getAppointmentsForDate(cleanDate);
let used = {};
list.forEach(x=>{ used[normalizeAppointmentTime(x.appointment.time || "")] = x; });
let slots = getClinicWorkingSlots();
box.innerHTML = `
<div class="day-wheel-card">
<h3>${arabicDayName(d)} - ${cleanDate}</h3>
${isFriday ? `<div class="closed-note">العيادة مغلقة يوم الجمعة</div>` : ""}
<div class="time-wheel">
${slots.map(time=>{
let key = normalizeAppointmentTime(time);
let ap = used[key];
return `
<button type="button" class="time-slot ${ap ? "busy-slot" : "free-slot"}" onclick="openAppointmentSlotModal('${cleanDate}','${key}')">
<b>${formatTime12(key)}</b>
<span>${ap ? escapeHtml(firstName(ap.patient.name)) + " - " + escapeHtml(ap.appointment.type || "") : "متاح"}</span>
</button>
`;
}).join("")}
</div>
</div>
`;
}

function fillAppointmentTime(dateISO,time){
setFieldValue("apptDate",normalizeAppointmentDate(dateISO));
setFieldValue("apptTime",normalizeAppointmentTime(time));
setFieldValue("apptTimeDisplay",formatTime12(time));
}

function openAppointmentSlotModal(dateISO,time){
let cleanDate = normalizeAppointmentDate(dateISO);
let cleanTime = normalizeAppointmentTime(time);
fillAppointmentTime(cleanDate, cleanTime);

let existing = getAppointmentsForDate(cleanDate).find(x => normalizeAppointmentTime(x.appointment.time) === cleanTime);
let patients = getPatients().map(p=>ensurePatientFileNo(p));
let currentFileNo = patient ? (patient.fileNo || "") : "";

let old = document.getElementById("appointmentSlotModal");
if(old) old.remove();

let modal = document.createElement("div");
modal.className = "modal appointment-slot-modal";
modal.id = "appointmentSlotModal";
modal.innerHTML = `
<div class="modalBox appointment-slot-box">
<h3>موعد ${cleanDate} - ${formatTime12(cleanTime)}</h3>
${existing ? `<div class="slot-existing">محجوز: <b>${escapeHtml(existing.patient.name || "")}</b> - ${escapeHtml(existing.appointment.type || "")}</div>` : ""}
<label>اختر المريض</label>
<select id="slotPatientFileNo">
<option value="">اختر مريض...</option>
${patients.map(p=>`<option value="${escapeHtml(p.fileNo || "")}" ${currentFileNo && currentFileNo === (p.fileNo || "") ? "selected" : ""}>${escapeHtml(p.name || "")} - ${escapeHtml(p.fileNo || "")}</option>`).join("")}
</select>
<input id="slotType" placeholder="نوع الموعد: مراجعة / قلع / لبية / صورة" value="${existing ? escapeHtml(existing.appointment.type || "") : ""}">
<textarea id="slotNote" placeholder="ملاحظات الموعد">${existing ? escapeHtml(existing.appointment.note || "") : ""}</textarea>
<div class="modal-actions">
<button onclick="saveAppointmentSlot('${cleanDate}','${cleanTime}')">حفظ الموعد</button>
<button onclick="closeAppointmentSlotModal()">إغلاق</button>
</div>
</div>
`;
document.body.appendChild(modal);
}

function closeAppointmentSlotModal(){
let modal = document.getElementById("appointmentSlotModal");
if(modal) modal.remove();
}

function saveAppointmentSlot(dateISO,time){
let fileNo = getFieldValue("slotPatientFileNo");
if(!fileNo){
alert("اختر المريض");
return;
}
let p = findPatientByFileNo(fileNo);
if(!p){
alert("لم يتم العثور على المريض");
return;
}

ensureAdvancedPatientData(p);
let cleanDate = normalizeAppointmentDate(dateISO);
let cleanTime = normalizeAppointmentTime(time);
let type = getFieldValue("slotType").trim();
let note = getFieldValue("slotNote").trim();

let conflict = getAppointmentsForDate(cleanDate).find(x => normalizeAppointmentTime(x.appointment.time) === cleanTime && (x.patient.fileNo || "") !== fileNo);
if(conflict){
alert("هذه الساعة محجوزة لمريض آخر");
return;
}

let existingIndex = (p.appointments || []).findIndex(a => normalizeAppointmentDate(a.date) === cleanDate && normalizeAppointmentTime(a.time) === cleanTime && a.status !== "done");
let item = {
date:cleanDate,
time:cleanTime,
type,
note,
status:"pending",
updatedAt:nowDateTime()
};
if(existingIndex >= 0){
p.appointments[existingIndex] = {...p.appointments[existingIndex], ...item};
}else{
item.createdAt = nowDateTime();
p.appointments.push(item);
}

let patients = getPatients().map(x => (x.fileNo || "") === (p.fileNo || "") ? p : x);
savePatients(patients);
patient = p;
closeAppointmentSlotModal();
openAppointmentsManager(cleanDate);
}

function printPatientReport(){
if(!patient){ alert("افتح ملف مريض أولاً"); return; }
let totals = getFinanceTotals(patient);
let alerts = getMedicalAlerts(patient);
let timelineItems = getPatientTimelineItems(patient).slice(0,8);
let teethRows = "";
if(patient.teeth && Object.keys(patient.teeth).length){
teethRows = Object.keys(patient.teeth).slice(0,8).map(num=>{
let t = patient.teeth[num];
return `<div class="compact-row"><b>سن ${escapeHtml(num)}</b><span>${escapeHtml([...(t.states || []), t.note || ""].filter(Boolean).join(" - "))}</span></div>`;
}).join("");
}else teethRows = `<p class="empty-report">لا توجد ملاحظات أسنان.</p>`;
let printArea = document.getElementById("printArea");
printArea.innerHTML = `
<div class="report-page a5-report">
<div class="report-header"><h1>تقرير مريض</h1><p>Dr. Taher Alaja Clinic</p></div>
<div class="report-grid compact-grid">
<div><b>الاسم:</b> ${escapeHtml(patient.name || "")}</div>
<div><b>رقم الملف:</b> ${escapeHtml(patient.fileNo || "")}</div>
<div><b>العمر:</b> ${escapeHtml(patient.age || "")}</div>
<div><b>الهاتف:</b> ${escapeHtml(patient.phone || "")}</div>
<div><b>التحسس:</b> ${escapeHtml(patient.allergy || "لا يوجد")}</div>
<div><b>الأمراض:</b> ${escapeHtml(patient.chronic || "لا يوجد")}</div>
</div>
${alerts.length ? `<h2>التنبيهات الطبية</h2>${alerts.slice(0,3).map(a=>`<div class="report-alert">${escapeHtml(a)}</div>`).join("")}` : ""}
<h2>الكشف المالي</h2>
<div class="report-money">
<div><small>الإجمالي سوري</small><b>${formatMoneyWithCurrency(totals.SYP.totalCharges,"SYP")}</b></div>
<div><small>الباقي سوري</small><b>${formatMoneyWithCurrency(totals.SYP.balance,"SYP")}</b></div>
<div><small>الإجمالي دولار</small><b>${formatMoneyWithCurrency(totals.USD.totalCharges,"USD")}</b></div>
<div><small>الباقي دولار</small><b>${formatMoneyWithCurrency(totals.USD.balance,"USD")}</b></div>
</div>
<h2>الخط الزمني</h2>
<div class="compact-timeline">
${timelineItems.length ? timelineItems.map(i=>`<div class="compact-row"><b>${i.icon} ${escapeHtml(i.title || "")}</b><span>${escapeHtml(i.date || "")} - ${escapeHtml(i.text || "")}</span></div>`).join("") : `<p class="empty-report">لا توجد أحداث.</p>`}
</div>
<h2>ملاحظات الأسنان</h2>
${teethRows}
</div>
`;
printArea.style.display = "block";
window.print();
}

/* =========================================================
   FINAL PATCH: COMPLETE MIXED DENTITION 52 TEETH + CLEAN MAP LABELS
   Overrides previous tooth chart functions safely.
========================================================= */

function getDentitionType(ageValue){
let age = parseInt(ageValue,10);
if(isNaN(age)) return "adult";
if(age <= 5) return "child";
if(age >= 6 && age <= 14) return "mixed";
return "adult";
}

function getTeethNumbers(){
let type = getDentitionType(patient && patient.age);

if(type === "child"){
return {
upper:["55","54","53","52","51","61","62","63","64","65"],
lower:["85","84","83","82","81","71","72","73","74","75"]
};
}

if(type === "mixed"){
return {
upperPermanent:["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"],
upperPrimary:["55","54","53","52","51","61","62","63","64","65"],
lowerPrimary:["85","84","83","82","81","71","72","73","74","75"],
lowerPermanent:["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"]
};
}

return {
upper:["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"],
lower:["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"]
};
}

function renderToothChart(){
if(!patient) return;
let container = document.getElementById("toothChart");
if(!container) return;

patient.teeth = patient.teeth || {};

let groups = getTeethNumbers();
let chartType = getDentitionType(patient.age);
let chartName = chartType === "adult" ? "Adult" : (chartType === "mixed" ? "Mixed 6-14" : "Child");
let jawsHtml = "";

if(chartType === "mixed"){
jawsHtml = `
<div class="panorama-jaw panorama-upper mixed-permanent-row mixed-row-1">
${groups.upperPermanent.map((n,i)=>renderPanoramaTooth(n,i,groups.upperPermanent.length,"upper")).join("")}
</div>

<div class="panorama-jaw panorama-upper mixed-primary-row mixed-row-2">
${groups.upperPrimary.map((n,i)=>renderPanoramaTooth(n,i,groups.upperPrimary.length,"upper")).join("")}
</div>

<div class="panorama-jaw panorama-lower mixed-primary-row mixed-row-3">
${groups.lowerPrimary.map((n,i)=>renderPanoramaTooth(n,i,groups.lowerPrimary.length,"lower")).join("")}
</div>

<div class="panorama-jaw panorama-lower mixed-permanent-row mixed-row-4">
${groups.lowerPermanent.map((n,i)=>renderPanoramaTooth(n,i,groups.lowerPermanent.length,"lower")).join("")}
</div>
`;
}else{
jawsHtml = `
<div class="panorama-jaw panorama-upper">
${groups.upper.map((n,i)=>renderPanoramaTooth(n,i,groups.upper.length,"upper")).join("")}
</div>

<div class="panorama-jaw panorama-lower">
${groups.lower.map((n,i)=>renderPanoramaTooth(n,i,groups.lower.length,"lower")).join("")}
</div>
`;
}

container.innerHTML = `
<div class="panorama-dental-map panorama-wide-map ${chartType === "mixed" ? "mixed-panorama-map complete-mixed-map" : ""}">
<div class="panorama-map-head">
<div>
<h3>Panorama Dental Map</h3>
<p>${chartName}</p>
</div>
<div class="panorama-view-pill">🦷 Panorama</div>
</div>

<div class="panorama-stage">
<div class="panorama-bg-glow"></div>
<div class="panorama-soft-xray upper-xray"></div>
<div class="panorama-soft-xray lower-xray"></div>
<div class="panorama-arch-guide upper-guide"></div>
<div class="panorama-arch-guide lower-guide"></div>
${jawsHtml}
</div>

<div class="panorama-legend">
<span><i class="legend-healthy"></i> سليم</span>
<span><i class="legend-filling"></i> حشو</span>
<span><i class="legend-root"></i> لبية</span>
<span><i class="legend-crown"></i> تاج</span>
<span><i class="legend-implant"></i> زرعة</span>
<span><i class="legend-missing"></i> مفقود</span>
</div>

<div class="panorama-hint">اضغط على أي سن لفتح الملاحظات والحالات وخطة العلاج المرتبطة به.</div>
</div>
`;
}


/* =========================================================
   FINAL OVERRIDE: DOCTORS + PREGNANCY + PALMER + CLEAN MODAL
   + TREATMENT PLAN SYNC + BRIDGE GROUPS
   Safe appended overrides: does not remove old features.
========================================================= */

const TOOTH_STATE_OPTIONS = [
{value:"extraction", label:"قلع / فراغ"},
{value:"rootCanal", label:"علاج عصب"},
{value:"filling", label:"حشو"},
{value:"crown", label:"تتويج"},
{value:"implant", label:"زرعة"},
{value:"bridge", label:"جسر"},
{value:"watch", label:"مراقبة / ملاحظة"},
{value:"fiberPost", label:"وتد فايبر"}
];

const CROWN_TYPE_OPTIONS = ["خزف", "خزف معدن", "زركون", "فينير"];

function getActiveDoctor(){
let el = document.getElementById("activeDoctor");
return el ? (el.value || "") : "";
}

function isPatientPregnant(){
return Boolean(rxPregnantMode);
}

function setPatientPregnancy(value){
rxPregnantMode = Boolean(value);
}

/* override existing fillPatientFields to include pregnancy */
function fillPatientFields(p){
setFieldValue("fileNo", p.fileNo || "");
setFieldValue("name", p.name || "");
setFieldValue("age", p.age || "");
setFieldValue("phone", p.phone || "");
setFieldValue("allergy", p.allergy || "");
setFieldValue("chronic", p.chronic || "");
setFieldValue("notes", p.notes || "");
setSelectedPatientGender(p.gender || "");
}

/* override registerPatient to save pregnancy and gender */
function registerPatient(){
const name = getFieldValue("name").trim();
const age = getFieldValue("age");
const phone = getFieldValue("phone").trim();
const allergy = getFieldValue("allergy");
const chronic = getFieldValue("chronic");
const notes = getFieldValue("notes");
const gender = getSelectedPatientGender();
if(!name){
alert("أدخل اسم المريض");
return;
}

let patients = getPatients();
let duplicate = patients.find(p =>
((p.name || "").trim().toLowerCase() === name.toLowerCase()) ||
(phone && (p.phone || "").trim() === phone)
);

if(duplicate){
duplicate = ensurePatientFileNo(duplicate);
alert("انتبه لوجود ملف سابق للمريض");
openPatient(duplicate);
savePatients(patients);
return;
}

patient = {
fileNo:getNextPatientNumber(),
name,
age,
phone,
allergy,
chronic,
notes,
gender,
visits:[],
prescriptions:[],
teeth:{},
media:{xrays:[],photos:[]}
};

patients.push(patient);
savePatients(patients);
alert("تم تسجيل المريض بنجاح");
openPatient(patient);
}

/* override editPatient to save pregnancy */
function editPatient(){
if(!patient) return;
let oldFileNo = patient.fileNo;
let oldName = patient.name;
patient.fileNo = oldFileNo || getNextPatientNumber();
patient.name=getFieldValue("name").trim();
patient.age=getFieldValue("age");
patient.phone=getFieldValue("phone").trim();
patient.allergy=getFieldValue("allergy");
patient.chronic=getFieldValue("chronic");
patient.notes=getFieldValue("notes");
patient.gender=getSelectedPatientGender();
if(!patient.name){
alert("اسم المريض مطلوب");
return;
}

let patients=getPatients();
let duplicate = patients.find(p =>
p !== patient &&
((p.fileNo && p.fileNo !== oldFileNo && p.fileNo === patient.fileNo) ||
((p.name || "").trim().toLowerCase() === patient.name.toLowerCase() && p.name !== oldName) ||
(patient.phone && (p.phone || "").trim() === patient.phone && p.fileNo !== oldFileNo))
);

if(duplicate){
alert("انتبه لوجود ملف سابق للمريض");
openPatient(duplicate);
return;
}

patients = patients.map(p=>{
if((oldFileNo && p.fileNo === oldFileNo) || p.name === oldName) return patient;
return p;
});

savePatients(patients);
openPatient(patient);
}

function getPregnancyRisk(m){
if(!isPatientPregnant()) return "";
let txt = ((m.name||"") + " " + (m.dose||"") + " " + (m.note||"")).toLowerCase();
let risks = [
{keys:["ibuprofen","surgam","nsaid","ديكلوفيناك","diclofenac","ketoprofen"], msg:"غير مفضل للحامل خصوصاً بالثلث الأخير"},
{keys:["metronidazole"], msg:"يحتاج تقدير الطبيب للحامل وخاصة بالثلث الأول"},
{keys:["tetracycline","doxycycline","دوكس","تترا"], msg:"ممنوع للحامل"},
{keys:["ciprofloxacin","ofloxacin","levofloxacin"], msg:"غير مناسب للحامل عادة"}
];
for(let r of risks){
if(r.keys.some(k=>txt.includes(k))) return r.msg;
}
return "";
}

function hasPregnancyConflict(meds){
return isPatientPregnant() && (meds || []).some(m => getPregnancyRisk(m));
}

function pregnancyConflictText(meds){
let list = (meds || []).map(m=>({name:m.name || "", risk:getPregnancyRisk(m)})).filter(x=>x.risk);
if(!list.length) return "";
return list.map(x=>`• ${x.name}: ${x.risk}`).join("\n");
}

/* override medical alerts */
function getMedicalAlerts(p){
let alerts = [];
let allergy = (p.allergy || "").trim();
let chronic = (p.chronic || "").trim();
let age = parseInt(p.age,10);
if(allergy) alerts.push("⚠ تحسس دوائي: " + allergy);
if(chronic) alerts.push("🩺 أمراض مزمنة: " + chronic);
if(!isNaN(age) && age <= 7) alerts.push("🧒 مريض طفل: انتبه للجرعات المناسبة للعمر والوزن");
if(!isNaN(age) && age >= 60) alerts.push("👴 مريض كبير بالعمر: راجع القصة المرضية والأدوية العامة");
let c = chronic.toLowerCase();
if(c.includes("سكري") || c.includes("diabetes")) alerts.push("⚠ مريض سكري: انتبه للإنتان والشفاء بعد الجراحة");
if(c.includes("ضغط") || c.includes("hypertension")) alerts.push("⚠ مريض ضغط: تأكد من السيطرة الدوائية قبل العمل");
return alerts;
}

/* override ready rx apply to show pregnancy warning */
function applyReadyRx(index){
let ready = (getReadyRxData()[rxType] || [])[index];
if(!ready) return;

if(hasAllergyConflict(ready.meds)){
if(!confirm("⚠ انتبه: يوجد تحسس دوائي مسجل وقد تتعارض هذه الوصفة. هل تريد المتابعة؟")) return;
}
if(hasPregnancyConflict(ready.meds)){
alert("⚠ خطأ/تحذير للحمل:\n" + pregnancyConflictText(ready.meds));
if(!confirm("هل تريد المتابعة رغم تحذير الحمل؟")) return;
}

let rx={
date:nowDateTime(),
type:rxType,
title:ready.title,
meds:[...ready.meds],
instructions:[...(ready.instructions || [])],
doctor:getActiveDoctor(),
pregnant:rxPregnantMode
};
patient.prescriptions.push(rx);
saveAll();
rxPreview=rx;
renderGeneratedRx(rx);
previewPrescription();
}

/* override med rendering to show pregnancy errors */
function renderMeds(){
selectedMeds=[];
document.getElementById("output").innerHTML=`
<div class="card">
<h3>${currentProtocolName}</h3>
${isPatientPregnant() ? `<div class="pregnancy-prescription-alert">🤰 مريضة حامل: الأدوية غير المناسبة ستظهر بتحذير أحمر.</div>` : ""}
<div class="cards-grid" id="medList"></div>
<br>
<button onclick="generateRx()">🧾 إنشاء الوصفة</button>
<button onclick="goBack()">⬅ رجوع</button>
</div>
`;
let c=document.getElementById("medList");
currentProtocolList.forEach(m=>{
let pregnancyRisk = getPregnancyRisk(m);
let d=document.createElement("div");
d.className="med-card" + (pregnancyRisk ? " pregnancy-risk-card" : "");
d.innerHTML=`
${m.warning ? `<div class="med-warning">${m.warning}</div>` : ""}
${pregnancyRisk ? `<div class="pregnancy-risk">⚠ ${pregnancyRisk}</div>` : ""}
<h4>${m.name || ""}</h4>
<p><b>${m.dose || ""}</b></p>
<p>${m.note || ""}</p>
`;
d.onclick=()=>{
if(selectedMeds.includes(m)){
selectedMeds=selectedMeds.filter(x=>x!==m);
d.classList.remove("selected-med");
}else{
selectedMeds.push(m);
d.classList.add("selected-med");
}
};
c.appendChild(d);
});
}

/* override generate rx to include pregnancy warning and doctor */
function generateRx(){
if(selectedMeds.length===0){
alert("اختر دواء واحد على الأقل");
return;
}
if(hasAllergyConflict(selectedMeds)){
if(!confirm("⚠ انتبه: يوجد تحسس دوائي مسجل وقد تتعارض بعض الأدوية المختارة. هل تريد المتابعة؟")) return;
}
if(hasPregnancyConflict(selectedMeds)){
alert("⚠ خطأ/تحذير للحمل:\n" + pregnancyConflictText(selectedMeds));
if(!confirm("هل تريد المتابعة رغم تحذير الحمل؟")) return;
}
let rx={
date:nowDateTime(),
type:rxType,
title:currentProtocolName || "وصفة مخصصة",
meds:[...selectedMeds],
instructions:[],
doctor:getActiveDoctor(),
pregnant:rxPregnantMode
};
patient.prescriptions.push(rx);
saveAll();
rxPreview=rx;
renderGeneratedRx(rx);
previewPrescription();
}

function getPalmerLabel(num){
let s = String(num || "");
if(s.length < 2) return s;
let q = s[0];
let n = s[1];
let isPrimary = ["5","6","7","8"].includes(q);
let primaryLetters = {"1":"A","2":"B","3":"C","4":"D","5":"E"};
let label = isPrimary ? (primaryLetters[n] || n) : n;
let mark = {"1":"┘","2":"└","3":"┌","4":"┐","5":"┘","6":"└","7":"┌","8":"┐"}[q] || "";
return mark + label;
}

/* override panorama tooth label to Palmer, but keeps storage by original FDI number */
function renderPanoramaTooth(num,index,total,arch){
let t = (patient.teeth && patient.teeth[num]) || {states:[], note:""};
let states = t.states || [];
let missing = states.includes("extraction");
let implant = states.includes("implant");
let kind = getToothNaturalType(num);
let cls = "svg-tooth-btn pano-svg-tooth natural-tooth tooth-" + kind + " " + toothStateClasses(states);
if(t.bridgeGroup) cls += " bridge-group-linked";
let label = missing ? "فراغ" : getPalmerLabel(num);
let middle = (total - 1) / 2;
let d = index - middle;
let abs = Math.abs(d);
let max = Math.max(middle,1);
let spread = total <= 10 ? 8.6 : 5.55;
let left = 50 + (d * spread);
let normalized = abs / max;
let curve = Math.pow(normalized, 1.75);
let top = arch === "upper" ? (18 + curve * 118) : (142 - curve * 118);
let rotate = d * (arch === "upper" ? 5.2 : -5.2);
let scale = 1 - Math.min(normalized * 0.11, 0.11);
let svg = implant ? renderImplantSvg() : renderNaturalToothSvg(kind);
return `
<button
class="${cls}"
style="left:${left}%; top:${top}px; transform:translateX(-50%) rotate(${rotate}deg) scale(${scale});"
onclick="openToothModal('${num}')"
title="${getPalmerLabel(num)} - FDI ${num}">
${svg}
<small>${label}</small>
</button>
`;
}

function stateLabel(v){
let found = TOOTH_STATE_OPTIONS.find(x=>x.value===v);
return found ? found.label : v;
}

function renderDoctorLine(obj){
return obj && obj.doctor ? `<small class="doctor-tag">بواسطة: ${escapeHtml(obj.doctor)}</small>` : "";
}

/* cleaner tooth modal with crown subtypes + bridge group + doctor */
function openToothModal(num){
if(!patient) return;
patient.teeth = patient.teeth || {};
let t = patient.teeth[num] || {states:[], note:""};
let states = t.states || [];
let modal = document.createElement("div");
modal.className = "modal tooth-modal tooth-modal-clean";
modal.id = "toothModal";
modal.innerHTML = `
<div class="modalBox tooth-modal-box tooth-editor-box">
<div class="tooth-editor-header">
<div>
<h3>السن ${getPalmerLabel(num)}</h3>
<p>FDI ${num}</p>
</div>
<span>${getActiveDoctor() || "الطبيب غير محدد"}</span>
</div>

<div class="tooth-state-grid">
${TOOTH_STATE_OPTIONS.map(o=>`
<label class="tooth-state-pill ${states.includes(o.value) ? "active" : ""}">
<input type="checkbox" value="${o.value}" ${states.includes(o.value) ? "checked" : ""}>
<span>${o.label}</span>
</label>
`).join("")}
</div>

<div class="crown-options-box">
<label>نوع التتويج</label>
<select id="crownType">
<option value="">بدون تحديد</option>
${CROWN_TYPE_OPTIONS.map(x=>`<option value="${x}" ${t.crownType===x ? "selected" : ""}>${x}</option>`).join("")}
</select>
</div>

<div class="bridge-options-box">
<label>جسر على الأسنان</label>
<input id="bridgeGroup" placeholder="مثال: 24,25,26" value="${escapeHtml(t.bridgeGroup || "")}">
<p>اكتب أرقام الأسنان المرتبطة بالجسر مفصولة بفواصل. سيتم تلوينها كجسر مشترك.</p>
</div>

<textarea id="toothNote" placeholder="ملاحظة العلاج أو الإجراء">${escapeHtml(t.note || "")}</textarea>
${renderDoctorLine(t)}

<div class="modal-actions tooth-editor-actions">
<button onclick="saveToothState('${num}')">حفظ</button>
<button onclick="openTreatmentPlanManager('${num}')">🦷 خطة علاج لهذا السن</button>
<button onclick="clearToothState('${num}')">تفريغ السن</button>
<button onclick="closeToothModal()">إغلاق</button>
</div>
</div>
`;
document.body.appendChild(modal);
modal.querySelectorAll(".tooth-state-pill input").forEach(input=>{
input.addEventListener("change",()=>{
input.closest(".tooth-state-pill").classList.toggle("active", input.checked);
});
});
}

function saveToothState(num){
let modal = document.getElementById("toothModal");
if(!modal || !patient) return;
let states = Array.from(modal.querySelectorAll(".tooth-state-grid input[type='checkbox']:checked")).map(x=>x.value);
let note = document.getElementById("toothNote").value;
let crownType = getFieldValue("crownType");
let bridgeGroup = getFieldValue("bridgeGroup").trim();
patient.teeth = patient.teeth || {};
patient.teeth[num] = {
states,
note,
crownType,
bridgeGroup,
doctor:getActiveDoctor(),
updatedAt:nowDateTime()
};
/* apply bridge state to grouped teeth */
if(bridgeGroup){
bridgeGroup.split(/[،,\s]+/).map(x=>x.trim()).filter(Boolean).forEach(tn=>{
patient.teeth[tn] = patient.teeth[tn] || {states:[], note:""};
if(!patient.teeth[tn].states.includes("bridge")) patient.teeth[tn].states.push("bridge");
patient.teeth[tn].bridgeGroup = bridgeGroup;
patient.teeth[tn].updatedAt = nowDateTime();
});
}
saveAll();
closeToothModal();
renderToothChart();
}

/* visits tagged with doctor */
function saveVisit(){
if(!patient){ alert("لا يوجد مريض محدد"); return; }
let text = getFieldValue("visitText").trim();
if(!text){ alert("اكتب ملاحظات الزيارة"); return; }
patient.visits.push({date:nowDateTime(), text, doctor:getActiveDoctor()});
setFieldValue("visitText", "");
saveAll();
closeVisit();
openPatient(patient);
}

/* render timeline with doctor names */
function getPatientTimelineItems(p){
let items = [];
try{ ensureAdvancedPatientData(p); }catch(e){}
(p.appointments || []).forEach(a=> items.push({date:a.date || "", icon:"📅", title:"موعد", text:`${a.time || ""} ${a.type || ""} ${a.status === "done" ? " - تم" : ""}`, doctor:a.doctor||""}));
(p.treatmentPlans || []).forEach(plan=>{
let steps = safeArray(plan.steps);
let done = steps.filter(s=>s.done).length;
items.push({date:plan.updatedAt || plan.createdAt || "", icon:"🦷", title:"خطة علاج " + (plan.tooth || ""), text:`${plan.title || ""} - ${done}/${steps.length} خطوات`, doctor:plan.doctor||""});
});
(p.visits || []).forEach(v=> items.push({date:v.date || "", icon:"📝", title:"زيارة", text:v.text || "", doctor:v.doctor||""}));
(p.prescriptions || []).forEach(rx=> items.push({date:rx.date || "", icon:"🧾", title:rx.title || rx.type || "وصفة", text:(rx.meds || []).map(m=>m.name).join("، "), doctor:rx.doctor||""}));
if(p.teeth){
Object.keys(p.teeth).forEach(num=>{
let t = p.teeth[num];
if(t && ((t.states || []).length || t.note)){
let extra = t.crownType ? " - " + t.crownType : "";
items.push({date:t.updatedAt || "", icon:"🦷", title:"السن " + getPalmerLabel(num), text:[...(t.states || []).map(stateLabel), t.note || ""].filter(Boolean).join(" - ") + extra, doctor:t.doctor||""});
}
});
}
let media = p.media || {xrays:[], photos:[]};
(media.xrays || []).forEach(m=>items.push({date:m.uploadedAt || "", icon:"📷", title:"أشعة", text:m.name || ""}));
(media.photos || []).forEach(m=>items.push({date:m.uploadedAt || "", icon:"🖼", title:"صورة فوتوغرافية", text:m.name || ""}));
return items.reverse();
}

function renderPatientTimeline(p){
let items = getPatientTimelineItems(p);
if(items.length === 0) return "<p>لا توجد أحداث بعد.</p>";
return `
<div class="timeline">
${items.map(item=>`
<div class="timeline-item">
<div class="timeline-icon">${item.icon}</div>
<div class="timeline-content">
<b>${escapeHtml(item.title || "")}</b>
<small>${escapeHtml(item.date || "")}${item.doctor ? " · " + escapeHtml(item.doctor) : ""}</small>
<p>${escapeHtml(item.text || "")}</p>
</div>
</div>
`).join("")}
</div>
`;
}

function treatmentTitlesForPatient(){
let base = TOOTH_STATE_OPTIONS.map(x=>x.label).filter(x=>!["مراقبة / ملاحظة"].includes(x));
return [...new Set([...base, "وتد فايبر", "تحضير تاج", "تجربة تاج", "إلصاق تاج", "معالجة لثوية", "تبييض", "استشارة"] )];
}

function renderToothOptions(selected=""){
let groups = getTeethNumbers();
let nums = [];
Object.keys(groups).forEach(k=> nums = nums.concat(groups[k]));
nums = [...new Set(nums)];
return `<option value="">عام</option>` + nums.map(n=>`<option value="${n}" ${String(selected)===String(n)?"selected":""}>${getPalmerLabel(n)} - FDI ${n}</option>`).join("");
}

/* treatment plan synced with tooth map options */
function openTreatmentPlanManager(toothNumber=""){
if(!patient){ alert("افتح ملف مريض أولاً"); return; }
ensureAdvancedPatientData(patient);
document.getElementById("output").innerHTML = `
<div class="card treatment-manager">
<h2>🦷 خطة العلاج - ${escapeHtml(patient.name || "")}</h2>
<div class="treatment-form">
<label>السن</label>
<select id="planTooth">${renderToothOptions(toothNumber)}</select>
<label>عنوان الخطة</label>
<select id="planTitle">
${treatmentTitlesForPatient().map(x=>`<option value="${x}">${x}</option>`).join("")}
</select>
<textarea id="planSteps" placeholder="اكتب كل خطوة بسطر مستقل&#10;مثال: فتح حجرة&#10;تحضير قنوات&#10;حشو قنوات"></textarea>
<div class="plan-cost-line">
<input id="planCost" type="number" placeholder="التكلفة المتوقعة">
<select id="planCurrency">
<option value="SYP">ل.س</option>
<option value="USD">$</option>
</select>
</div>
<textarea id="planNote" placeholder="ملاحظات الخطة"></textarea>
<button onclick="addTreatmentPlan()">➕ إضافة الخطة</button>
</div>
<h3>الخطط الحالية</h3>
${renderTreatmentPlanSummary(patient)}
<br>
<button onclick="openPatient(patient)">رجوع لملف المريض</button>
</div>
`;
document.getElementById("backBtn").style.display="block";
}


function getTreatmentPlanCurrency(plan){
return normalizeCurrency(plan && plan.currency ? plan.currency : "SYP");
}

function getTreatmentPlanChargeId(plan){
if(!plan) return "";
if(plan.financeChargeId) return plan.financeChargeId;
if(plan.id) return "plan-" + plan.id;
return "";
}

function removeTreatmentPlanFinanceCharge(plan){
if(!patient || !plan) return;
let finance = getPatientFinance(patient);
let chargeId = getTreatmentPlanChargeId(plan);
let label = "خطة علاج: " + (plan.title || "") + (plan.tooth ? " - سن " + (typeof getPalmerLabel === "function" ? getPalmerLabel(plan.tooth) : plan.tooth) : "");
finance.charges = (finance.charges || []).filter(c => {
if(chargeId && (c.planId === plan.id || c.financeChargeId === chargeId || c.id === chargeId)) return false;
if(!c.planId && !c.financeChargeId && (c.label || "") === label && Number(c.amount || 0) === Number(plan.cost || 0)) return false;
return true;
});
}

function upsertTreatmentPlanFinanceCharge(plan){
if(!patient || !plan) return;
let finance = getPatientFinance(patient);
removeTreatmentPlanFinanceCharge(plan);
let cost = Number(plan.cost || 0);
if(cost > 0){
let chargeId = getTreatmentPlanChargeId(plan);
plan.financeChargeId = chargeId;
finance.charges.push({
id:chargeId,
financeChargeId:chargeId,
planId:plan.id,
date:nowDateTime(),
label:"خطة علاج: " + (plan.title || "") + (plan.tooth ? " - سن " + getPalmerLabel(plan.tooth) : ""),
amount:cost,
currency:getTreatmentPlanCurrency(plan),
doctor:getActiveDoctor()
});
}
}

function addTreatmentPlan(){
if(!patient) return;
let tooth = getFieldValue("planTooth").trim();
let title = getFieldValue("planTitle").trim();
let rawSteps = getFieldValue("planSteps");
let cost = Number(getFieldValue("planCost") || 0);
let currency = normalizeCurrency(getFieldValue("planCurrency") || "SYP");
let note = getFieldValue("planNote").trim();

if(!title){
alert("اكتب عنوان الخطة");
return;
}
if(cost < 0){
alert("التكلفة لا يمكن أن تكون سالبة");
return;
}

let steps = rawSteps.split("\n").map(x=>x.trim()).filter(Boolean).map(text=>({text, done:false}));
if(steps.length === 0) steps = [{text:"بدء العلاج", done:false}];

let plan = {
id:Date.now(),
tooth,
title,
steps,
cost,
currency,
note,
status:"active",
doctor:getActiveDoctor(),
createdAt:nowDateTime()
};

getTreatmentPlans(patient).push(plan);

/* مهم: لا يتم تعديل الخريطة السنية هنا.
   تعديل السن يتم فقط عند الضغط على زر تم وبعد وصول الخطة إلى 100%. */

upsertTreatmentPlanFinanceCharge(plan);

saveAll();
openTreatmentPlanManager();
}

function renderTreatmentPlanSummary(p){
let plans = getTreatmentPlans(p);
if(plans.length === 0) return "<p>لا توجد خطة علاج بعد.</p>";
return `
<div class="treatment-plan-list">
${plans.map((plan,i)=>{
let steps = safeArray(plan.steps);
let done = steps.filter(s=>s.done).length;
let percent = steps.length ? Math.round(done * 100 / steps.length) : 0;
let isDone = plan.status === "done";
let displayPercent = isDone ? 100 : percent;
return `
<div class="treatment-plan-card ${isDone ? "completed-plan" : ""}">
<div class="plan-top">
<b>🦷 ${escapeHtml(plan.tooth ? getPalmerLabel(plan.tooth) : "عام")} - ${escapeHtml(plan.title || "")}</b>
<span>${displayPercent}%</span>
</div>
<div class="plan-progress"><i style="width:${displayPercent}%"></i></div>
<p>${escapeHtml(plan.note || "")}</p>
${plan.doctor ? `<small class="doctor-tag">بواسطة: ${escapeHtml(plan.doctor)}</small>` : ""}
<small>التكلفة: ${formatMoneyWithCurrency(Number(plan.cost || 0), getTreatmentPlanCurrency(plan))}</small>
<div class="plan-steps">
${steps.map((s,si)=>`
<label class="${s.done ? "done-step" : ""}">
<input type="checkbox" ${s.done ? "checked" : ""} onchange="toggleTreatmentStep(${i},${si})" ${isDone ? "disabled" : ""}>
${escapeHtml(s.text || "")}
</label>
`).join("")}
</div>
<button onclick="markTreatmentPlanDone(${i})" ${percent===100 && !isDone ? "" : "disabled"} class="done-plan-btn">${isDone ? "تم تطبيقها" : "تم"}</button>
<button onclick="editTreatmentPlan(${i})" ${isDone ? "disabled" : ""}>✏️ تعديل</button>
<button onclick="deleteTreatmentPlan(${i})">🗑 حذف</button>
</div>
`;
}).join("")}
</div>
`;
}

function applyTreatmentPlanToTooth(plan){
if(!patient || !plan || !plan.tooth) return;
if(plan.status !== "done") return;

patient.teeth = patient.teeth || {};
let tooth = String(plan.tooth);
let t = patient.teeth[tooth] || {states:[], note:""};
t.states = Array.isArray(t.states) ? t.states : [];

let title = (plan.title || "").trim();
let statesToAdd = [];

let direct = TOOTH_STATE_OPTIONS.find(x => x.label === title);
if(direct) statesToAdd.push(direct.value);

if(title.includes("حشو")) statesToAdd.push("filling");
if(title.includes("عصب") || title.includes("لبية")) statesToAdd.push("rootCanal");
if(title.includes("تاج") || title.includes("تتويج") || title.includes("زركون") || title.includes("فينير") || title.includes("خزف")) statesToAdd.push("crown");
if(title.includes("زرعة")) statesToAdd.push("implant");
if(title.includes("قلع") || title.includes("فراغ")) statesToAdd.push("extraction");
if(title.includes("جسر")) statesToAdd.push("bridge");
if(title.includes("وتد")) statesToAdd.push("fiberPost");
if(title.includes("لثوية") || title.includes("استشارة") || title.includes("تبييض")) statesToAdd.push("watch");

statesToAdd = [...new Set(statesToAdd.filter(Boolean))];
statesToAdd.forEach(state=>{
if(!t.states.includes(state)) t.states.push(state);
});

let doneLine = `خطة مكتملة: ${title}`;
let details = safeArray(plan.steps).map(s=>s.text || "").filter(Boolean).join(" / ");
let doctor = getActiveDoctor() || plan.doctorDone || plan.doctor || "";
let noteParts = [doneLine];
if(details) noteParts.push(details);
if(doctor) noteParts.push("بواسطة: " + doctor);

let existingNote = (t.note || "").trim();
let newNote = noteParts.join(" - ");
t.note = existingNote ? existingNote + "\n" + newNote : newNote;
t.updatedAt = nowDateTime();
t.doctor = doctor;

patient.teeth[tooth] = t;
}

function markTreatmentPlanDone(index){
let plans = getTreatmentPlans(patient);
let plan = plans[index];
if(!plan) return;
let steps = safeArray(plan.steps);
let done = steps.filter(s=>s.done).length;
let percent = steps.length ? Math.round(done * 100 / steps.length) : 0;
if(percent < 100){ alert("لا يمكن إنهاء الخطة قبل وصولها إلى 100%"); return; }

plan.status = "done";
plan.doneAt = nowDateTime();
plan.doctorDone = getActiveDoctor();

applyTreatmentPlanToTooth(plan);

saveAll();
openPatient(patient);
}

/* add pregnancy into clear */
function clearPatientFields(){
setFieldValue("fileNo", "");
setFieldValue("name", "");
setFieldValue("age", "");
setFieldValue("phone", "");
setFieldValue("allergy", "");
setFieldValue("chronic", "");
setFieldValue("notes", "");
setSelectedPatientGender("");
setPatientPregnancy(false);
patient = null;
document.getElementById("output").innerHTML = "";
let printArea = document.getElementById("printArea");
if(printArea) printArea.style.display="none";
}

function toggleDataMenu(event){
if(event) event.stopPropagation();
let menu=document.getElementById("dataMenu");
if(menu) menu.classList.toggle("hidden");
}
function closeDataMenu(){
let menu=document.getElementById("dataMenu");
if(menu) menu.classList.add("hidden");
}
document.addEventListener("click",function(e){
let wrap=document.querySelector(".data-menu-wrap");
if(wrap && !wrap.contains(e.target)) closeDataMenu();
});


/* =========================================================
   CLINIC OPERATIONS FINANCE - SIDE PANEL
   مصاريف تشغيل العيادة + عداد المدخول
========================================================= */
const CLINIC_OPERATIONS_KEY = "clinicOperationsFinance";

function getClinicOperations(){
try{
let data = JSON.parse(localStorage.getItem(CLINIC_OPERATIONS_KEY));
if(!data || typeof data !== "object") data = {};
data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
return data;
}catch(e){
return {expenses:[]};
}
}

function saveClinicOperations(data){
data = data || {expenses:[]};
data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
localStorage.setItem(CLINIC_OPERATIONS_KEY, JSON.stringify(data));
}

function getCurrencyBucket(){
return {
SYP:{income:0, expenses:0, net:0},
USD:{income:0, expenses:0, net:0}
};
}

function getClinicIncomeTotals(){
  let totals=getCurrencyBucket();
  totals.SYP.credit=0;
  totals.USD.credit=0;

  getPatients().forEach(p=>{
    const finance=p.finance||{};
    const charges=Array.isArray(finance.charges)?finance.charges:[];
    const payments=Array.isArray(finance.payments)?finance.payments:[];

    const chargeTotals={SYP:0,USD:0};
    const paymentTotals={SYP:0,USD:0};

    charges.forEach(ch=>{
      const c=typeof normalizeCurrency==='function'
        ?normalizeCurrency(ch.currency)
        :(ch.currency==='USD'?'USD':'SYP');

      const source=String(ch.source||ch.type||ch.kind||'').toLowerCase();

      const chartOnly=(source.includes('chart')||source.includes('dental')) &&
        !(ch.financialConfirmed===true||
          ch.billable===true||
          ch.completed===true||
          ch.status==='completed');

      if(!chartOnly){
        chargeTotals[c]+=Math.abs(Number((ch.amount??ch.cost??ch.price)||0));
      }
    });

    payments.forEach(pay=>{
      const c=typeof normalizeCurrency==='function'
        ?normalizeCurrency(pay.currency)
        :(pay.currency==='USD'?'USD':'SYP');

      paymentTotals[c]+=Math.abs(Number(pay.amount||0));
    });

    ['SYP','USD'].forEach(c=>{
      const recognized=Math.min(paymentTotals[c],chargeTotals[c]);

      totals[c].income+=recognized;
      totals[c].credit+=Math.max(paymentTotals[c]-recognized,0);
    });
  });

  return totals;
}

function getClinicOperationsTotals(){
let totals = getClinicIncomeTotals();
let ops = getClinicOperations();
(ops.expenses || []).forEach(exp=>{
let c = typeof normalizeCurrency === "function" ? normalizeCurrency(exp.currency) : ((exp.currency === "USD") ? "USD" : "SYP");
totals[c].expenses += Number(exp.amount || 0);
});
Object.keys(totals).forEach(c=>{
totals[c].net = totals[c].income - totals[c].expenses;
});
return totals;
}

function clinicExpenseCategoryLabel(cat){
if(cat === "materials") return "شراء مواد";
if(cat === "salaries") return "رواتب";
return "مدفوعات أخرى";
}

function renderClinicFinanceSidePanel(){
let box = document.getElementById("clinicFinanceSidebar");
if(!box) return;

let ops = getClinicOperations();
let totals = getClinicOperationsTotals();
let collapsed = box.classList.contains("collapsed");

box.className = "clinic-finance-sidebar" + (collapsed ? " collapsed" : "");
box.innerHTML = `
<button class="clinic-finance-tab" onclick="toggleClinicFinanceSidebar()">
💰
<span>مالية العيادة</span>
</button>

<div class="clinic-finance-panel">
<div class="clinic-finance-head">
<div>
<h3>مالية العيادة</h3>
<small>تشغيل العيادة والمدخول</small>
</div>
<button onclick="toggleClinicFinanceSidebar()">×</button>
</div>

<div class="clinic-income-counter">
<div>
<small>مدخول العيادة المعترف به</small>
<b>${formatMoneyWithCurrencySafe(totals.SYP.income,"SYP")}</b>
<b>${formatMoneyWithCurrencySafe(totals.USD.income,"USD")}</b>
</div>
<div>
<small>سلف المرضى — ليست دخلًا</small>
<b>${formatMoneyWithCurrencySafe(totals.SYP.credit||0,"SYP")}</b>
<b>${formatMoneyWithCurrencySafe(totals.USD.credit||0,"USD")}</b>
</div>
</div>

<div class="clinic-finance-grid">
<div class="clinic-mini-stat">
<small>مصاريف تشغيل</small>
<b>${formatMoneyWithCurrencySafe(totals.SYP.expenses,"SYP")}</b>
<b>${formatMoneyWithCurrencySafe(totals.USD.expenses,"USD")}</b>
</div>
<div class="clinic-mini-stat ${totals.SYP.net < 0 || totals.USD.net < 0 ? "loss" : "profit"}">
<small>الصافي</small>
<b>${formatMoneyWithCurrencySafe(totals.SYP.net,"SYP")}</b>
<b>${formatMoneyWithCurrencySafe(totals.USD.net,"USD")}</b>
</div>
</div>

<div class="clinic-expense-form">
<h4>إضافة مصروف</h4>
<select id="clinicExpenseCategory">
<option value="materials">قيمة شراء المواد</option>
<option value="salaries">قيمة الرواتب</option>
<option value="other">مدفوعات أخرى للعيادة</option>
</select>
<div class="clinic-money-line">
<input id="clinicExpenseAmount" type="number" placeholder="المبلغ">
<select id="clinicExpenseCurrency">
<option value="SYP">ل.س</option>
<option value="USD">$</option>
</select>
</div>
<input id="clinicExpenseNote" placeholder="ملاحظة اختيارية">
<button onclick="addClinicExpense()">➕ إضافة</button>
</div>

<div class="clinic-expense-list">
<h4>آخر المصاريف</h4>
${(ops.expenses || []).slice(-7).reverse().map((e,i)=>{
let realIndex = (ops.expenses || []).length - 1 - i;
return `<div class="clinic-expense-row">
<div>
<b>${clinicExpenseCategoryLabel(e.category)}</b>
<small>${escapeHtml(e.date || "")}</small>
<p>${escapeHtml(e.note || "")}</p>
</div>
<div>
<strong>${formatMoneyWithCurrencySafe(e.amount,e.currency)}</strong>
<button onclick="deleteClinicExpense(${realIndex})">حذف</button>
</div>
</div>`;
}).join("") || "<p class='clinic-empty'>لا توجد مصاريف بعد.</p>"}
</div>
</div>
`;
}

function formatMoneyWithCurrencySafe(amount,currency){
if(typeof formatMoneyWithCurrency === "function") return formatMoneyWithCurrency(amount,currency);
let n = Number(amount || 0).toLocaleString();
return currency === "USD" ? "$ " + n : n + " ل.س";
}

function toggleClinicFinanceSidebar(){
let box = document.getElementById("clinicFinanceSidebar");
if(!box) return;
box.classList.toggle("collapsed");
renderClinicFinanceSidePanel();
}

function addClinicExpense(){
let amount = Number(getFieldValue("clinicExpenseAmount") || 0);
if(!amount || amount <= 0){
alert("أدخل مبلغ صحيح");
return;
}
let ops = getClinicOperations();
ops.expenses.push({
id:Date.now(),
date:nowDateTime(),
category:getFieldValue("clinicExpenseCategory") || "other",
amount,
currency:typeof normalizeCurrency === "function" ? normalizeCurrency(getFieldValue("clinicExpenseCurrency")) : getFieldValue("clinicExpenseCurrency"),
note:getFieldValue("clinicExpenseNote") || "",
doctor:typeof getActiveDoctor === "function" ? getActiveDoctor() : ""
});
saveClinicOperations(ops);
renderClinicFinanceSidePanel();
try{ renderDashboard(); }catch(e){}
}

function deleteClinicExpense(index){
if(!confirm("حذف هذا المصروف؟")) return;
let ops = getClinicOperations();
ops.expenses.splice(index,1);
saveClinicOperations(ops);
renderClinicFinanceSidePanel();
try{ renderDashboard(); }catch(e){}
}

/* keep side counter updated after patient financial changes */
const __clinicOriginalSaveAll = saveAll;
saveAll = function(){
__clinicOriginalSaveAll();
renderClinicFinanceSidePanel();
};

/* backup override includes operating finance */
function exportBackup(){
let data = {
exportedAt: nowDateTime(),
patients: getPatients(),
clinicOperations: getClinicOperations()
};
let blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
let url = URL.createObjectURL(blob);
let a = document.createElement("a");
a.href = url;
a.download = "clinic-backup.json";
a.click();
URL.revokeObjectURL(url);
}

function importBackup(event){
let file = event.target.files[0];
if(!file) return;
let reader = new FileReader();
reader.onload = function(e){
try{
let data = JSON.parse(e.target.result);
let patients = Array.isArray(data) ? data : data.patients;
if(!Array.isArray(patients)) throw new Error("bad file");
patients = patients.map(p=>ensurePatientFileNo(p));
savePatients(patients);
if(data && data.clinicOperations){
saveClinicOperations(data.clinicOperations);
}
alert("تم استيراد النسخة الاحتياطية");
renderClinicFinanceSidePanel();
showPatients();
}catch(err){
alert("ملف النسخة الاحتياطية غير صحيح");
}
};
reader.readAsText(file);
event.target.value="";
}

/* dashboard override with income counter */
const __clinicOriginalRenderDashboard = renderDashboard;
renderDashboard = function(){
__clinicOriginalRenderDashboard();
let output = document.getElementById("output");
if(!output) return;
let totals = getClinicOperationsTotals();
let statsGrid = output.querySelector(".stats-grid");
if(statsGrid && !statsGrid.querySelector(".clinic-income-stat")){
statsGrid.insertAdjacentHTML("beforeend", `
<div class="stat-card clinic-income-stat">
<span>💵</span>
<b>${formatMoneyWithCurrencySafe(totals.SYP.income,"SYP")}</b>
<b>${formatMoneyWithCurrencySafe(totals.USD.income,"USD")}</b>
<small>مدخول العيادة</small>
</div>
`);
}
renderClinicFinanceSidePanel();
};

document.addEventListener("DOMContentLoaded",function(){
renderClinicFinanceSidePanel();
});


/* =========================================================
   UX + FINANCE PATCH
   - Dashboard monthly income instead of remaining balance
   - Clinic income modal: all-time income / expenses / profit
   - Visit payment field syncs with patient payments and clinic income
   - Ready prescription medication search picker
   - Sidebar visual stability
========================================================= */

function getMonthKeyFromDate(value){
let d = value ? new Date(value) : new Date();
if(isNaN(d.getTime())) d = new Date();
return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
}

function getCurrentMonthKey(){
return getMonthKeyFromDate(new Date());
}

function normalizePaymentDateValue(dateValue){
if(!dateValue) return new Date();
let d = new Date(dateValue);
if(isNaN(d.getTime())) return new Date();
return d;
}

function getClinicIncomeTotalsForMonth(monthKey){
  let totals=getCurrencyBucket();
  totals.SYP.credit=0;
  totals.USD.credit=0;

  monthKey=monthKey||getCurrentMonthKey();

  getPatients().forEach(p=>{
    const finance=p.finance||{};
    const charges=Array.isArray(finance.charges)?finance.charges:[];
    const payments=Array.isArray(finance.payments)?finance.payments:[];

    const chargeTotals={SYP:0,USD:0};
    const monthPayments={SYP:0,USD:0};

    charges.forEach(ch=>{
      const c=typeof normalizeCurrency==='function'
        ?normalizeCurrency(ch.currency)
        :(ch.currency==='USD'?'USD':'SYP');

      const source=String(ch.source||ch.type||ch.kind||'').toLowerCase();

      const chartOnly=(source.includes('chart')||source.includes('dental')) &&
        !(ch.financialConfirmed===true||
          ch.billable===true||
          ch.completed===true||
          ch.status==='completed');

      if(!chartOnly){
        chargeTotals[c]+=Math.abs(Number((ch.amount??ch.cost??ch.price)||0));
      }
    });

    payments.forEach(pay=>{
      const d=normalizePaymentDateValue(pay.isoDate||pay.date);
      if(getMonthKeyFromDate(d)!==monthKey)return;

      const c=typeof normalizeCurrency==='function'
        ?normalizeCurrency(pay.currency)
        :(pay.currency==='USD'?'USD':'SYP');

      monthPayments[c]+=Math.abs(Number(pay.amount||0));
    });

    ['SYP','USD'].forEach(c=>{
      const recognized=Math.min(monthPayments[c],chargeTotals[c]);

      totals[c].income+=recognized;
      totals[c].credit+=Math.max(monthPayments[c]-recognized,0);
    });
  });

  return totals;
}

function getClinicOperationsTotalsAllTime(){
let totals = getClinicOperationsTotals();
return totals;
}

function renderIncomePairHTML(bucket, field){
return `
<b>${formatMoneyWithCurrencySafe(bucket.SYP[field] || 0,"SYP")}</b>
<b>${formatMoneyWithCurrencySafe(bucket.USD[field] || 0,"USD")}</b>
`;
}

function openClinicIncomeModal(){
let old = document.getElementById("clinicIncomeModal");
if(old) old.remove();
let all = getClinicOperationsTotalsAllTime();
let month = getClinicIncomeTotalsForMonth();
let modal = document.createElement("div");
modal.className = "modal clinic-income-modal";
modal.id = "clinicIncomeModal";
modal.innerHTML = `
<div class="modalBox clinic-income-modal-box">
<h2>💵 مالية العيادة</h2>
<p class="modal-hint">عداد الشهر الحالي مع ملخص شامل منذ أول يوم تشغيل للبرنامج.</p>

<div class="clinic-income-modal-section monthly-income-box">
<h3>مدخول الشهر الحالي</h3>
<div class="clinic-income-big">
${renderIncomePairHTML(month,"income")}
</div>
</div>

<div class="clinic-income-modal-grid">
<div>
<small>الدخل المعترف به من الأعمال</small>
${renderIncomePairHTML(all,"income")}
</div>
<div>
<small>سلف المرضى / التزام على العيادة</small>
${renderIncomePairHTML(all,"credit")}
</div>
<div>
<small>كل المصروفات التشغيلية</small>
${renderIncomePairHTML(all,"expenses")}
</div>
<div class="${(all.SYP.net < 0 || all.USD.net < 0) ? "loss" : "profit"}">
<small>الربح / الصافي</small>
${renderIncomePairHTML(all,"net")}
</div>
</div>

<div class="modal-actions centered-actions">
<button onclick="closeClinicIncomeModal()">إغلاق</button>
<button onclick="toggleClinicFinanceSidebar(); closeClinicIncomeModal();">فتح مالية العيادة</button>
</div>
</div>
`;
document.body.appendChild(modal);
}

function closeClinicIncomeModal(){
let modal = document.getElementById("clinicIncomeModal");
if(modal) modal.remove();
}

/* final dashboard override: no remaining balance card */
renderDashboard = function(){
let stats = getClinicStats();
let apptStats = (typeof getAppointmentStats === "function") ? getAppointmentStats() : {todayCount:0};
let upcoming = (typeof getUpcomingAppointments === "function") ? getUpcomingAppointments(6) : [];
let today = new Date().toLocaleDateString();
let monthIncome = getClinicIncomeTotalsForMonth();

const output = document.getElementById("output");
if(!output) return;

output.innerHTML = `
<section class="dashboard-hero pro-hero">
<div class="hero-glow"></div>
<div class="hero-content">
<div>
<span class="hero-label">Dental Chain | Dr. Taher</span>
<h1>نظام عيادة د. طاهر الأجا</h1>
<p>DDS, PhD-Endodontics · إدارة المرضى والوصفات والخطة العلاجية</p>
</div>
<div class="hero-date">${today}</div>
</div>
</section>

<section class="stats-grid">
<div class="stat-card"><span>👥</span><b>${stats.patients}</b><small>المرضى</small></div>
<div class="stat-card"><span>📅</span><b>${apptStats.todayCount || 0}</b><small>مواعيد اليوم</small></div>
<div class="stat-card"><span>🧾</span><b>${stats.prescriptions}</b><small>الوصفات</small></div>
<button class="stat-card clinic-income-stat income-open-card" onclick="openClinicIncomeModal()">
<span>💵</span>
<b>${formatMoneyWithCurrencySafe(monthIncome.SYP.income,"SYP")}</b>
<b>${formatMoneyWithCurrencySafe(monthIncome.USD.income,"USD")}</b>
<small>مدخول الشهر</small>
</button>
</section>

<section class="quick-actions">
<button onclick="openAppointmentsManager()">📅 المواعيد</button>
<button onclick="exportBackup()">📦 نسخة احتياطية</button>
</section>

<section class="dashboard-panels">
<div class="card dashboard-panel">
<h3>📅 المواعيد القادمة</h3>
${upcoming.length ? upcoming.map(x=>`
<div class="mini-appointment">
<b>${escapeHtml(x.patient.name || "")}</b>
<span>${escapeHtml(x.appointment.date || "")} ${escapeHtml(x.appointment.time || "")}</span>
<small>${escapeHtml(x.appointment.type || x.appointment.note || "")}</small>
</div>
`).join("") : "<p>لا توجد مواعيد قادمة.</p>"}
</div>
<div class="card dashboard-panel">
<h3>💡 ملاحظة</h3>
<p>ابدأ بإدخال بيانات المريض بالأعلى، أو افتح ملف مريض من قائمة المرضى.</p>
<p>استخدم البطاقات والأزرار الظاهرة للوصول إلى الأدوات المتاحة لحسابك.</p>
</div>
</section>
`;
const backBtn = document.getElementById("backBtn");
if(backBtn) backBtn.style.display = "none";
renderClinicFinanceSidePanel();
};

/* visit modal payment support */
function ensureVisitPaymentFields(){
let box = document.querySelector("#visitModal .modalBox");
if(!box) return;
if(document.getElementById("visitPaymentAmount")) return;
let textarea = document.getElementById("visitText");
if(!textarea) return;
textarea.insertAdjacentHTML("afterend", `
<div class="visit-payment-box">
<label>دفعة مالية مع الزيارة</label>
<div class="visit-payment-line">
<input id="visitPaymentAmount" type="number" placeholder="المبلغ المدفوع">
<select id="visitPaymentCurrency">
<option value="SYP">ل.س</option>
<option value="USD">$</option>
</select>
</div>
<input id="visitPaymentNote" placeholder="ملاحظة الدفعة - اختياري">
</div>
`);
}

openVisit = function(){
const p = getCurrentPatient();
if(!p){
alert("سجّل المريض أولاً أو افتح ملفه من قائمة المرضى");
return;
}
patient = p;
ensureVisitPaymentFields();
setFieldValue("visitPaymentAmount","");
setFieldValue("visitPaymentNote","");
setFieldValue("visitPaymentCurrency","SYP");
document.getElementById("visitModal").classList.remove("hidden");
};

saveVisit = function(){
if(!patient){ alert("لا يوجد مريض محدد"); return; }
let text = getFieldValue("visitText").trim();
let paymentAmount = Number(getFieldValue("visitPaymentAmount") || 0);
let paymentCurrency = normalizeCurrency(getFieldValue("visitPaymentCurrency"));
let paymentNote = getFieldValue("visitPaymentNote").trim();

if(!text && (!paymentAmount || paymentAmount <= 0)){
alert("اكتب ملاحظات الزيارة أو أدخل دفعة مالية");
return;
}

if(text){
patient.visits = patient.visits || [];
patient.visits.push({
date:nowDateTime(),
text,
doctor: typeof getActiveDoctor === "function" ? getActiveDoctor() : ""
});
}

if(paymentAmount && paymentAmount > 0){
let finance = getPatientFinance(patient);
finance.payments.push({
date:nowDateTime(),
isoDate:new Date().toISOString(),
label: paymentNote || "دفعة مع الزيارة",
amount: paymentAmount,
currency: paymentCurrency,
doctor: typeof getActiveDoctor === "function" ? getActiveDoctor() : ""
});
}

setFieldValue("visitText","");
setFieldValue("visitPaymentAmount","");
setFieldValue("visitPaymentNote","");
saveAll();
closeVisit();
openPatient(patient);
renderClinicFinanceSidePanel();
};

/* add isoDate to direct financial payments so monthly income is reliable */
const __incomePatchAddFinancePayment = addFinancePayment;
addFinancePayment = function(){
if(!patient) return;
let label = getFieldValue("paymentLabel").trim();
let amount = Number(getFieldValue("paymentAmount") || 0);
let currency = normalizeCurrency(getFieldValue("paymentCurrency"));
if(!amount || amount <= 0){ alert("أدخل مبلغ صحيح"); return; }
let finance = getPatientFinance(patient);
finance.payments.push({
date:nowDateTime(),
isoDate:new Date().toISOString(),
label,
amount,
currency,
doctor: typeof getActiveDoctor === "function" ? getActiveDoctor() : ""
});
saveAll();
openFinanceManager();
renderClinicFinanceSidePanel();
};

/* searchable picker for adding medications to ready prescriptions */
function renderReadyEditor(rx){
let guideMeds = flattenGuideMeds(rxManagerType);
window.__readyGuideMedsCache = guideMeds;
let editor = document.getElementById("readyEditor");
editor.innerHTML = `
<div class="manager-editor">
<h3>${readyEditIndex === null ? "إضافة وصفة جاهزة" : "تعديل وصفة جاهزة"}</h3>

<label>اسم الوصفة</label>
<input id="readyTitle" value="${escapeHtml(rx.title || "")}" placeholder="مثال: قلع">

<label>تعليمات آخر الوصفة</label>
<textarea id="readyInstructions" placeholder="كل تعليمة بسطر مستقل — استخدم [[النص]] لتلوينه بالأحمر">${escapeHtml((rx.instructions || []).join("\n"))}</textarea>

<h4>أدوية الوصفة</h4>
<div id="readyMedsList">${renderReadyMedsList()}</div>

<h4>إضافة دواء من كل الأدوية الحالية</h4>
<input id="readyMedSearch" class="manager-search-input" placeholder="ابحث باسم الدواء أو الجرعة أو البروتوكول..." oninput="renderReadyMedSearchResults()">
<div id="readyMedSearchResults" class="manager-search-results"></div>

<h4>إضافة دواء جديد يدويًا</h4>
<div class="manual-med-grid">
<input id="readyMedName" placeholder="اسم الدواء">
<input id="readyMedDose" placeholder="الجرعة">
<input id="readyMedTime" placeholder="أوقات الدواء">
<input id="readyMedNote" placeholder="ملاحظات">
</div>
<button onclick="addManualMedToReady()">➕ إضافة الدواء للوصفة</button>

<br><br>
<button onclick="saveReadyPrescriptionEditor()">💾 حفظ الوصفة الجاهزة</button>
<button onclick="renderReadyManager()">إلغاء</button>
</div>
`;
renderReadyMedSearchResults();
}

function renderReadyMedSearchResults(){
let box = document.getElementById("readyMedSearchResults");
if(!box) return;
let q = (getFieldValue("readyMedSearch") || "").trim().toLowerCase();
let meds = window.__readyGuideMedsCache || flattenGuideMeds(rxManagerType);
let filtered = meds.filter(x=>{
let hay = `${x.protocol || ""} ${x.med.name || ""} ${x.med.dose || ""} ${x.med.note || ""}`.toLowerCase();
return !q || hay.includes(q);
}).slice(0,18);
box.innerHTML = filtered.map((x,i)=>`
<div class="manager-search-result" onclick="chooseExistingMedToReady(${meds.indexOf(x)})">
<b>${escapeHtml(x.med.name || "")}</b>
<small>${escapeHtml(x.med.dose || "")} · ${escapeHtml(x.protocol || "")}</small>
<p>${escapeHtml(x.med.note || "")}</p>
</div>
`).join("") || "<p class='clinic-empty'>لا توجد نتائج.</p>";
}

function chooseExistingMedToReady(index){
let meds = window.__readyGuideMedsCache || flattenGuideMeds(rxManagerType);
let item = meds[index];
if(!item) return;
readyEditMeds.push(cloneData(item.med));
refreshReadyMedsList();
setFieldValue("readyMedSearch","");
renderReadyMedSearchResults();
}

/* side panel visual stability */
const __visualPatchRenderClinicFinanceSidePanel = renderClinicFinanceSidePanel;
renderClinicFinanceSidePanel = function(){
__visualPatchRenderClinicFinanceSidePanel();
};


/* =========================================================
   SAFE PATCH A - UX / RX BUILDER / APPOINTMENTS / FINANCE / PLANS
   يضاف فوق النسخة الشغالة بدون إعادة بناء النظام.
========================================================= */

function moneyBalanceSafe(charges,payments){
return Math.max(0, Number(charges || 0) - Number(payments || 0));
}

/* Finance final override: payments never show as negative remaining balance */
getFinanceTotals = function(p){
let finance = getPatientFinance(p);
let totals = {
SYP:{totalCharges:0,totalPayments:0,balance:0,credit:0},
USD:{totalCharges:0,totalPayments:0,balance:0,credit:0}
};

(finance.charges || []).forEach(x=>{
let c = normalizeCurrency(x.currency);
totals[c].totalCharges += Math.abs(Number(x.amount || 0));
});

(finance.payments || []).forEach(x=>{
let c = normalizeCurrency(x.currency);
totals[c].totalPayments += Math.abs(Number(x.amount || 0));
});

Object.keys(totals).forEach(c=>{
let raw = totals[c].totalCharges - totals[c].totalPayments;
totals[c].balance = Math.max(0, raw);
totals[c].credit = raw < 0 ? Math.abs(raw) : 0;
});
return totals;
};

renderFinancialSummary = function(p){
let totals = getFinanceTotals(p);
return `
<div class="finance-summary multi-currency-summary safe-finance-summary">
<div><small>الإجمالي بالسوري</small><b>${formatMoneyWithCurrency(totals.SYP.totalCharges,"SYP")}</b></div>
<div><small>سلفة بالسوري</small><b>${formatMoneyWithCurrency(totals.SYP.totalPayments,"SYP")}</b></div>
<div class="${totals.SYP.balance > 0 ? "finance-due" : "finance-ok"}"><small>الباقي بالسوري</small><b>${formatMoneyWithCurrency(totals.SYP.balance,"SYP")}</b>${totals.SYP.credit ? `<em>رصيد زائد: ${formatMoneyWithCurrency(totals.SYP.credit,"SYP")}</em>` : ""}</div>
<div><small>الإجمالي بالدولار</small><b>${formatMoneyWithCurrency(totals.USD.totalCharges,"USD")}</b></div>
<div><small>سلفة بالدولار</small><b>${formatMoneyWithCurrency(totals.USD.totalPayments,"USD")}</b></div>
<div class="${totals.USD.balance > 0 ? "finance-due" : "finance-ok"}"><small>الباقي بالدولار</small><b>${formatMoneyWithCurrency(totals.USD.balance,"USD")}</b>${totals.USD.credit ? `<em>رصيد زائد: ${formatMoneyWithCurrency(totals.USD.credit,"USD")}</em>` : ""}</div>
</div>
<button onclick="openFinanceManager()">💰 الكشف المالي</button>
`;
};

addFinancePayment = function(){
if(!patient) return;
let label = getFieldValue("paymentLabel").trim();
let amount = Math.abs(Number(getFieldValue("paymentAmount") || 0));
let currency = normalizeCurrency(getFieldValue("paymentCurrency"));
if(!amount || amount <= 0){ alert("أدخل مبلغ صحيح"); return; }
let finance = getPatientFinance(patient);
finance.payments.push({
date:nowDateTime(),
isoDate:new Date().toISOString(),
label: label || "دفعة مالية",
amount,
currency,
doctor: typeof getActiveDoctor === "function" ? getActiveDoctor() : ""
});
saveAll();
openFinanceManager();
if(typeof renderClinicFinanceSidePanel === "function") renderClinicFinanceSidePanel();
};

/* Visit modal final UX/payment override */
function ensureVisitPaymentFieldsSafe(){
let box = document.querySelector("#visitModal .modalBox");
if(!box) return;
let textarea = document.getElementById("visitText");
if(textarea) textarea.classList.add("visit-textarea-pro");
if(document.getElementById("visitPaymentAmount")) return;
if(!textarea) return;
textarea.insertAdjacentHTML("afterend", `
<div class="visit-payment-box visit-payment-box-pro">
<label>دفعة مالية مع الزيارة</label>
<div class="visit-payment-line">
<input id="visitPaymentAmount" type="number" placeholder="المبلغ المدفوع">
<select id="visitPaymentCurrency">
<option value="SYP">ل.س</option>
<option value="USD">$</option>
</select>
</div>
<input id="visitPaymentNote" placeholder="ملاحظة الدفعة - اختياري">
</div>
`);
}

openVisit = function(){
const p = getCurrentPatient();
if(!p){ alert("سجّل المريض أولاً أو افتح ملفه من قائمة المرضى"); return; }
patient = p;
ensureVisitPaymentFieldsSafe();
setFieldValue("visitPaymentAmount","");
setFieldValue("visitPaymentNote","");
setFieldValue("visitPaymentCurrency","SYP");
document.getElementById("visitModal").classList.remove("hidden");
setTimeout(()=>{ let t=document.getElementById("visitText"); if(t) t.focus(); },50);
};

saveVisit = function(){
if(!patient){ alert("لا يوجد مريض محدد"); return; }
let text = getFieldValue("visitText").trim();
let paymentAmount = Math.abs(Number(getFieldValue("visitPaymentAmount") || 0));
let paymentCurrency = normalizeCurrency(getFieldValue("visitPaymentCurrency"));
let paymentNote = getFieldValue("visitPaymentNote").trim();

if(!text && (!paymentAmount || paymentAmount <= 0)){
alert("اكتب ملاحظات الزيارة أو أدخل دفعة مالية");
return;
}

if(text){
patient.visits = patient.visits || [];
patient.visits.push({date:nowDateTime(), text, doctor: typeof getActiveDoctor === "function" ? getActiveDoctor() : ""});
}

if(paymentAmount && paymentAmount > 0){
let finance = getPatientFinance(patient);
finance.payments.push({
date:nowDateTime(),
isoDate:new Date().toISOString(),
label: paymentNote || "دفعة مع الزيارة",
amount: paymentAmount,
currency: paymentCurrency,
doctor: typeof getActiveDoctor === "function" ? getActiveDoctor() : ""
});
}

setFieldValue("visitText","");
setFieldValue("visitPaymentAmount","");
setFieldValue("visitPaymentNote","");
saveAll();
closeVisit();
openPatient(patient);
if(typeof renderClinicFinanceSidePanel === "function") renderClinicFinanceSidePanel();
};

/* DR mark becomes home button even if HTML not modified */
document.addEventListener("DOMContentLoaded", function(){
let mark = document.querySelector(".brand-mark");
if(mark){
mark.classList.add("brand-home-btn");
mark.setAttribute("title","رجوع للرئيسية");
mark.onclick = function(){ backToHome(); };
}
});

/* Manual prescription builder: complete drug list grouped by family */
let manualBuilderSelected = [];
let manualBuilderInstructions = [];

function drugFamilyForManual(item){
let m = item.med || item;
let text = `${item.protocol || ""} ${m.name || ""} ${m.dose || ""} ${m.note || ""}`.toLowerCase();
if(text.includes("chlorhexidine") || text.includes("مضم") || text.includes("ماء وملح")) return "مضامض";
if(text.includes("paracetamol") || text.includes("سيتامول") || text.includes("مسكن")) return "مسكنات";
if(text.includes("ibuprofen") || text.includes("surgam") || text.includes("agilomox") || text.includes("nsaid")) return "مضاد التهاب غير ستيروئيدي";
if(text.includes("dexam") || text.includes("alpha") || text.includes("وذمة") || text.includes("edema")) return "مضاد وذمة";
if(text.includes("amoxic") || text.includes("augmentin") || text.includes("metronidazole") || text.includes("cefixime") || text.includes("lincomycin") || text.includes("clavulanic")) return "مضاد التهاب";
return "تعليمات";
}

function getAllManualBuilderItems(){
let all = [];
["adult","child"].forEach(type=>{
flattenGuideMeds(type).forEach(x=>all.push({...x, type}));
});
let seen = new Set();
let meds = [];
all.forEach(x=>{
let m = x.med || {};
let key = [m.name,m.dose,m.note].join("|").toLowerCase();
if(seen.has(key)) return;
seen.add(key);
meds.push(x);
});
let instructions = [];
Object.keys(READY_RX || {}).forEach(type=>{
(READY_RX[type] || []).forEach(rx=>{
(rx.instructions || []).forEach(t=>{
let key = "instruction|" + t;
if(seen.has(key)) return;
seen.add(key);
instructions.push({type, protocol:rx.title || "تعليمات", med:{name:t, dose:"", note:"", instructionOnly:true}});
});
});
});
return meds.concat(instructions);
}

function openManualDrugBuilder(){
manualBuilderSelected = [];
manualBuilderInstructions = [];
renderManualDrugBuilder();
}

function renderManualDrugBuilder(){
let groupsOrder = ["مضاد التهاب غير ستيروئيدي","مضاد التهاب","مسكنات","مضاد وذمة","مضامض","تعليمات"];
let q = (getFieldValue("manualDrugSearch") || "").trim().toLowerCase();
let items = getAllManualBuilderItems().filter(x=>{
let m=x.med||{};
let hay = `${x.protocol||""} ${m.name||""} ${m.dose||""} ${m.note||""}`.toLowerCase();
return !q || hay.includes(q);
});
let groups = {};
groupsOrder.forEach(g=>groups[g]=[]);
items.forEach(x=>{
let fam = drugFamilyForManual(x);
(groups[fam] || groups["تعليمات"]).push(x);
});

document.getElementById("output").innerHTML = `
<div class="card manual-rx-builder">
<h2>🧠 اختراع وصفة</h2>
<p class="type-hint">اختيار يدوي من كل الأدوية الموجودة، مرتبة حسب العائلة، بدون بروتوكولات.</p>
<input id="manualDrugSearch" class="manual-drug-search" placeholder="ابحث باسم الدواء / الجرعة / الملاحظة..." oninput="renderManualDrugBuilder()" value="${escapeHtml(getFieldValue("manualDrugSearch") || "")}">
<div class="manual-selected-box">
<b>المختار:</b>
${manualBuilderSelected.length || manualBuilderInstructions.length ? [...manualBuilderSelected.map(m=>m.name),...manualBuilderInstructions].map(x=>`<span>${escapeHtml(x)}</span>`).join("") : "<small>لم يتم اختيار شيء بعد.</small>"}
</div>
${groupsOrder.map(group=>`
<section class="manual-family-section">
<h3>${group}</h3>
<div class="manual-drug-grid">
${groups[group].length ? groups[group].map((x,i)=>{
let globalIndex = getAllManualBuilderItems().findIndex(y=> (y.med.name===x.med.name && y.med.dose===x.med.dose && y.med.note===x.med.note && y.protocol===x.protocol));
let m=x.med||{};
let selected = m.instructionOnly ? manualBuilderInstructions.includes(m.name) : manualBuilderSelected.some(s=>s.name===m.name && s.dose===m.dose && s.note===m.note);
return `<div class="manual-drug-card ${selected ? "selected-med" : ""}" onclick="toggleManualBuilderItem(${globalIndex})">
<b>${escapeHtml(m.name || "")}</b>
${m.dose ? `<small>${escapeHtml(m.dose)}</small>` : ""}
${m.note ? `<p>${escapeHtml(m.note)}</p>` : ""}
<em>${escapeHtml(x.protocol || "")}</em>
</div>`;
}).join("") : "<p class='clinic-empty'>لا توجد عناصر.</p>"}
</div>
</section>
`).join("")}
<div class="modal-actions centered-actions">
<button onclick="generateManualDrugBuilderRx()">🧾 إنشاء الوصفة</button>
<button onclick="renderModeStep()">رجوع</button>
</div>
</div>
`;
document.getElementById("backBtn").style.display="block";
}

function toggleManualBuilderItem(index){
let item = getAllManualBuilderItems()[index];
if(!item) return;
let m = cloneData(item.med || {});
if(m.instructionOnly){
if(manualBuilderInstructions.includes(m.name)) manualBuilderInstructions = manualBuilderInstructions.filter(x=>x!==m.name);
else manualBuilderInstructions.push(m.name);
}else{
let key = [m.name,m.dose,m.note].join("|");
let exists = manualBuilderSelected.some(s=>[s.name,s.dose,s.note].join("|")===key);
manualBuilderSelected = exists ? manualBuilderSelected.filter(s=>[s.name,s.dose,s.note].join("|")!==key) : manualBuilderSelected.concat([m]);
}
renderManualDrugBuilder();
}

function generateManualDrugBuilderRx(){
if(manualBuilderSelected.length===0 && manualBuilderInstructions.length===0){ alert("اختر دواء أو تعليمة واحدة على الأقل"); return; }
if(manualBuilderSelected.length && hasAllergyConflict(manualBuilderSelected)){
if(!confirm("⚠ انتبه: يوجد تحسس دوائي مسجل وقد تتعارض بعض الأدوية المختارة. هل تريد المتابعة؟")) return;
}
let rx = {date:nowDateTime(), type:rxType || "adult", title:"وصفة يدوية", meds:[...manualBuilderSelected], instructions:[...manualBuilderInstructions]};
patient.prescriptions = patient.prescriptions || [];
patient.prescriptions.push(rx);
saveAll();
rxPreview = rx;
renderGeneratedRx(rx);
previewPrescription();
}

renderModeStep = function(){
let label = rxType === "child" ? "طفل" : (rxPregnantMode ? "بالغة حامل" : "بالغ");
document.getElementById("output").innerHTML=`
<div class="card prescription-mode-card">
<h3>${label}</h3>
${rxPregnantMode ? `<div class="pregnancy-prescription-alert">🤰 هذه الوصفة لمريضة حامل: سيتم تلوين الأدوية غير المناسبة وإظهار تحذير قبل الحفظ.</div>` : ""}
<div class="rx-mode-actions">
<button onclick="openReadyList()">📋 وصفة جاهزة</button>
<button onclick="openCustomProtocols()">✍️ أنشئ بنفسك</button>
<button class="invent-rx-btn" onclick="openManualDrugBuilder()">🧠 اختراع وصفة</button>
</div>
<br><button onclick="goBack()">⬅ رجوع</button>
</div>
`;
};

/* Dashboard final override: appointment counter is the button; no appointment button in quick actions */
renderDashboard = function(){
let stats = getClinicStats();
let apptStats = (typeof getAppointmentStats === "function") ? getAppointmentStats() : {todayCount:0};
let upcoming = (typeof getUpcomingAppointments === "function") ? getUpcomingAppointments(6) : [];
let today = new Date().toLocaleDateString();
let monthIncome = getClinicIncomeTotalsForMonth();
const output = document.getElementById("output");
if(!output) return;
output.innerHTML = `
<section class="dashboard-hero pro-hero">
<div class="hero-glow"></div>
<div class="hero-content">
<div><span class="hero-label">Dental Chain | Dr. Taher</span><h1>نظام عيادة د. طاهر الأجا</h1><p>DDS, PhD-Endodontics · إدارة المرضى والوصفات والخطة العلاجية</p></div>
<div class="hero-date">${today}</div>
</div>
</section>
<section class="stats-grid">
<div class="stat-card"><span>👥</span><b>${stats.patients}</b><small>المرضى</small></div>
<button class="stat-card today-appointments-card" onclick="openAppointmentsManager()"><span>📅</span><b>${apptStats.todayCount || 0}</b><small>مواعيد اليوم</small></button>
<div class="stat-card"><span>🧾</span><b>${stats.prescriptions}</b><small>الوصفات</small></div>
<button class="stat-card clinic-income-stat income-open-card" onclick="openClinicIncomeModal()"><span>💵</span><b>${formatMoneyWithCurrencySafe(monthIncome.SYP.income,"SYP")}</b><b>${formatMoneyWithCurrencySafe(monthIncome.USD.income,"USD")}</b><small>مدخول الشهر</small></button>
</section>
<section class="quick-actions">
<button onclick="exportBackup()">📦 نسخة احتياطية</button>
</section>
<section class="dashboard-panels">
<div class="card dashboard-panel"><h3>📅 المواعيد القادمة</h3>
${upcoming.length ? upcoming.map(x=>`<div class="mini-appointment"><b>${escapeHtml(x.patient.name || "")}</b><span>${escapeHtml(x.appointment.date || "")} ${escapeHtml(x.appointment.time || "")}</span><small>${escapeHtml(x.appointment.type || x.appointment.note || "")}</small></div>`).join("") : "<p>لا توجد مواعيد قادمة.</p>"}
</div>
<div class="card dashboard-panel"><h3>💡 إرشادات سريعة</h3><p>استخدم البطاقات والأزرار الظاهرة للوصول السريع إلى وظائف العيادة.</p><p>تتغير الأدوات المتاحة تلقائيًا بحسب نوع الحساب والصلاحيات.</p></div>
</section>
`;
const backBtn = document.getElementById("backBtn");
if(backBtn) backBtn.style.display = "none";
if(typeof renderClinicFinanceSidePanel === "function") renderClinicFinanceSidePanel();
};

/* Treatment plan: edit + keep finance charge synced */
function syncTreatmentPlanFinance(plan, oldTitle){
if(!patient || !plan) return;
let finance = getPatientFinance(patient);
finance.charges = finance.charges || [];
let amount = Math.abs(Number(plan.cost || 0));
let currency = normalizeCurrency(plan.currency || "SYP");
let toothText = plan.tooth ? " - سن " + (typeof getPalmerLabel === "function" ? getPalmerLabel(plan.tooth) : plan.tooth) : "";
let label = "خطة علاج: " + (plan.title || "") + toothText;
let idx = -1;
if(plan.financeChargeId) idx = finance.charges.findIndex(c=>c.id === plan.financeChargeId);
if(idx === -1){
idx = finance.charges.findIndex(c=> String(c.label || "").startsWith("خطة علاج:") && ((oldTitle && String(c.label||"").includes(oldTitle)) || String(c.label||"").includes(plan.title || "")) && (!plan.tooth || String(c.label||"").includes("سن")) );
}
if(amount > 0){
if(idx >= 0){
finance.charges[idx].label = label;
finance.charges[idx].amount = amount;
finance.charges[idx].currency = currency;
finance.charges[idx].planId = plan.id;
finance.charges[idx].financeChargeId = finance.charges[idx].financeChargeId || finance.charges[idx].id || plan.financeChargeId;
finance.charges[idx].updatedAt = nowDateTime();
finance.charges[idx].doctor = typeof getActiveDoctor === "function" ? getActiveDoctor() : "";
plan.financeChargeId = finance.charges[idx].id || (finance.charges[idx].id = "plan-" + (plan.id || Date.now()));
}else{
let id = "plan-" + (plan.id || Date.now());
finance.charges.push({
id,
financeChargeId:id,
planId:plan.id,
date:nowDateTime(),
label,
amount,
currency,
doctor: typeof getActiveDoctor === "function" ? getActiveDoctor() : ""
});
plan.financeChargeId = id;
}
}else if(idx >= 0){
finance.charges.splice(idx,1);
plan.financeChargeId = "";
}
}

addTreatmentPlan = function(){
if(!patient) return;
let tooth = getFieldValue("planTooth").trim();
let title = getFieldValue("planTitle").trim();
let rawSteps = getFieldValue("planSteps");
let cost = Math.abs(Number(getFieldValue("planCost") || 0));
let currency = normalizeCurrency(getFieldValue("planCurrency") || "SYP");
let note = getFieldValue("planNote").trim();
if(!title){ alert("اكتب عنوان الخطة"); return; }
let steps = rawSteps.split("\n").map(x=>x.trim()).filter(Boolean).map(text=>({text, done:false}));
if(steps.length === 0) steps = [{text:"بدء العلاج", done:false}];
let plan = {
id:Date.now(),
tooth,
title,
steps,
cost,
currency,
note,
status:"active",
doctor:getActiveDoctor(),
createdAt:nowDateTime()
};
getTreatmentPlans(patient).push(plan);

/* مهم جداً:
   إنشاء الخطة يضيف التكلفة المالية فقط.
   لا يتم تعديل شكل السن أو حالته في الخريطة السنية إلا عند ضغط زر "تم". */
syncTreatmentPlanFinance(plan);

saveAll();
openTreatmentPlanManager();
};

editTreatmentPlan = function(index){
let plans = getTreatmentPlans(patient);
let plan = plans[index];
if(!plan) return;
let oldTitle = plan.title || "";
let title = prompt("عنوان الخطة", plan.title || "");
if(title === null) return;
let cost = prompt("التكلفة", plan.cost || "");
if(cost === null) return;
let currency = prompt("العملة: اكتب SYP أو USD", getTreatmentPlanCurrency(plan));
if(currency === null) return;
let note = prompt("ملاحظات", plan.note || "");
if(note === null) return;
plan.title = title;
plan.cost = Math.abs(Number(cost || 0));
plan.currency = normalizeCurrency(currency);
plan.note = note;
plan.updatedAt = nowDateTime();
plan.doctor = typeof getActiveDoctor === "function" ? getActiveDoctor() : (plan.doctor || "");
syncTreatmentPlanFinance(plan, oldTitle);
saveAll();
openTreatmentPlanManager();
};

/* Appointment day slots: keep booked slots gray and named */
openDaySchedule = function(dateISO){
let box = document.getElementById("dayScheduleBox");
if(!box) return;
let d = new Date(dateISO + "T00:00:00");
let isFriday = d.getDay() === 5;
let list = getAppointmentsForDate(dateISO);
let used = {};
list.forEach(x=>{ used[x.appointment.time || ""] = x; });
let slots = getClinicWorkingSlots();
box.innerHTML = `
<div class="day-wheel-card">
<h3>${arabicDayName(d)} - ${dateISO}</h3>
${isFriday ? `<div class="closed-note">العيادة مغلقة يوم الجمعة</div>` : ""}
<div class="time-wheel">
${slots.map(time=>{
let ap = used[time];
return `<div class="time-slot ${ap ? "busy-slot booked-time-slot" : "free-slot"}" onclick="${ap ? "" : `fillAppointmentTime('${dateISO}','${time}')`}">
<b>${time}</b>
<span>${ap ? escapeHtml(firstName(ap.patient.name)) + " - " + escapeHtml(ap.appointment.type || ap.appointment.note || "موعد") : "متاح"}</span>
</div>`;
}).join("")}
</div>
</div>
`;
};

/* =========================================================
   CLINIC EMR v4 - STABLE CORE OVERRIDES
   - Treatment plan finance sync by currency
   - Tooth chart changes ONLY when treatment is marked DONE
   - Local-date appointments without day shifting
   - Weekly/day appointment timeline
   - Audit log + Undo snapshots
========================================================= */

const CLINIC_V4_VERSION = "4.0.0";
let clinicUndoStack = [];

function cloneClinicData(data){
try{return JSON.parse(JSON.stringify(data));}catch(e){return data;}
}

function getActiveDoctor(){
let el = document.getElementById("activeDoctor");
return el ? (el.value || "") : "";
}

function pushUndoSnapshot(action="تعديل"){
try{
clinicUndoStack.push({
action,
time:nowDateTime(),
patients:cloneClinicData(getPatients()),
currentFileNo:patient ? (patient.fileNo || "") : ""
});
if(clinicUndoStack.length > 30) clinicUndoStack.shift();
}catch(e){console.warn("Undo snapshot failed", e);}
}

function undoLastAction(){
let snap = clinicUndoStack.pop();
if(!snap){ alert("لا يوجد إجراء للتراجع عنه"); return; }
savePatients(snap.patients || []);
if(snap.currentFileNo){
let p = getPatients().find(x => (x.fileNo || "") === snap.currentFileNo);
if(p){ patient = p; openPatient(p); return; }
}
patient = null;
backToHome();
alert("تم التراجع عن: " + (snap.action || "آخر إجراء"));
}

function auditPatientAction(p, action, details=""){
if(!p) return;
p.auditLog = Array.isArray(p.auditLog) ? p.auditLog : [];
p.auditLog.push({
action,
details,
doctor:getActiveDoctor(),
time:nowDateTime()
});
if(p.auditLog.length > 300) p.auditLog = p.auditLog.slice(-300);
}

function renderAuditLog(p){
let log = Array.isArray(p.auditLog) ? p.auditLog.slice().reverse().slice(0,20) : [];
if(!log.length) return "<p>لا يوجد سجل تعديلات بعد.</p>";
return `
<div class="audit-log-list">
${log.map(x=>`
<div class="audit-log-item">
<b>${escapeHtml(x.action || "")}</b>
<small>${escapeHtml(x.time || "")} ${x.doctor ? " - " + escapeHtml(x.doctor) : ""}</small>
${x.details ? `<p>${escapeHtml(x.details)}</p>` : ""}
</div>
`).join("")}
</div>`;
}

function localDateFromISO(dateISO){
let clean = normalizeAppointmentDate(dateISO || todayISO());
let m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
if(!m) return new Date();
return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), 12, 0, 0, 0);
}

function todayISO(){
let d = new Date();
return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function toISODate(d){
return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function addDaysToDate(date,days){
let d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
d.setDate(d.getDate()+days);
return d;
}

function normalizeAppointmentDate(dateValue){
if(!dateValue) return "";
let v = String(dateValue).trim();
let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
if(m) return `${m[1]}-${m[2]}-${m[3]}`;
let d = new Date(v);
if(isNaN(d.getTime())) return v;
return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
}

function normalizeAppointmentTime(timeValue){
if(!timeValue) return "";
let v = String(timeValue).trim();
let m = v.match(/^(\d{1,2}):(\d{2})/);
if(m){
let h = Math.max(0, Math.min(23, Number(m[1])));
let min = Math.max(0, Math.min(59, Number(m[2])));
return String(h).padStart(2,"0") + ":" + String(min).padStart(2,"0");
}
m = v.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm|ص|م)?$/);
if(m){
let h = Number(m[1]);
let min = Number(m[2] || 0);
let ap = (m[3] || "").toUpperCase();
if(ap === "PM" || ap === "م"){
if(h < 12) h += 12;
}
if(ap === "AM" || ap === "ص"){
if(h === 12) h = 0;
}
return String(h).padStart(2,"0") + ":" + String(min).padStart(2,"0");
}
return v;
}

function formatTime12(timeValue){
let t = normalizeAppointmentTime(timeValue);
let m = String(t).match(/^(\d{1,2}):(\d{2})/);
if(!m) return t || "";
let h = Number(m[1]);
let min = m[2];
let ampm = h >= 12 ? "PM" : "AM";
h = h % 12;
if(h === 0) h = 12;
return `${h}:${min} ${ampm}`;
}

function normalizeCurrency(value){
return String(value || "SYP").toUpperCase() === "USD" ? "USD" : "SYP";
}

function currencyLabel(value){
return normalizeCurrency(value) === "USD" ? "$" : "ل.س";
}

function formatMoneyWithCurrency(amount,currency){
return formatMoney(Math.abs(Number(amount || 0))) + " " + currencyLabel(currency);
}

function getTreatmentPlanCurrency(plan){
return normalizeCurrency(plan && plan.currency ? plan.currency : "SYP");
}

function getTreatmentPlanChargeId(plan){
if(!plan) return "";
if(plan.financeChargeId) return plan.financeChargeId;
if(plan.id) return "plan-" + plan.id;
return "";
}

function removeTreatmentPlanFinanceCharge(plan){
if(!patient || !plan) return;
let finance = getPatientFinance(patient);
let chargeId = getTreatmentPlanChargeId(plan);
finance.charges = (finance.charges || []).filter(c => {
if(chargeId && (c.id === chargeId || c.financeChargeId === chargeId)) return false;
if(plan.id && String(c.planId || "") === String(plan.id)) return false;
return true;
});
}

function syncTreatmentPlanFinance(plan){
if(!patient || !plan) return;
let finance = getPatientFinance(patient);
removeTreatmentPlanFinanceCharge(plan);
let amount = Math.abs(Number(plan.cost || 0));
let currency = getTreatmentPlanCurrency(plan);
if(amount <= 0){
plan.financeChargeId = "";
return;
}
let id = "plan-" + (plan.id || Date.now());
plan.financeChargeId = id;
let toothText = plan.tooth ? " - سن " + (typeof getPalmerLabel === "function" ? getPalmerLabel(plan.tooth) : plan.tooth) : "";
finance.charges.push({
id,
financeChargeId:id,
planId:plan.id,
date:nowDateTime(),
label:"خطة علاج: " + (plan.title || "") + toothText,
amount,
currency,
doctor:getActiveDoctor()
});
}

function addTreatmentPlan(){
if(!patient) return;
pushUndoSnapshot("إضافة خطة علاج");
let tooth = getFieldValue("planTooth").trim();
let title = getFieldValue("planTitle").trim();
let rawSteps = getFieldValue("planSteps");
let cost = Math.abs(Number(getFieldValue("planCost") || 0));
let currency = normalizeCurrency(getFieldValue("planCurrency") || "SYP");
let note = getFieldValue("planNote").trim();
if(!title){ alert("اكتب عنوان الخطة"); return; }
let steps = rawSteps.split("\n").map(x=>x.trim()).filter(Boolean).map(text=>({text, done:false}));
if(steps.length === 0) steps = [{text:"بدء العلاج", done:false}];
let plan = {
id:Date.now(),
tooth,
title,
steps,
cost,
currency,
note,
status:"active",
doctor:getActiveDoctor(),
createdAt:nowDateTime()
};
getTreatmentPlans(patient).push(plan);
syncTreatmentPlanFinance(plan);
auditPatientAction(patient,"إضافة خطة علاج",`${title}${tooth ? " - سن " + tooth : ""} - ${formatMoneyWithCurrency(cost,currency)}`);
saveAll();
openTreatmentPlanManager();
}

function editTreatmentPlan(index){
let plans = getTreatmentPlans(patient);
let plan = plans[index];
if(!plan || plan.status === "done") return;
let title = prompt("عنوان الخطة", plan.title || "");
if(title === null) return;
let cost = prompt("التكلفة", plan.cost || "");
if(cost === null) return;
let currency = prompt("العملة: اكتب SYP أو USD", getTreatmentPlanCurrency(plan));
if(currency === null) return;
let note = prompt("ملاحظات", plan.note || "");
if(note === null) return;
pushUndoSnapshot("تعديل خطة علاج");
plan.title = title;
plan.cost = Math.abs(Number(cost || 0));
plan.currency = normalizeCurrency(currency);
plan.note = note;
plan.updatedAt = nowDateTime();
plan.doctor = getActiveDoctor() || plan.doctor || "";
syncTreatmentPlanFinance(plan);
auditPatientAction(patient,"تعديل خطة علاج",`${title} - ${formatMoneyWithCurrency(plan.cost, plan.currency)}`);
saveAll();
openTreatmentPlanManager();
}

function deleteTreatmentPlan(index){
if(!patient) return;
let plans = getTreatmentPlans(patient);
let plan = plans[index];
if(!plan) return;
if(!confirm("حذف خطة العلاج؟ سيتم حذف التكلفة المالية المرتبطة بها فقط.")) return;
pushUndoSnapshot("حذف خطة علاج");
removeTreatmentPlanFinanceCharge(plan);
plans.splice(index,1);
auditPatientAction(patient,"حذف خطة علاج",`${plan.title || ""}${plan.tooth ? " - سن " + plan.tooth : ""}`);
saveAll();
openTreatmentPlanManager();
}

function applyTreatmentPlanToTooth(plan){
if(!patient || !plan || !plan.tooth) return;
if(plan.status !== "done") return;
patient.teeth = patient.teeth || {};
let tooth = String(plan.tooth);
let t = patient.teeth[tooth] || {states:[], note:""};
t.states = Array.isArray(t.states) ? t.states : [];
let title = (plan.title || "").trim();
let statesToAdd = [];
if(typeof TOOTH_STATE_OPTIONS !== "undefined"){
let direct = TOOTH_STATE_OPTIONS.find(x => x.label === title);
if(direct) statesToAdd.push(direct.value);
}
if(title.includes("حشو")) statesToAdd.push("filling");
if(title.includes("عصب") || title.includes("لبية")) statesToAdd.push("rootCanal");
if(title.includes("تاج") || title.includes("تتويج") || title.includes("زركون") || title.includes("فينير") || title.includes("خزف")) statesToAdd.push("crown");
if(title.includes("زرعة")) statesToAdd.push("implant");
if(title.includes("قلع") || title.includes("فراغ")) statesToAdd.push("extraction");
if(title.includes("جسر")) statesToAdd.push("bridge");
if(title.includes("وتد")) statesToAdd.push("fiberPost");
if(title.includes("لثوية") || title.includes("استشارة") || title.includes("تبييض")) statesToAdd.push("watch");
statesToAdd = [...new Set(statesToAdd.filter(Boolean))];
statesToAdd.forEach(state=>{ if(!t.states.includes(state)) t.states.push(state); });
let doctor = getActiveDoctor() || plan.doctorDone || plan.doctor || "";
let line = `خطة مكتملة: ${title}${doctor ? " - بواسطة: " + doctor : ""}`;
t.note = (t.note || "").trim() ? (t.note + "\n" + line) : line;
t.updatedAt = nowDateTime();
t.doctor = doctor;
patient.teeth[tooth] = t;
}

function markTreatmentPlanDone(index){
let plans = getTreatmentPlans(patient);
let plan = plans[index];
if(!plan) return;
let steps = safeArray(plan.steps);
let done = steps.filter(s=>s.done).length;
let percent = steps.length ? Math.round(done * 100 / steps.length) : 0;
if(percent < 100){ alert("لا يمكن إنهاء الخطة قبل وصولها إلى 100%"); return; }
if(plan.status === "done") return;
pushUndoSnapshot("إتمام خطة علاج");
plan.status = "done";
plan.doneAt = nowDateTime();
plan.doctorDone = getActiveDoctor();
applyTreatmentPlanToTooth(plan);
auditPatientAction(patient,"إتمام خطة علاج",`${plan.title || ""}${plan.tooth ? " - سن " + plan.tooth : ""}`);
saveAll();
openPatient(patient);
}

function getFinanceTotals(p){
let finance = getPatientFinance(p);
let totals = {SYP:{totalCharges:0,totalPayments:0,balance:0},USD:{totalCharges:0,totalPayments:0,balance:0}};
(finance.charges || []).forEach(x=>{ let c = normalizeCurrency(x.currency); totals[c].totalCharges += Math.abs(Number(x.amount || 0)); });
(finance.payments || []).forEach(x=>{ let c = normalizeCurrency(x.currency); totals[c].totalPayments += Math.abs(Number(x.amount || 0)); });
Object.keys(totals).forEach(c=>{ totals[c].balance = totals[c].totalCharges - totals[c].totalPayments; });
return totals;
}

function renderFinancialSummary(p){
let totals = getFinanceTotals(p);
return `
<div class="finance-summary multi-currency-summary safe-finance-summary">
<div><small>الإجمالي بالسوري</small><b>${formatMoneyWithCurrency(totals.SYP.totalCharges,"SYP")}</b></div>
<div><small>سلفة بالسوري</small><b>${formatMoneyWithCurrency(totals.SYP.totalPayments,"SYP")}</b></div>
<div class="${totals.SYP.balance > 0 ? "finance-due" : "finance-ok"}"><small>الباقي بالسوري</small><b>${formatMoneyWithCurrency(totals.SYP.balance,"SYP")}</b></div>
<div><small>الإجمالي بالدولار</small><b>${formatMoneyWithCurrency(totals.USD.totalCharges,"USD")}</b></div>
<div><small>سلفة بالدولار</small><b>${formatMoneyWithCurrency(totals.USD.totalPayments,"USD")}</b></div>
<div class="${totals.USD.balance > 0 ? "finance-due" : "finance-ok"}"><small>الباقي بالدولار</small><b>${formatMoneyWithCurrency(totals.USD.balance,"USD")}</b></div>
</div>
<button onclick="openFinanceManager()">💰 الكشف المالي</button>
`;
}

function renderTreatmentPlanSummary(p){
let plans = getTreatmentPlans(p);
if(plans.length === 0) return "<p>لا توجد خطة علاج بعد.</p>";
return `
<div class="treatment-plan-list v4-treatment-list">
${plans.map((plan,i)=>{
let steps = safeArray(plan.steps);
let done = steps.filter(s=>s.done).length;
let percent = steps.length ? Math.round(done * 100 / steps.length) : 0;
let isDone = plan.status === "done";
let displayPercent = isDone ? 100 : percent;
return `
<div class="treatment-plan-card ${isDone ? "completed-plan" : ""}">
<div class="plan-top"><b>🦷 ${escapeHtml(plan.tooth ? (typeof getPalmerLabel === "function" ? getPalmerLabel(plan.tooth) : plan.tooth) : "عام")} - ${escapeHtml(plan.title || "")}</b><span>${displayPercent}%</span></div>
<div class="plan-progress"><i style="width:${displayPercent}%"></i></div>
<p>${escapeHtml(plan.note || "")}</p>
<div class="plan-meta-line">
${plan.doctor ? `<small class="doctor-tag">بواسطة: ${escapeHtml(plan.doctor)}</small>` : ""}
<small>التكلفة: ${formatMoneyWithCurrency(Number(plan.cost || 0), getTreatmentPlanCurrency(plan))}</small>
<small>${isDone ? "الحالة: مكتملة ومطبقة على الخريطة" : "الحالة: قيد التنفيذ - لا تعدل الخريطة"}</small>
</div>
<div class="plan-steps">
${steps.map((s,si)=>`<label class="${s.done ? "done-step" : ""}"><input type="checkbox" ${s.done ? "checked" : ""} onchange="toggleTreatmentStep(${i},${si})" ${isDone ? "disabled" : ""}>${escapeHtml(s.text || "")}</label>`).join("")}
</div>
<button onclick="markTreatmentPlanDone(${i})" ${percent===100 && !isDone ? "" : "disabled"} class="done-plan-btn">${isDone ? "تم تطبيقها" : "تم"}</button>
<button onclick="editTreatmentPlan(${i})" ${isDone ? "disabled" : ""}>✏️ تعديل</button>
<button onclick="deleteTreatmentPlan(${i})">🗑 حذف</button>
</div>`;
}).join("")}
</div>`;
}

function getAppointmentsForDate(dateISO){
let target = normalizeAppointmentDate(dateISO);
return getAllAppointments()
.filter(x => normalizeAppointmentDate(x.appointment.date || "") === target && x.appointment.status !== "done")
.sort((a,b)=>normalizeAppointmentTime(a.appointment.time || "").localeCompare(normalizeAppointmentTime(b.appointment.time || "")));
}

function renderWeekRail(startISO){
let start = localDateFromISO(startISO || todayISO());
let days = [];
for(let i=0;i<21;i++) days.push(addDaysToDate(start,i));
return `
<div class="week-rail-wrap v4-week-rail">
<div class="week-rail-controls">
<button onclick="openAppointmentsManager('${toISODate(addDaysToDate(start,-7))}')">◀ أسبوع سابق</button>
<button onclick="openAppointmentsManager('${todayISO()}')">اليوم</button>
<button onclick="openAppointmentsManager('${toISODate(addDaysToDate(start,7))}')">أسبوع لاحق ▶</button>
</div>
<div class="week-rail">
${days.map((d,i)=>{
let iso = toISODate(d);
let list = getAppointmentsForDate(iso);
let isFriday = d.getDay() === 5;
return `<div class="week-day-card week-color-${Math.floor(i/7)%3} ${isFriday ? "closed-day" : ""}" onclick="openDaySchedule('${iso}')"><b>${arabicDayName(d)}</b><strong>${d.getDate()}</strong><small>${iso}</small><div class="day-count">${isFriday ? "مغلق" : list.length + " مواعيد"}</div><div class="day-names">${list.slice(0,3).map(x=>`<span>${escapeHtml(firstName(x.patient.name))}</span>`).join("")}</div></div>`;
}).join("")}
</div>
</div>`;
}

function openDaySchedule(dateISO){
let box = document.getElementById("dayScheduleBox");
if(!box) return;
let cleanDate = normalizeAppointmentDate(dateISO);
let d = localDateFromISO(cleanDate);
let isFriday = d.getDay() === 5;
let list = getAppointmentsForDate(cleanDate);
let used = {};
list.forEach(x=>{ used[normalizeAppointmentTime(x.appointment.time || "")] = x; });
let slots = getClinicWorkingSlots();
box.innerHTML = `
<div class="day-wheel-card v4-day-wheel">
<h3>${arabicDayName(d)} - ${cleanDate}</h3>
${isFriday ? `<div class="closed-note">العيادة مغلقة يوم الجمعة</div>` : ""}
<div class="time-wheel">
${slots.map(time=>{
let key = normalizeAppointmentTime(time);
let ap = used[key];
return `<button type="button" class="time-slot ${ap ? "busy-slot booked-time-slot" : "free-slot"}" onclick="openAppointmentSlotModal('${cleanDate}','${key}')"><b>${formatTime12(key)}</b><span>${ap ? escapeHtml(firstName(ap.patient.name)) + " - " + escapeHtml(ap.appointment.type || ap.appointment.note || "موعد") : "متاح"}</span></button>`;
}).join("")}
</div>
</div>`;
}

function saveAppointmentSlot(dateISO,time){
let fileNo = getFieldValue("slotPatientFileNo");
if(!fileNo){ alert("اختر المريض"); return; }
let p = findPatientByFileNo(fileNo);
if(!p){ alert("لم يتم العثور على المريض"); return; }
let cleanDate = normalizeAppointmentDate(dateISO);
let cleanTime = normalizeAppointmentTime(time);
let type = getFieldValue("slotType").trim();
let note = getFieldValue("slotNote").trim();
let conflict = getAppointmentsForDate(cleanDate).find(x => normalizeAppointmentTime(x.appointment.time) === cleanTime && (x.patient.fileNo || "") !== fileNo);
if(conflict){ alert("هذه الساعة محجوزة لمريض آخر"); return; }
pushUndoSnapshot("حفظ موعد");
ensureAdvancedPatientData(p);
let existingIndex = (p.appointments || []).findIndex(a => normalizeAppointmentDate(a.date) === cleanDate && normalizeAppointmentTime(a.time) === cleanTime && a.status !== "done");
let item = {date:cleanDate,time:cleanTime,type,note,status:"pending",updatedAt:nowDateTime(),doctor:getActiveDoctor()};
if(existingIndex >= 0){ p.appointments[existingIndex] = {...p.appointments[existingIndex], ...item}; }
else{ item.createdAt = nowDateTime(); p.appointments.push(item); }
auditPatientAction(p,"حفظ موعد",`${cleanDate} - ${formatTime12(cleanTime)}${type ? " - " + type : ""}`);
let patients = getPatients().map(x => (x.fileNo || "") === (p.fileNo || "") ? p : x);
savePatients(patients);
patient = p;
closeAppointmentSlotModal();
openAppointmentsManager(cleanDate);
}

function deleteAppointment(fileNo,index){
if(!confirm("حذف الموعد؟")) return;
pushUndoSnapshot("حذف موعد");
let patients = getPatients();
let p = patients.find(x => (x.fileNo || "") === fileNo);
if(!p || !p.appointments) return;
let ap = p.appointments[index];
p.appointments.splice(index,1);
auditPatientAction(p,"حذف موعد",ap ? `${ap.date || ""} - ${formatTime12(ap.time || "")}` : "");
savePatients(patients);
if(patient && patient.fileNo === fileNo) patient = p;
openAppointmentsManager();
}

function markAppointmentDone(fileNo,index){
pushUndoSnapshot("إنهاء موعد");
let patients = getPatients();
let p = patients.find(x => (x.fileNo || "") === fileNo);
if(!p || !p.appointments || !p.appointments[index]) return;
p.appointments[index].status = "done";
p.appointments[index].doneAt = nowDateTime();
p.appointments[index].doctorDone = getActiveDoctor();
auditPatientAction(p,"إنهاء موعد",`${p.appointments[index].date || ""} - ${formatTime12(p.appointments[index].time || "")}`);
savePatients(patients);
if(patient && patient.fileNo === fileNo) patient = p;
openAppointmentsManager();
}

function renderAuditSectionForPatient(p){
return `<hr><h3>سجل التعديلات</h3>${renderAuditLog(p)}<button onclick="undoLastAction()">↩️ تراجع عن آخر إجراء</button>`;
}

/* patch openPatient to append audit panel safely */
const clinicV4OriginalOpenPatient = openPatient;
openPatient = function(p){
clinicV4OriginalOpenPatient(p);
let main = document.querySelector(".patient-main-card");
if(main && patient){
let holder = document.createElement("div");
holder.className = "audit-section-wrap";
holder.innerHTML = renderAuditSectionForPatient(patient);
main.appendChild(holder);
}
};

console.log("Clinic EMR v4 loaded", CLINIC_V4_VERSION);


/* =========================================================
   CLINIC EMR v5
   - Smart backup center with last 5 auto backups
   - Financial reports: day/month/all-time by currency
   - Global audit report
   - Safer savePatients wrapper
========================================================= */

const CLINIC_V5_VERSION = "5.0.0";
const CLINIC_V5_BACKUPS_KEY = "clinicAutoBackupsV5";
let clinicV5BackupLock = false;
try{ const __oldBackups=JSON.parse(localStorage.getItem(CLINIC_V5_BACKUPS_KEY)||"[]"); if(Array.isArray(__oldBackups)&&__oldBackups.length>1) localStorage.setItem(CLINIC_V5_BACKUPS_KEY,JSON.stringify(__oldBackups.slice(0,1))); }catch(e){}

function clinicV5SafeJson(data){
try{return JSON.parse(JSON.stringify(data));}catch(e){return data;}
}

function clinicV5GetBackups(){
try{
let arr = JSON.parse(localStorage.getItem(CLINIC_V5_BACKUPS_KEY) || "[]");
return Array.isArray(arr) ? arr : [];
}catch(e){return [];}
}

function clinicV5SaveBackups(arr){
try{
localStorage.setItem(CLINIC_V5_BACKUPS_KEY, JSON.stringify((arr || []).slice(0,1)));
}catch(e){
console.warn("v5 backup quota warning", e);
try{
localStorage.setItem(CLINIC_V5_BACKUPS_KEY, JSON.stringify((arr || []).slice(0,1)));
}catch(err){console.warn("v5 backup failed", err);}
}
}

function clinicV5StoreBackup(patientsData, reason="حفظ تلقائي"){
if(clinicV5BackupLock) return;
try{
clinicV5BackupLock = true;
let patientsCopy = clinicV5SafeJson(Array.isArray(patientsData) ? patientsData : getPatients());
let backups = clinicV5GetBackups();
let payloadText = JSON.stringify(patientsCopy || []);
let lastText = backups[0] ? JSON.stringify(backups[0].patients || []) : "";
if(payloadText === lastText){ clinicV5BackupLock = false; return; }
backups.unshift({
id:"BKP-" + Date.now(),
version:CLINIC_V5_VERSION,
reason,
createdAt:nowDateTime(),
patients:patientsCopy,
clinicOperations:(typeof getClinicOperations === "function" ? clinicV5SafeJson(getClinicOperations()) : [])
});
clinicV5SaveBackups(backups);
}catch(e){console.warn("v5 auto backup failed", e);}
finally{clinicV5BackupLock = false;}
}

if(typeof savePatients === "function" && !window.__clinicV5SavePatientsWrapped){
window.__clinicV5SavePatientsWrapped = true;
const clinicV5OriginalSavePatients = savePatients;
savePatients = function(list){
clinicV5OriginalSavePatients(list);
try{
let backups = clinicV5GetBackups();
let lastTime = backups[0] && backups[0].createdAt ? new Date(backups[0].createdAt).getTime() : 0;
let nowTime = Date.now();
let twelveHours = 12 * 60 * 60 * 1000;
if(!lastTime || (nowTime - lastTime) >= twelveHours){
clinicV5StoreBackup(list,"حفظ تلقائي كل 12 ساعة");
}
}catch(e){console.warn("12h backup check failed", e);}
};
}

function clinicV5ExportCurrentBackup(){
let data = {
version:CLINIC_V5_VERSION,
exportedAt:nowDateTime(),
patients:getPatients(),
clinicOperations:(typeof getClinicOperations === "function" ? getClinicOperations() : [])
};
let blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
let url = URL.createObjectURL(blob);
let a = document.createElement("a");
a.href = url;
a.download = "dental-chain-backup.json";
a.click();
URL.revokeObjectURL(url);
}

function clinicV5RestoreBackup(id){
let backups = clinicV5GetBackups();
let b = backups.find(x=>x.id === id);
if(!b){ alert("لم يتم العثور على النسخة"); return; }
if(!confirm("استرجاع هذه النسخة؟ سيتم استبدال بيانات المرضى الحالية.")) return;
pushUndoSnapshot?.("استرجاع نسخة احتياطية");
savePatients((b.patients || []).map(p=>ensurePatientFileNo(p)));
if(typeof saveClinicOperations === "function" && Array.isArray(b.clinicOperations)) saveClinicOperations(b.clinicOperations);
patient = null;
alert("تم استرجاع النسخة الاحتياطية");
backToHome();
}

function clinicV5DeleteBackup(id){
let backups = clinicV5GetBackups().filter(x=>x.id !== id);
clinicV5SaveBackups(backups);
openClinicV5BackupCenter();
}

function openClinicV5BackupCenter(){
let backups = clinicV5GetBackups();
let output = document.getElementById("output");
if(!output) return;
output.innerHTML = `
<div class="card clinic-v5-page">
<h2>💾 مركز النسخ الاحتياطي</h2>
<p class="clinic-v5-note">يحفظ البرنامج تلقائياً آخر 5 نسخ من البيانات، بحد أقصى نسخة تلقائية كل 12 ساعة.</p>
<div class="clinic-v5-toolbar">
<button onclick="clinicV5ExportCurrentBackup()">📦 تصدير نسخة الآن</button>
<button onclick="clinicV5StoreBackup(getPatients(),'نسخة يدوية'); openClinicV5BackupCenter();">💾 حفظ نسخة محلية الآن</button>
<button onclick="backToHome()">رجوع</button>
</div>
<div class="clinic-v5-backup-list">
${backups.map(b=>`
<div class="clinic-v5-backup-row">
<div>
<b>${escapeHtml(b.reason || "نسخة")}</b>
<small>${escapeHtml(b.createdAt || "")}</small>
<p>${(b.patients || []).length} مريض</p>
</div>
<div>
<button onclick="clinicV5RestoreBackup('${b.id}')">استرجاع</button>
<button class="danger-btn" onclick="clinicV5DeleteBackup('${b.id}')">حذف</button>
</div>
</div>
`).join("") || "<p>لا توجد نسخ محفوظة بعد.</p>"}
</div>
</div>`;
let backBtn = document.getElementById("backBtn");
if(backBtn) backBtn.style.display = "block";
}

function clinicV5DatePart(value){
let v = String(value || "").trim();
let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
if(m) return `${m[1]}-${m[2]}-${m[3]}`;
let d = new Date(v);
if(!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
return "";
}

function clinicV5CurrentMonthPrefix(){
let d = new Date();
return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function clinicV5EmptyMoneyStats(){
return {
SYP:{charges:0,payments:0,balance:0},
USD:{charges:0,payments:0,balance:0}
};
}

function clinicV5AddMoney(target, kind, amount, currency){
let c = typeof normalizeCurrency === "function" ? normalizeCurrency(currency) : (String(currency||"SYP").toUpperCase()==="USD"?"USD":"SYP");
target[c][kind] += Math.abs(Number(amount || 0));
}

function clinicV5FinalizeMoneyStats(stats){
["SYP","USD"].forEach(c=>stats[c].balance = stats[c].charges - stats[c].payments);
return stats;
}

function clinicV5FinanceStats(scope="all"){
let today = todayISO?.() || clinicV5DatePart(nowDateTime());
let month = clinicV5CurrentMonthPrefix();
let stats = clinicV5EmptyMoneyStats();
getPatients().forEach(p=>{
let finance = getPatientFinance(p);
(finance.charges || []).forEach(x=>{
let d = clinicV5DatePart(x.date || x.createdAt || "");
if(scope === "today" && d !== today) return;
if(scope === "month" && !d.startsWith(month)) return;
clinicV5AddMoney(stats,"charges",x.amount,x.currency);
});
(finance.payments || []).forEach(x=>{
let d = clinicV5DatePart(x.date || x.createdAt || "");
if(scope === "today" && d !== today) return;
if(scope === "month" && !d.startsWith(month)) return;
clinicV5AddMoney(stats,"payments",x.amount,x.currency);
});
});
return clinicV5FinalizeMoneyStats(stats);
}

function clinicV5MoneyCard(title,stats){
return `
<div class="clinic-v5-report-card">
<h3>${title}</h3>
<div class="clinic-v5-report-grid">
<div><small>تكاليف سوري</small><b>${formatMoneyWithCurrency(stats.SYP.charges,"SYP")}</b></div>
<div><small>سلفة سوري</small><b>${formatMoneyWithCurrency(stats.SYP.payments,"SYP")}</b></div>
<div class="${stats.SYP.balance>0?'finance-due':'finance-ok'}"><small>باقي سوري</small><b>${formatMoneyWithCurrency(stats.SYP.balance,"SYP")}</b></div>
<div><small>تكاليف دولار</small><b>${formatMoneyWithCurrency(stats.USD.charges,"USD")}</b></div>
<div><small>سلفة دولار</small><b>${formatMoneyWithCurrency(stats.USD.payments,"USD")}</b></div>
<div class="${stats.USD.balance>0?'finance-due':'finance-ok'}"><small>باقي دولار</small><b>${formatMoneyWithCurrency(stats.USD.balance,"USD")}</b></div>
</div>
</div>`;
}

function openClinicV5Reports(){
let todayStats = clinicV5FinanceStats("today");
let monthStats = clinicV5FinanceStats("month");
let allStats = clinicV5FinanceStats("all");
let output = document.getElementById("output");
if(!output) return;
output.innerHTML = `
<div class="card clinic-v5-page">
<h2>📊 تقارير العيادة</h2>
<div class="clinic-v5-toolbar">
<button onclick="openClinicV5BackupCenter()">💾 النسخ الاحتياطي</button>
<button onclick="openClinicV5AuditReport()">🧾 سجل العمليات</button>
<button onclick="openDoctorReports()">👨‍⚕️ تقرير الأطباء</button>
<button onclick="backToHome()">رجوع</button>
</div>
<div class="clinic-v5-reports">
${clinicV5MoneyCard("تقرير اليوم",todayStats)}
${clinicV5MoneyCard("تقرير الشهر",monthStats)}
${clinicV5MoneyCard("من اليوم الأول للبرنامج",allStats)}
</div>
</div>`;
let backBtn = document.getElementById("backBtn");
if(backBtn) backBtn.style.display = "block";
}

function openClinicV5AuditReport(){
let rows = [];
getPatients().forEach(p=>{
(Array.isArray(p.auditLog) ? p.auditLog : []).forEach(a=>rows.push({patient:p,a}));
});
rows = rows.reverse().slice(0,150);
let output = document.getElementById("output");
if(!output) return;
output.innerHTML = `
<div class="card clinic-v5-page">
<h2>🧾 سجل عمليات العيادة</h2>
<div class="clinic-v5-toolbar">
<button onclick="openClinicV5Reports()">📊 التقارير</button>
<button onclick="backToHome()">رجوع</button>
</div>
<div class="audit-log-list clinic-v5-global-audit">
${rows.map(r=>`
<div class="audit-log-item">
<b>${escapeHtml(r.a.action || "")}</b>
<small>${escapeHtml(r.a.time || "")} - ${escapeHtml(r.patient.name || "")} ${r.a.doctor ? " - " + escapeHtml(r.a.doctor) : ""}</small>
${r.a.details ? `<p>${escapeHtml(r.a.details)}</p>` : ""}
</div>
`).join("") || "<p>لا يوجد سجل عمليات بعد.</p>"}
</div>
</div>`;
}

function clinicV5AppendDashboardButtons(){
  const quick=document.querySelector(".quick-actions");
  if(!quick) return;

  quick.querySelectorAll(
    ".clinic-v5-reports-btn,.clinic-v5-backup-btn,.dcos-doctor-report-btn,.dcos-data-manager-btn"
  ).forEach(el=>el.remove());

  const role=dcosRoleNow();
  if(role==='reception') return;

  if(role==='doctor'){
    quick.insertAdjacentHTML("beforeend",
      `<button class="clinic-v5-reports-btn" onclick="openClinicV5Reports()">📊 التقارير</button>
       <button class="clinic-v5-backup-btn" onclick="openClinicV5BackupCenter()">💾 النسخ الاحتياطي</button>`);
    return;
  }

  if(role==='assistant'){
    quick.insertAdjacentHTML("beforeend",
      `<button class="clinic-v5-backup-btn" onclick="openClinicV5BackupCenter()">💾 النسخ الاحتياطي</button>`);
    return;
  }

  if(dcosIsClinicAdmin()){
    quick.insertAdjacentHTML("beforeend",
      `<button class="clinic-v5-reports-btn" onclick="openClinicV5Reports()">📊 التقارير</button>
       <button class="clinic-v5-backup-btn" onclick="openClinicV5BackupCenter()">💾 النسخ الاحتياطي</button>
       <button class="dcos-doctor-report-btn" onclick="openDoctorReports()">👨‍⚕️ تقرير الأطباء</button>
       <button class="dcos-data-manager-btn" onclick="openDataManager()">🧰 Data Manager</button>`);
  }
}

if(typeof renderDashboard === "function" && !window.__clinicV5RenderDashboardWrapped){
window.__clinicV5RenderDashboardWrapped = true;
const clinicV5OriginalRenderDashboard = renderDashboard;
renderDashboard = function(){
clinicV5OriginalRenderDashboard();
clinicV5AppendDashboardButtons();
};
}

function clinicV5AppendPatientQuickTools(){
  const main=document.querySelector(".patient-main-card");
  if(!main || !patient) return;
  main.querySelectorAll(".clinic-v5-patient-tools").forEach(el=>el.remove());

  const role=dcosRoleNow();
  if(role==='assistant'||role==='reception') return;

  const holder=document.createElement("div");
  holder.className="clinic-v5-patient-tools";
  holder.innerHTML=dcosIsClinicAdmin()
    ? `<hr><h3>أدوات العيادة</h3>
       <button onclick="openClinicV5Reports()">📊 التقارير المالية</button>
       <button onclick="openClinicV5AuditReport()">🧾 سجل العيادة</button>
       <button onclick="openClinicV5BackupCenter()">💾 النسخ الاحتياطي</button>`
    : `<hr><h3>أدوات الطبيب</h3>
       <button onclick="openClinicV5Reports()">📊 التقارير</button>
       <button onclick="openClinicV5BackupCenter()">💾 النسخ الاحتياطي</button>`;
  main.appendChild(holder);
}

if(typeof openPatient === "function" && !window.__clinicV5OpenPatientWrapped){
window.__clinicV5OpenPatientWrapped = true;
const clinicV5OriginalOpenPatient = openPatient;
openPatient = function(p){
clinicV5OriginalOpenPatient(p);
clinicV5AppendPatientQuickTools();
};
}

function clinicV5Init(){
clinicV5StoreBackup(getPatients(),"نسخة بداية النظام");
console.log("Clinic system loaded", CLINIC_V5_VERSION);
}

setTimeout(clinicV5Init, 300);

/* =========================================================
   CLINIC EMR v6
   - Manual Google Drive-ready sync file (export/import/merge)
   - Safer appointment conflict detection by doctor/patient/time
   - Week appointments UX helpers
   - Non-destructive data merge for multi-device usage
========================================================= */

const CLINIC_V6_VERSION = "6.0.0";
const CLINIC_V6_DEVICE_KEY = "clinicDeviceIdV6";

function clinicV6DeviceId(){
let id = localStorage.getItem(CLINIC_V6_DEVICE_KEY);
if(!id){
id = "DEV-" + Date.now() + "-" + Math.random().toString(36).slice(2,8);
localStorage.setItem(CLINIC_V6_DEVICE_KEY, id);
}
return id;
}

function clinicV6Clone(data){
try{return JSON.parse(JSON.stringify(data));}catch(e){return data;}
}

function clinicV6TouchPatient(p, reason="تعديل"){
if(!p) return p;
p.syncMeta = p.syncMeta || {};
p.syncMeta.updatedAt = new Date().toISOString();
p.syncMeta.updatedBy = clinicV6DeviceId();
p.syncMeta.reason = reason;
return p;
}

function clinicV6TouchPatients(list, reason="حفظ"){
return (Array.isArray(list) ? list : []).map(p => clinicV6TouchPatient(p, reason));
}

/* stamp saved data so merge can compare versions later */
if(typeof savePatients === "function" && !window.__clinicV6SavePatientsWrapped){
window.__clinicV6SavePatientsWrapped = true;
const clinicV6OriginalSavePatients = savePatients;
savePatients = function(list){
let stamped = clinicV6TouchPatients(list, "savePatients");
clinicV6OriginalSavePatients(stamped);
};
}

function clinicV6MakeSyncPayload(){
return {
version:CLINIC_V6_VERSION,
type:"clinic-emr-sync",
deviceId:clinicV6DeviceId(),
exportedAt:new Date().toISOString(),
patients:clinicV6Clone(getPatients()),
clinicOperations:(typeof getClinicOperations === "function" ? clinicV6Clone(getClinicOperations()) : {expenses:[]})
};
}

function clinicV6DownloadJson(filename, data){
let blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
let url = URL.createObjectURL(blob);
let a = document.createElement("a");
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
}

function clinicV6ExportSyncFile(){
let payload = clinicV6MakeSyncPayload();
clinicV6DownloadJson("clinic-emr-v6-sync.json", payload);
clinicV6StoreSyncStatus("تم تصدير ملف المزامنة. ارفعه إلى Google Drive أو احفظه في مجلد العيادة.");
}

function clinicV6TriggerSyncImport(){
let input = document.getElementById("clinicV6SyncInput");
if(!input){
input = document.createElement("input");
input.type = "file";
input.accept = "application/json";
input.id = "clinicV6SyncInput";
input.style.display = "none";
input.onchange = clinicV6HandleSyncImport;
document.body.appendChild(input);
}
input.click();
}

function clinicV6HandleSyncImport(event){
let file = event.target.files && event.target.files[0];
if(!file) return;
let reader = new FileReader();
reader.onload = function(e){
try{
let data = JSON.parse(e.target.result);
clinicV6ImportSyncPayload(data);
event.target.value = "";
}catch(err){
alert("ملف المزامنة غير صحيح");
console.error(err);
}
};
reader.readAsText(file);
}

function clinicV6StableId(item, fallbackPrefix="item"){
if(!item) return fallbackPrefix + "-" + Math.random().toString(36).slice(2);
return String(item.id || item.planId || item.chargeId || item.createdAt || item.date + "|" + item.time + "|" + item.title + "|" + item.amount || fallbackPrefix + "-" + JSON.stringify(item).slice(0,120));
}

function clinicV6MergeArrayById(localArr, remoteArr, prefix){
let map = new Map();
(localArr || []).forEach(x => map.set(clinicV6StableId(x,prefix), clinicV6Clone(x)));
(remoteArr || []).forEach(x => {
let id = clinicV6StableId(x,prefix);
let old = map.get(id);
if(!old){ map.set(id, clinicV6Clone(x)); return; }
let oldTime = Date.parse(old.updatedAt || old.doneAt || old.createdAt || old.date || 0) || 0;
let newTime = Date.parse(x.updatedAt || x.doneAt || x.createdAt || x.date || 0) || 0;
map.set(id, newTime >= oldTime ? clinicV6Clone(x) : old);
});
return Array.from(map.values());
}

function clinicV6MergeFinance(localFinance, remoteFinance){
let lf = localFinance || {charges:[], payments:[], installments:[]};
let rf = remoteFinance || {charges:[], payments:[], installments:[]};
return {
charges:clinicV6MergeArrayById(lf.charges || [], rf.charges || [], "charge"),
payments:clinicV6MergeArrayById(lf.payments || [], rf.payments || [], "payment"),
installments:clinicV6MergeArrayById(lf.installments || [], rf.installments || [], "installment")
};
}

function clinicV6MergeTeeth(localTeeth, remoteTeeth){
let merged = {...(localTeeth || {})};
Object.keys(remoteTeeth || {}).forEach(k=>{
let lt = merged[k] || {};
let rt = remoteTeeth[k] || {};
let ltTime = Date.parse(lt.updatedAt || 0) || 0;
let rtTime = Date.parse(rt.updatedAt || 0) || 0;
if(!merged[k] || rtTime >= ltTime){
merged[k] = clinicV6Clone(rt);
}else{
merged[k] = {
...lt,
states:[...new Set([...(lt.states || []), ...(rt.states || [])])],
note:[lt.note || "", rt.note || ""].filter(Boolean).join("\n")
};
}
});
return merged;
}

function clinicV6MergePatient(localP, remoteP){
if(!localP) return clinicV6TouchPatient(clinicV6Clone(remoteP), "sync-import");
if(!remoteP) return localP;

let localTime = Date.parse(localP.syncMeta?.updatedAt || localP.updatedAt || 0) || 0;
let remoteTime = Date.parse(remoteP.syncMeta?.updatedAt || remoteP.updatedAt || 0) || 0;
let base = remoteTime > localTime ? {...localP, ...remoteP} : {...remoteP, ...localP};

base.fileNo = localP.fileNo || remoteP.fileNo;
base.name = base.name || localP.name || remoteP.name;
base.visits = clinicV6MergeArrayById(localP.visits || [], remoteP.visits || [], "visit");
base.prescriptions = clinicV6MergeArrayById(localP.prescriptions || [], remoteP.prescriptions || [], "rx");
base.appointments = clinicV6MergeArrayById(localP.appointments || [], remoteP.appointments || [], "appt");
base.treatmentPlans = clinicV6MergeArrayById(localP.treatmentPlans || [], remoteP.treatmentPlans || [], "plan");
base.finance = clinicV6MergeFinance(localP.finance, remoteP.finance);
base.teeth = clinicV6MergeTeeth(localP.teeth, remoteP.teeth);
base.auditLog = clinicV6MergeArrayById(localP.auditLog || [], remoteP.auditLog || [], "audit").slice(-500);
base.media = base.media || localP.media || remoteP.media || {xrays:[], photos:[]};
return clinicV6TouchPatient(base, "sync-merge");
}

function clinicV6ImportSyncPayload(data){
if(!data || (!Array.isArray(data.patients) && data.type !== "clinic-emr-sync")){
alert("هذا الملف لا يبدو ملف مزامنة للعيادة");
return;
}
let remotePatients = Array.isArray(data) ? data : (data.patients || []);
if(!Array.isArray(remotePatients)){ alert("ملف المزامنة لا يحتوي مرضى"); return; }

if(!confirm("دمج بيانات ملف المزامنة مع البيانات الحالية؟ سيتم إنشاء نسخة احتياطية قبل الدمج.")) return;

try{ clinicV5StoreBackup?.(getPatients(),"قبل المزامنة القديمة"); }catch(e){}
pushUndoSnapshot?.("استيراد المزامنة القديمة");

let localPatients = getPatients();
let map = new Map();

localPatients.forEach(p=>{
ensurePatientFileNo(p);
map.set(p.fileNo || p.name, clinicV6Clone(p));
});

remotePatients.forEach(r=>{
ensurePatientFileNo(r);
let key = r.fileNo || r.name;
let local = map.get(key);
map.set(key, clinicV6MergePatient(local, r));
});

let merged = Array.from(map.values()).map(p=>ensurePatientFileNo(p));

savePatients(merged);

if(typeof saveClinicOperations === "function" && data.clinicOperations){
let localOps = typeof getClinicOperations === "function" ? getClinicOperations() : {expenses:[]};
let mergedOps = {
...localOps,
...data.clinicOperations,
expenses:clinicV6MergeArrayById(localOps.expenses || [], data.clinicOperations.expenses || [], "expense")
};
saveClinicOperations(mergedOps);
}

patient = null;
clinicV6StoreSyncStatus("تم دمج ملف المزامنة بنجاح. عدد المرضى بعد الدمج: " + merged.length);
backToHome();
}

function clinicV6StoreSyncStatus(msg){
localStorage.setItem("clinicV6LastSyncStatus", JSON.stringify({msg,time:nowDateTime()}));
}

function clinicV6LastSyncStatus(){
try{return JSON.parse(localStorage.getItem("clinicV6LastSyncStatus") || "null");}catch(e){return null;}
}

function openClinicV6SyncCenter(){
let status = clinicV6LastSyncStatus();
let output = document.getElementById("output");
if(!output) return;
output.innerHTML = `
<div class="card clinic-v6-page">
<h2>🔄 المزامنة القديمة</h2>
<p class="clinic-v6-note">
هذه مزامنة آمنة للعمل على أكثر من جهاز: صدّر الملف وضعه في Google Drive، ومن الجهاز الآخر نزّل الملف واستورده للدمج.
</p>

<div class="clinic-v6-sync-grid">
<div class="clinic-v6-sync-card">
<h3>1) رفع إلى Google Drive</h3>
<p>اضغط تصدير، ثم ارفع الملف الناتج إلى حساب Google Drive الخاص بالعيادة.</p>
<button onclick="clinicV6ExportSyncFile()">📤 تصدير ملف مزامنة</button>
</div>

<div class="clinic-v6-sync-card">
<h3>2) تنزيل ودمج من جهاز آخر</h3>
<p>نزّل ملف المزامنة من Google Drive ثم استورده هنا. الدمج لا يستبدل كل شيء عشوائياً.</p>
<button onclick="clinicV6TriggerSyncImport()">📥 استيراد ودمج ملف مزامنة</button>
</div>
</div>

<div class="clinic-v6-status">
<b>الجهاز:</b> ${escapeHtml(clinicV6DeviceId())}<br>
<b>آخر حالة:</b> ${status ? escapeHtml(status.msg) + " - " + escapeHtml(status.time || "") : "لا توجد مزامنة بعد"}
</div>

<div class="clinic-v6-toolbar">
<button onclick="openAppointmentsManager()">📅 المواعيد</button>
<button onclick="openClinicV5BackupCenter()">💾 النسخ الاحتياطي</button>
<button onclick="backToHome()">رجوع</button>
</div>
</div>`;
let backBtn = document.getElementById("backBtn");
if(backBtn) backBtn.style.display = "block";
}

/* Appointment conflict engine */
function clinicV6AppointmentDoctor(ap){
return (ap && (ap.doctor || ap.doctorDone || ap.activeDoctor)) || getActiveDoctor() || "";
}

function clinicV6TimeToMinutes(t){
let clean = normalizeAppointmentTime(t);
let m = clean.match(/^(\d{2}):(\d{2})$/);
if(!m) return null;
return Number(m[1])*60 + Number(m[2]);
}

function clinicV6AppointmentDuration(ap){
let n = Number(ap && (ap.duration || ap.durationMinutes || ap.minutes));
return (!isNaN(n) && n > 0) ? n : 60;
}

function clinicV6Overlap(startA,durA,startB,durB){
return startA < startB + durB && startB < startA + durA;
}

function clinicV6FindAppointmentConflict(dateISO,time,fileNo,doctor,duration=60,ignoreSamePatientSameSlot=false){
let cleanDate = normalizeAppointmentDate(dateISO);
let start = clinicV6TimeToMinutes(time);
if(start === null) return null;
let targetDoctor = doctor || getActiveDoctor() || "";
let list = getAppointmentsForDate(cleanDate);
return list.find(x=>{
let ap = x.appointment || {};
let apStart = clinicV6TimeToMinutes(ap.time);
let apDuration = clinicV6AppointmentDuration(ap);
let samePatient = (x.patient.fileNo || "") === (fileNo || "");
let sameDoctor = (clinicV6AppointmentDoctor(ap) || "") === (targetDoctor || "");
if(apStart === null) return false;
if(ignoreSamePatientSameSlot && samePatient && apStart === start) return false;
if(!clinicV6Overlap(start,duration,apStart,apDuration)) return false;
return samePatient || sameDoctor || (apStart === start);
}) || null;
}

function clinicV6RenderConflictMessage(conflict){
if(!conflict) return "";
let ap = conflict.appointment || {};
return `يوجد تعارض مع موعد: ${conflict.patient.name || ""} - ${formatTime12(ap.time || "")} - ${ap.type || ap.note || "موعد"}`;
}

/* Override manager save with doctor/patient conflict protection */
if(typeof addAppointmentFromManager === "function"){
addAppointmentFromManager = function(){
if(!patient){
alert("افتح ملف مريض أولاً أو اختر ساعة من جدول اليوم ثم اختر المريض");
return;
}
ensureAdvancedPatientData(patient);

let date = normalizeAppointmentDate(getFieldValue("apptDate"));
let time = normalizeAppointmentTime(getFieldValue("apptTime") || getFieldValue("apptTimeDisplay"));
let type = getFieldValue("apptType").trim();
let note = getFieldValue("apptNote").trim();

if(!date){ alert("حدد تاريخ الموعد"); return; }
if(!time){ alert("حدد ساعة الموعد من جدول اليوم"); return; }

let d = localDateFromISO(date);
if(d.getDay() === 5){ alert("العيادة مغلقة يوم الجمعة"); return; }

let duration = 60;
let conflict = clinicV6FindAppointmentConflict(date,time,patient.fileNo,getActiveDoctor(),duration,true);
if(conflict){
alert(clinicV6RenderConflictMessage(conflict));
return;
}

pushUndoSnapshot?.("حفظ موعد v6");

patient.appointments.push({
id:"APT-" + Date.now(),
date,
time,
type,
note,
duration,
doctor:getActiveDoctor(),
status:"pending",
createdAt:nowDateTime(),
updatedAt:nowDateTime()
});

auditPatientAction?.(patient,"إضافة موعد",`${date} - ${formatTime12(time)}${type ? " - " + type : ""}`);
saveAll();
alert("تم حفظ الموعد");
openAppointmentsManager(date);
};
}

/* Override slot modal save with doctor/patient conflict protection */
if(typeof saveAppointmentSlot === "function"){
saveAppointmentSlot = function(dateISO,time){
let fileNo = getFieldValue("slotPatientFileNo");
if(!fileNo){ alert("اختر المريض"); return; }
let p = findPatientByFileNo(fileNo);
if(!p){ alert("لم يتم العثور على المريض"); return; }
let cleanDate = normalizeAppointmentDate(dateISO);
let cleanTime = normalizeAppointmentTime(time);
let type = getFieldValue("slotType").trim();
let note = getFieldValue("slotNote").trim();
let duration = Number(getFieldValue("slotDuration") || 60);
if(!duration || duration < 15) duration = 60;

let d = localDateFromISO(cleanDate);
if(d.getDay() === 5){ alert("العيادة مغلقة يوم الجمعة"); return; }

let conflict = clinicV6FindAppointmentConflict(cleanDate,cleanTime,fileNo,getActiveDoctor(),duration,true);
if(conflict){
alert(clinicV6RenderConflictMessage(conflict));
return;
}

pushUndoSnapshot?.("حفظ موعد v6");
ensureAdvancedPatientData(p);
let existingIndex = (p.appointments || []).findIndex(a => normalizeAppointmentDate(a.date) === cleanDate && normalizeAppointmentTime(a.time) === cleanTime && a.status !== "done");
let item = {
id:(existingIndex >= 0 && p.appointments[existingIndex].id) ? p.appointments[existingIndex].id : "APT-" + Date.now(),
date:cleanDate,
time:cleanTime,
type,
note,
duration,
status:"pending",
updatedAt:nowDateTime(),
doctor:getActiveDoctor()
};
if(existingIndex >= 0){ p.appointments[existingIndex] = {...p.appointments[existingIndex], ...item}; }
else{ item.createdAt = nowDateTime(); p.appointments.push(item); }
auditPatientAction?.(p,"حفظ موعد",`${cleanDate} - ${formatTime12(cleanTime)}${type ? " - " + type : ""}`);
let patients = getPatients().map(x => (x.fileNo || "") === (p.fileNo || "") ? clinicV6TouchPatient(p,"appointment-save") : x);
savePatients(patients);
patient = p;
closeAppointmentSlotModal();
openAppointmentsManager(cleanDate);
};
}

/* Improve slot modal: add duration field when modal opens */
if(typeof openAppointmentSlotModal === "function" && !window.__clinicV6SlotModalWrapped){
window.__clinicV6SlotModalWrapped = true;
const clinicV6OriginalOpenAppointmentSlotModal = openAppointmentSlotModal;
openAppointmentSlotModal = function(dateISO,time){
clinicV6OriginalOpenAppointmentSlotModal(dateISO,time);
let modal = document.getElementById("appointmentSlotModal");
if(modal && !modal.querySelector("#slotDuration")){
let note = modal.querySelector("#slotNote");
if(note){
note.insertAdjacentHTML("beforebegin", `<input id="slotDuration" type="number" min="15" step="15" value="60" placeholder="مدة الموعد بالدقائق">`);
}
}
};
}

/* Dashboard buttons */
function clinicV6AppendDashboardButtons(){
let quick = document.querySelector(".quick-actions");
if(quick && !quick.querySelector(".clinic-v6-sync-btn")){
quick.insertAdjacentHTML("beforeend", ``);
}
}

if(typeof renderDashboard === "function" && !window.__clinicV6RenderDashboardWrapped){
window.__clinicV6RenderDashboardWrapped = true;
const clinicV6OriginalRenderDashboard = renderDashboard;
renderDashboard = function(){
clinicV6OriginalRenderDashboard();
clinicV6AppendDashboardButtons();
};
}

function clinicV6Init(){
clinicV6DeviceId();
try{ clinicV5StoreBackup?.(getPatients(),"نسخة بداية النظام"); }catch(e){}
console.log("Clinic EMR v6 loaded", CLINIC_V6_VERSION);
}

setTimeout(clinicV6Init, 500);






function openFinanceSummaryFromDashboard(){
let patients = getPatients().map(p=>ensureAdvancedPatientData ? ensureAdvancedPatientData(p) : p);
window.__financeSummaryPatients = patients;
let rows = patients.map((p,idx)=>{
let f = p.finance || {charges:[], payments:[]};
let charges = (f.charges || []).reduce((s,x)=>s+Number(x.amount||0),0);
let payments = (f.payments || []).reduce((s,x)=>s+Number(x.amount||0),0);
return {idx, p, charges, payments, balance:charges-payments};
}).filter(x=>x.charges || x.payments || x.balance);

document.getElementById("output").innerHTML = `
<div class="card finance-manager">
<h2>💰 ملخص مالي عام</h2>
<p>اضغط على أي مريض لفتح ملفه.</p>
${rows.length ? rows.map(x=>`
<div class="card" onclick="openPatient(window.__financeSummaryPatients[${x.idx}])">
<b>${escapeHtml(x.p.name || "")}</b><br>
التكلفة: ${formatMoney(x.charges)} | المدفوع: ${formatMoney(x.payments)} | الباقي: ${formatMoney(x.balance)}
</div>
`).join("") : "<p>لا توجد بيانات مالية بعد.</p>"}
<button onclick="backToHome()">رجوع</button>
</div>`;
let backBtn = document.getElementById("backBtn");
if(backBtn) backBtn.style.display = "block";
}


/* =========================================================
   v9.4.13 Dashboard Router Fix
   Independent navigation layer for dashboard counters.
   It does NOT change sync, backup, audit log, or patient data.
========================================================= */

function DCOS_go(route){
  try{
    if(route === "patients"){
      if(typeof showPatients === "function") showPatients();
      return false;
    }
    if(route === "appointments"){
      if(typeof openAppointmentsManager === "function") openAppointmentsManager();
      return false;
    }
    if(route === "prescriptions"){
      if(typeof openRxLibraryManager === "function") openRxLibraryManager();
      return false;
    }
    if(route === "finance"){
      if(typeof openFinanceSummaryFromDashboard === "function") openFinanceSummaryFromDashboard();
      else if(typeof openClinicFinanceDashboard === "function") openClinicFinanceDashboard();
      return false;
    }
  }catch(e){
    console.error("DCOS_go failed", route, e);
    alert("تعذر فتح الصفحة: " + route + " - " + (e.message || e));
  }
  return false;
}

function DCOS_installDashboardRouter(){
  try{
    const output = document.getElementById("output");
    if(!output) return;

    const statsGrid = output.querySelector(".stats-grid");
    if(statsGrid && !statsGrid.dataset.dcosRouterReady){
      statsGrid.dataset.dcosRouterReady = "1";

      const labels = Array.from(statsGrid.querySelectorAll(".stat-card small")).map(x => (x.textContent || "").trim());
      const cards = Array.from(statsGrid.querySelectorAll(".stat-card"));

      cards.forEach(card => {
        const label = (card.querySelector("small")?.textContent || "").trim();
        let route = "";
        if(label === "المرضى") route = "patients";
        if(label === "مواعيد اليوم") route = "appointments";
        if(label === "الوصفات") route = "prescriptions";
        if(label === "الرصيد المتبقي") route = "finance";
        if(route){
          card.classList.add("stat-card-btn");
          card.setAttribute("role","button");
          card.setAttribute("tabindex","0");
          card.dataset.route = route;
          card.onclick = function(ev){
            if(ev){ ev.preventDefault(); ev.stopPropagation(); }
            return DCOS_go(route);
          };
          card.onkeydown = function(ev){
            if(ev.key === "Enter" || ev.key === " "){
              ev.preventDefault();
              return DCOS_go(route);
            }
          };
        }
      });
    }

    /* v9.4.14: keep dashboard router code active, but do not add the visible extra navigation strip. */
  }catch(e){
    console.warn("dashboard router install failed", e);
  }
}

(function(){
  const oldRender = typeof renderDashboard === "function" ? renderDashboard : null;
  if(oldRender && !window.__dcosDashboardRouterWrapped){
    window.__dcosDashboardRouterWrapped = true;
    renderDashboard = function(){
      const result = oldRender.apply(this, arguments);
      setTimeout(DCOS_installDashboardRouter, 0);
      setTimeout(DCOS_installDashboardRouter, 150);
      return result;
    };
  }

  document.addEventListener("DOMContentLoaded", function(){
    setTimeout(DCOS_installDashboardRouter, 0);
    setTimeout(DCOS_installDashboardRouter, 300);
  });

  document.addEventListener("click", function(ev){
    const card = ev.target.closest && ev.target.closest(".stats-grid .stat-card[data-route]");
    if(!card) return;
    ev.preventDefault();
    ev.stopPropagation();
    DCOS_go(card.dataset.route);
  }, true);
})();


/* =========================================================
   Dental Chain OS v10.0 Foundation Diagnostics
   Safe layer: does not change patient/sync/backup data.
========================================================= */
(function(){
  const DEV_LOG_KEY = "dcos_v10_dev_log";
  const VERSION = "Dental Chain OS v10.0 Foundation";

  function readLog(){
    try{return JSON.parse(localStorage.getItem(DEV_LOG_KEY)||"[]")}catch(e){return []}
  }
  function writeLog(list){
    try{localStorage.setItem(DEV_LOG_KEY, JSON.stringify((list||[]).slice(-200)))}catch(e){}
  }
  function log(type, message, details){
    const list = readLog();
    list.push({
      at:new Date().toISOString(),
      type:type||"info",
      message:String(message||""),
      details:details||null,
      version:VERSION
    });
    writeLog(list);
  }

  window.DCOSv10 = {
    version: VERSION,
    log,
    openDevMode:function(){
      const output = document.getElementById("output");
      if(!output) return;
      const logs = readLog().slice().reverse();
      const patients = (typeof getPatients === "function") ? getPatients().length : "-";
      const backups = (()=>{try{return JSON.parse(localStorage.getItem("clinicV5Backups")||"[]").length}catch(e){return "-"}})();
      output.innerHTML = `
        <div class="card dcos-dev-panel">
          <h2>🛠 Developer Mode - v10</h2>
          <p>هذه شاشة تشخيص مخفية للمساعدة في كشف الأخطاء بدون فتح Console.</p>
          <div class="v10-dev-grid">
            <div><small>الإصدار</small><b>${VERSION}</b></div>
            <div><small>عدد المرضى</small><b>${patients}</b></div>
            <div><small>حالة Firebase</small><b>${localStorage.getItem("dcos_v9_firebase_config") ? "محفوظ" : "غير مضبوط"}</b></div>
            <div><small>سجل الأخطاء</small><b>${logs.length}</b></div>
          </div>
          <h3>آخر السجلات</h3>
          <div class="v10-log-list">
            ${logs.length ? logs.map(x=>`
              <div class="v10-log-row">
                <b>${String(x.type||"")}</b>
                <small>${String(x.at||"")}</small>
                <p>${String(x.message||"")}</p>
              </div>
            `).join("") : "<p>لا توجد سجلات بعد.</p>"}
          </div>
          <button onclick="dcosOpenContactsTools()">📱 أدوات Google Contacts والصور</button>
          <button onclick="DCOSContactsAuto.open()">⚙️ إعدادات مزامنة جهات الاتصال</button>
          <button onclick="backToHome()">رجوع</button>
        </div>
      `;
      const backBtn=document.getElementById("backBtn");
      if(backBtn) backBtn.style.display="block";
    },
    selfTest:function(){
      const results = {
        showPatients: typeof showPatients,
        openRxLibraryManager: typeof openRxLibraryManager,
        openAppointmentsManager: typeof openAppointmentsManager,
        renderDashboard: typeof renderDashboard,
        output: !!document.getElementById("output"),
        v9Sync: !!window.dcosV9
      };
      log("self-test", "تم تشغيل فحص v10", results);
      return results;
    }
  };

  window.addEventListener("error", function(ev){
    log("error", ev.message || "window error", {
      file: ev.filename,
      line: ev.lineno,
      col: ev.colno
    });
  });

  window.addEventListener("unhandledrejection", function(ev){
    log("promise", ev.reason && (ev.reason.message || String(ev.reason)), {});
  });

  document.addEventListener("keydown", function(ev){
    if(ev.ctrlKey && ev.altKey && (ev.key || "").toLowerCase() === "d"){
      ev.preventDefault();
      window.DCOSv10.openDevMode();
    }
  });

  setTimeout(function(){
    try{ log("boot", "v10 foundation loaded", window.DCOSv10.selfTest()); }catch(e){}
  }, 1000);
})();


/* =========================================================
   Dental Chain OS v10.1 - Google Contacts + Local Image Folder
========================================================= */
const DCOS_GOOGLE_CONTACTS_CLIENT_ID = "774632785801-hvc88knperk3d1un5ktchkbmjno6bctb.apps.googleusercontent.com";
const DCOS_GOOGLE_CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts";
let dcosGoogleAccessToken = localStorage.getItem("dcos_google_contacts_access_token") || "";
let dcosContactTokenClient = null;
let dcosImageDirectoryHandle = null;

function dcosContactName(p){ return "DTDC - " + String((p && p.name) || "").trim(); }
function dcosPatientPhone(p){ return String((p && (p.phone || p.mobile || p.tel || p.number)) || "").trim(); }
function dcosPatientNotes(p){ return String((p && (p.notes || p.note || p.medicalNotes)) || "").trim(); }

function dcosInitGoogleContacts(){
  if(!window.google || !google.accounts || !google.accounts.oauth2){
    alert("Google Identity Services لم يتحمل بعد. أعد المحاولة بعد ثوانٍ.");
    return false;
  }
  if(!dcosContactTokenClient){
    dcosContactTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DCOS_GOOGLE_CONTACTS_CLIENT_ID,
      scope: DCOS_GOOGLE_CONTACTS_SCOPE,
      callback: function(tokenResponse){
        if(tokenResponse && tokenResponse.access_token){
          dcosGoogleAccessToken = tokenResponse.access_token;
          localStorage.setItem("dcos_google_contacts_access_token", dcosGoogleAccessToken);
          alert("تم ربط Google Contacts بنجاح.");
        }else{
          alert("لم يتم الحصول على صلاحية Google Contacts.");
        }
      }
    });
  }
  return true;
}

function dcosConnectGoogleContacts(){
  if(!dcosInitGoogleContacts()) return;
  dcosContactTokenClient.requestAccessToken({prompt:"consent"});
}

async function dcosCreateGoogleContactForPatient(p){
  if(!p){ alert("افتح مريضًا أولًا."); return; }
  if(!dcosGoogleAccessToken){ dcosConnectGoogleContacts(); return; }
  const phone = dcosPatientPhone(p);
  if(!phone){ alert("لا يوجد رقم هاتف لهذا المريض."); return; }

  const body = {
    names: [{givenName: dcosContactName(p)}],
    phoneNumbers: [{value: phone}],
    biographies: dcosPatientNotes(p) ? [{value: dcosPatientNotes(p), contentType:"TEXT_PLAIN"}] : []
  };

  const res = await fetch("https://people.googleapis.com/v1/people:createContact", {
    method:"POST",
    headers:{
      "Authorization":"Bearer " + dcosGoogleAccessToken,
      "Content-Type":"application/json"
    },
    body: JSON.stringify(body)
  });

  if(res.status === 401 || res.status === 403){
    dcosGoogleAccessToken = "";
    localStorage.removeItem("dcos_google_contacts_access_token");
    alert("انتهت صلاحية Google Contacts. اضغط ربط Google Contacts ثم أعد المحاولة.");
    return;
  }
  if(!res.ok){
    const txt = await res.text();
    console.error("Google contact create failed", txt);
    alert("فشل إنشاء جهة الاتصال: " + txt.slice(0,200));
    return;
  }

  p.googleContactSyncedAt = new Date().toISOString();
  p.googleContactName = dcosContactName(p);
  if(typeof saveAll === "function") saveAll();
  alert("تم إنشاء جهة الاتصال على Google Contacts.");
}

async function dcosSyncUnsyncedContacts(){
  if(!dcosGoogleAccessToken){ dcosConnectGoogleContacts(); return; }
  const patients = typeof getPatients === "function" ? getPatients() : [];
  let ok = 0, skipped = 0, failed = 0;
  for(const p of patients){
    if(!p || p.googleContactSyncedAt){ skipped++; continue; }
    if(!dcosPatientPhone(p)){ skipped++; continue; }
    try{ await dcosCreateGoogleContactForPatient(p); ok++; }
    catch(e){ console.error(e); failed++; }
  }
  if(typeof savePatients === "function") savePatients(patients);
  alert("انتهى رفع جهات الاتصال. تم: " + ok + "، متروك: " + skipped + "، فشل: " + failed);
}

async function dcosChooseImagesFolder(){
  if(!window.showDirectoryPicker){
    alert("اختيار مجلد الصور مدعوم فقط على Chrome/Edge في الكمبيوتر.");
    return;
  }
  dcosImageDirectoryHandle = await window.showDirectoryPicker({mode:"readwrite"});
  localStorage.setItem("dcos_images_folder_enabled", "1");
  alert("تم اختيار مجلد الصور المحلي.");
}

function dcosSafeFileName(name){
  return String(name || "patient").replace(/[\\/:*?"<>|]+/g, "-").slice(0,80);
}

async function dcosSaveBlobToLocalImagesFolder(blob, fileName){
  if(!dcosImageDirectoryHandle){ alert("اختر مجلد الصور أولًا."); return false; }
  const handle = await dcosImageDirectoryHandle.getFileHandle(dcosSafeFileName(fileName), {create:true});
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

function dcosOpenContactsTools(){
  const output = document.getElementById("output");
  if(!output) return;
  const currentName = patient && patient.name ? patient.name : "لا يوجد مريض مفتوح";
  output.innerHTML =
    '<div class="card dcos-contacts-panel">' +
    '<h2>📱 Google Contacts + Local Images</h2>' +
    '<p>المريض الحالي: <b>' + currentName + '</b></p>' +
    '<div class="dcos-tools-grid">' +
    '<button onclick="dcosConnectGoogleContacts()">🔐 ربط Google Contacts</button>' +
    '<button onclick="dcosCreateGoogleContactForPatient(patient)">📱 رفع المريض الحالي كجهة اتصال</button>' +
    '<button onclick="dcosSyncUnsyncedContacts()">📤 رفع المرضى غير المرفوعين</button>' +
    '<button onclick="dcosChooseImagesFolder()">🖼 اختيار مجلد صور محلي</button>' +
    '<button onclick="DCOSContactsAuto.open()">⚙️ إعدادات المزامنة التلقائية</button>' +
    '</div>' +
    '<p class="clinic-v5-note">الصور تبقى Local فقط. جهات الاتصال تضاف إلى Google Contacts بصيغة DTDC - اسم المريض.</p>' +
    '<button onclick="backToHome()">رجوع</button>' +
    '</div>';
  const backBtn = document.getElementById("backBtn");
  if(backBtn) backBtn.style.display = "block";
}

window.DCOSContacts = {
  connect: dcosConnectGoogleContacts,
  syncCurrent: function(){ return dcosCreateGoogleContactForPatient(patient); },
  syncAll: dcosSyncUnsyncedContacts,
  imagesFolder: dcosChooseImagesFolder,
  open: dcosOpenContactsTools
};


/* =========================================================
   Dental Chain OS v10.2 - Google Contacts Auto Sync
   Safe layer: wraps savePatients only. Does not alter Firebase sync.
========================================================= */
(function(){
  const AUTO_KEY = "dcos_google_contacts_auto_sync";
  const QUEUE_KEY = "dcos_google_contacts_queue";
  const LAST_HASH_KEY = "dcos_google_contacts_hashes";

  function contactsAutoEnabled(){
    return localStorage.getItem(AUTO_KEY) === "1";
  }

  function setContactsAutoEnabled(value){
    localStorage.setItem(AUTO_KEY, value ? "1" : "0");
  }

  function contactHash(p){
    return JSON.stringify({
      name: dcosContactName(p),
      phone: dcosPatientPhone(p),
      notes: dcosPatientNotes(p)
    });
  }

  function getHashes(){
    try{return JSON.parse(localStorage.getItem(LAST_HASH_KEY)||"{}")}catch(e){return {}}
  }

  function saveHashes(h){
    try{localStorage.setItem(LAST_HASH_KEY, JSON.stringify(h||{}))}catch(e){}
  }

  function queueRead(){
    try{
      const arr = JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]");
      return Array.isArray(arr) ? arr : [];
    }catch(e){return []}
  }

  function queueWrite(arr){
    try{localStorage.setItem(QUEUE_KEY, JSON.stringify((arr||[]).slice(-500)))}catch(e){}
  }

  function patientKey(p, idx){
    return String((p && (p.fileNo || p.id || p.name || dcosPatientPhone(p))) || ("patient-" + idx));
  }

  function enqueueContactSync(p, idx, reason){
    if(!p || !dcosPatientPhone(p)) return;
    const key = patientKey(p, idx);
    const q = queueRead();
    const item = {
      key,
      fileNo: p.fileNo || "",
      name: p.name || "",
      phone: dcosPatientPhone(p),
      notes: dcosPatientNotes(p),
      reason: reason || "auto",
      queuedAt: new Date().toISOString()
    };
    const existing = q.findIndex(x => x.key === key);
    if(existing >= 0) q[existing] = item;
    else q.push(item);
    queueWrite(q);
  }

  async function createOrUpdateContactFromQueueItem(item){
    const patients = typeof getPatients === "function" ? getPatients() : [];
    const p = patients.find(x => 
      (item.fileNo && x.fileNo === item.fileNo) ||
      (item.phone && dcosPatientPhone(x) === item.phone) ||
      (item.name && x.name === item.name)
    );
    if(!p) return {ok:false, reason:"patient-not-found"};

    // v10.2 creates a contact if not yet synced.
    // If already synced and People API resourceName exists later, v10.3 can upgrade to true update.
    // For now we prevent duplicates by hash + googleContactSyncedAt.
    const h = contactHash(p);
    if(p.googleContactSyncedAt && p.googleContactLastHash === h){
      return {ok:true, skipped:true};
    }

    await dcosCreateGoogleContactForPatient(p);
    p.googleContactLastHash = h;
    p.googleContactAutoSyncedAt = new Date().toISOString();
    if(typeof savePatients === "function") savePatients(patients);
    return {ok:true};
  }

  async function processContactQueue(){
    if(!contactsAutoEnabled()){
      alert("المزامنة التلقائية مع Google Contacts غير مفعلة.");
      return;
    }
    if(!dcosGoogleAccessToken){
      dcosConnectGoogleContacts();
      return;
    }

    let q = queueRead();
    let ok=0, skipped=0, failed=0;
    const remaining = [];

    for(const item of q){
      try{
        const r = await createOrUpdateContactFromQueueItem(item);
        if(r && r.skipped) skipped++;
        else if(r && r.ok) ok++;
        else { failed++; remaining.push(item); }
      }catch(e){
        console.error("contact queue failed", e);
        failed++;
        remaining.push(item);
      }
    }
    queueWrite(remaining);
    alert("نتيجة مزامنة Google Contacts: تم " + ok + "، متروك " + skipped + "، فشل " + failed);
  }

  function scanPatientsForContactChanges(list){
    if(!contactsAutoEnabled()) return;
    const hashes = getHashes();
    (list || []).forEach((p, idx)=>{
      if(!p || !dcosPatientPhone(p)) return;
      const key = patientKey(p, idx);
      const h = contactHash(p);
      if(hashes[key] !== h){
        hashes[key] = h;
        enqueueContactSync(p, idx, "patient-save");
      }
    });
    saveHashes(hashes);
  }

  function installContactsAutoWrapper(){
    if(window.__dcosContactsAutoWrapped || typeof window.savePatients !== "function") return;
    window.__dcosContactsAutoWrapped = true;
    const oldSavePatients = window.savePatients;
    window.savePatients = function(list){
      const result = oldSavePatients.apply(this, arguments);
      try{ scanPatientsForContactChanges(list || (typeof getPatients==="function" ? getPatients() : [])); }catch(e){console.warn("contacts auto scan failed", e);}
      return result;
    };
  }

  function openContactsAutoSettings(){
    const output=document.getElementById("output");
    if(!output) return;
    const q = queueRead();
    output.innerHTML =
      '<div class="card dcos-contacts-panel">' +
      '<h2>📱 Google Contacts Auto Sync</h2>' +
      '<p>الحالة الحالية: <b>' + (contactsAutoEnabled() ? "مفعلة" : "غير مفعلة") + '</b></p>' +
      '<p>عدد العناصر المنتظرة: <b>' + q.length + '</b></p>' +
      '<div class="dcos-tools-grid">' +
      '<button onclick="dcosConnectGoogleContacts()">🔐 ربط Google Contacts</button>' +
      '<button onclick="DCOSContactsAuto.enable()">✅ تفعيل التلقائي</button>' +
      '<button onclick="DCOSContactsAuto.disable()">⛔ إيقاف التلقائي</button>' +
      '<button onclick="DCOSContactsAuto.scan()">🔍 فحص المرضى وإضافة للطابور</button>' +
      '<button onclick="DCOSContactsAuto.process()">📤 مزامنة الطابور الآن</button>' +
      '</div>' +
      '<p class="clinic-v5-note">عند حفظ مريض جديد أو تعديل اسمه/رقمه/ملاحظاته، يضاف للطابور. اضغط مزامنة الطابور الآن بعد ربط Google.</p>' +
      '<button onclick="backToHome()">رجوع</button>' +
      '</div>';
    const backBtn=document.getElementById("backBtn");
    if(backBtn) backBtn.style.display="block";
  }

  window.DCOSContactsAuto = {
    enable:function(){ setContactsAutoEnabled(true); installContactsAutoWrapper(); alert("تم تفعيل مزامنة Google Contacts التلقائية."); openContactsAutoSettings(); },
    disable:function(){ setContactsAutoEnabled(false); alert("تم إيقاف مزامنة Google Contacts التلقائية."); openContactsAutoSettings(); },
    scan:function(){ scanPatientsForContactChanges(typeof getPatients==="function" ? getPatients() : []); alert("تم فحص المرضى وإضافة التغييرات للطابور."); openContactsAutoSettings(); },
    process:processContactQueue,
    open:openContactsAutoSettings,
    queue:queueRead
  };

  document.addEventListener("DOMContentLoaded", function(){
    setTimeout(installContactsAutoWrapper, 300);
    setTimeout(installContactsAutoWrapper, 1500);
  });

  setTimeout(installContactsAutoWrapper, 1000);
})();


/* =========================================================
   Dental Chain OS v10.4 - Doctor Reports
   Safe report layer. Does not alter existing data.
========================================================= */
function dcosDoctorName(v){
  v = String(v || "").trim();
  return v || "غير محدد";
}
function dcosDoctorReportCollect(){
  const patients = (typeof getPatients === "function") ? getPatients() : [];
  const map = {};
  function bucket(name){
    name = dcosDoctorName(name);
    if(!map[name]) map[name] = {name, patients:new Set(), visits:0, prescriptions:0, appointments:0, finance:0, treatments:0, rows:[]};
    return map[name];
  }
  patients.forEach(p=>{
    const patientName = p.name || "";
    const pDoctor = p.doctor || p.treatingDoctor || p.activeDoctor || p.provider || "";
    if(pDoctor){
      let b=bucket(pDoctor); b.patients.add(patientName); b.rows.push({patient:patientName,type:"ملف مريض",date:p.createdAt||p.updatedAt||"",text:"الطبيب المعالج في الملف"});
    }
    (p.visits||[]).forEach(v=>{
      let d=v.doctor || v.treatingDoctor || pDoctor || "";
      let b=bucket(d); b.visits++; b.patients.add(patientName); b.rows.push({patient:patientName,type:"زيارة",date:v.date||v.createdAt||"",text:v.text||v.note||v.notes||""});
    });
    (p.prescriptions||[]).forEach(rx=>{
      let d=rx.doctor || rx.treatingDoctor || pDoctor || "";
      let b=bucket(d); b.prescriptions++; b.patients.add(patientName); b.rows.push({patient:patientName,type:"وصفة",date:rx.date||rx.createdAt||"",text:rx.title||rx.type||""});
    });
    (p.treatmentPlan||[]).forEach(t=>{
      let d=t.doctor || t.treatingDoctor || pDoctor || "";
      let b=bucket(d); b.treatments++; b.patients.add(patientName); b.rows.push({patient:patientName,type:"خطة علاج",date:t.date||t.createdAt||"",text:[t.tooth,t.title||t.name,t.status].filter(Boolean).join(" - ")});
    });
    try{
      const f=p.finance||{};
      (f.charges||[]).forEach(x=>{
        let d=x.doctor || x.treatingDoctor || pDoctor || "";
        let b=bucket(d); b.finance += Number(x.amount||0); b.patients.add(patientName); b.rows.push({patient:patientName,type:"إجراء مالي",date:x.date||"",text:(x.title||x.note||"") + " - " + (x.amount||"")});
      });
    }catch(e){}
  });
  try{
    if(typeof getAppointments === "function"){
      (getAppointments()||[]).forEach(a=>{
        let d=a.doctor || a.treatingDoctor || a.provider || "";
        let b=bucket(d); b.appointments++; if(a.patientName)b.patients.add(a.patientName);
        b.rows.push({patient:a.patientName||"",type:"موعد",date:(a.date||"")+" "+(a.time||""),text:a.note||a.reason||""});
      });
    }
  }catch(e){}
  return Object.values(map).map(x=>({...x, patientsCount:x.patients.size, patients:[...x.patients]})).sort((a,b)=>a.name.localeCompare(b.name,"ar"));
}
function openDoctorReports(){
  if(!dcosIsClinicAdmin()){ alert('تقارير الأطباء متاحة لمدير العيادة والسوبر أونر فقط'); return; }
  const data = dcosDoctorReportCollect();
  const output=document.getElementById("output");
  if(!output)return;
  output.innerHTML = `
    <div class="card dcos-doctor-report">
      <h2>👨‍⚕️ تقرير الأطباء</h2>
      <p>يعرض ما تم تسجيله باسم كل طبيب: مرضى، زيارات، وصفات، مواعيد، خطط علاج، ومبالغ إجراءات.</p>
      <div class="dcos-doctor-grid">
        ${data.length ? data.map((d,i)=>`
          <button class="dcos-doctor-card" onclick="openDoctorReportDetails(${i})">
            <b>${escapeHtml ? escapeHtml(d.name) : d.name}</b>
            <span>مرضى: ${d.patientsCount}</span>
            <span>زيارات: ${d.visits}</span>
            <span>وصفات: ${d.prescriptions}</span>
            <span>مواعيد: ${d.appointments}</span>
            <span>خطط: ${d.treatments}</span>
            <span>إجمالي إجراءات: ${typeof formatMoney==="function" ? formatMoney(d.finance) : d.finance}</span>
          </button>
        `).join("") : "<p>لا توجد بيانات أطباء مسجلة بعد.</p>"}
      </div>
      <button onclick="backToHome()">رجوع</button>
    </div>`;
  window.__dcosDoctorReportData=data;
  const backBtn=document.getElementById("backBtn");
  if(backBtn)backBtn.style.display="block";
}
function openDoctorReportDetails(index){
  const data = window.__dcosDoctorReportData || dcosDoctorReportCollect();
  const d = data[index];
  if(!d){openDoctorReports();return;}
  const output=document.getElementById("output");
  output.innerHTML = `
    <div class="card dcos-doctor-report">
      <h2>👨‍⚕️ ${escapeHtml ? escapeHtml(d.name) : d.name}</h2>
      <div class="dcos-doctor-summary">
        <div><small>المرضى</small><b>${d.patientsCount}</b></div>
        <div><small>الزيارات</small><b>${d.visits}</b></div>
        <div><small>الوصفات</small><b>${d.prescriptions}</b></div>
        <div><small>المواعيد</small><b>${d.appointments}</b></div>
        <div><small>خطط العلاج</small><b>${d.treatments}</b></div>
      </div>
      <h3>السجل</h3>
      <div class="audit-log-list">
        ${d.rows.slice().reverse().map(r=>`
          <div class="audit-log-item">
            <b>${escapeHtml ? escapeHtml(r.type) : r.type} - ${escapeHtml ? escapeHtml(r.patient) : r.patient}</b>
            <small>${escapeHtml ? escapeHtml(r.date||"") : (r.date||"")}</small>
            <p>${escapeHtml ? escapeHtml(r.text||"") : (r.text||"")}</p>
          </div>
        `).join("") || "<p>لا توجد تفاصيل.</p>"}
      </div>
      <button onclick="openDoctorReports()">رجوع لتقرير الأطباء</button>
    </div>`;
}
(function(){
  function injectDoctorReportButton(){
  clinicV5AppendDashboardButtons();
}
  if(typeof renderDashboard==="function" && !window.__dcosDoctorReportDashboardWrapped){
    const oldRender=renderDashboard;
    window.renderDashboard=function(){
      const r=oldRender.apply(this,arguments);
      setTimeout(injectDoctorReportButton,80);
      return r;
    };
    window.__dcosDoctorReportDashboardWrapped=true;
  }
  document.addEventListener("DOMContentLoaded",()=>setTimeout(injectDoctorReportButton,500));
})();


/* =========================================================
   Dental Chain OS v10.5
   Data Manager + Accounts/Permissions + Doctor Finance Fix
   Safe add-on layer.
========================================================= */

const DCOS_V105_USERS_KEY = "dcos_v105_users";
const DCOS_V105_SESSION_KEY = "dcos_v105_session";
const DCOS_V105_PERMS = ["patients","prescriptions","appointments","finance","reports","sync","data","accounts"];

function dcosRoleNow(){
  try{
    return String((window.profile?.()||window.DCOS_HYBRID?.account||{}).role||'').trim().toLowerCase();
  }catch(e){ return ''; }
}
function dcosIsClinicAdmin(){
  const r=dcosRoleNow();
  return r==='manager'||r==='super_owner';
}

function dcos105ReadJson(key, fallback){
  try{return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));}catch(e){return fallback;}
}
function dcos105WriteJson(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function dcos105Audit(action, details){
  try{
    let list = dcos105ReadJson("dcos_v9_audit_log", []);
    list.push({id:"AUD-"+Date.now()+"-"+Math.random().toString(36).slice(2,8), at:new Date().toISOString(), action, details:details||{}, source:"v10.5"});
    dcos105WriteJson("dcos_v9_audit_log", list.slice(-700));
  }catch(e){}
}
function dcos105EnsureAdmin(){
  let users = dcos105ReadJson(DCOS_V105_USERS_KEY, []);
  if(!users.length){
    users = [{
      id:"admin",
      name:"Admin",
      username:"admin",
      pin:"",
      role:"owner",
      permissions:[...DCOS_V105_PERMS],
      active:true,
      createdAt:new Date().toISOString()
    }];
    dcos105WriteJson(DCOS_V105_USERS_KEY, users);
  }
  return users;
}
function dcos105CurrentUser(){
  dcos105EnsureAdmin();
  let session = dcos105ReadJson(DCOS_V105_SESSION_KEY, null);
  let users = dcos105ReadJson(DCOS_V105_USERS_KEY, []);
  if(session && session.id){
    let u = users.find(x=>x.id===session.id && x.active !== false);
    if(u) return u;
  }
  let admin = users.find(x=>x.role==="owner") || users[0];
  dcos105WriteJson(DCOS_V105_SESSION_KEY, {id:admin.id, at:new Date().toISOString()});
  return admin;
}
function dcos105Can(permission){
  let u=dcos105CurrentUser();
  return u.role==="owner" || (u.permissions||[]).includes(permission);
}
function dcos105Require(permission){
  if(dcos105Can(permission)) return true;
  alert("لا تملك صلاحية: " + permission);
  return false;
}
function dcos105MoneyNumber(v){
  if(v === null || v === undefined) return 0;
  if(typeof v === "number" && isFinite(v)) return v;
  let s = String(v).replace(/[^\d.\-]/g,"");
  let n = Number(s);
  return isFinite(n) ? n : 0;
}
function dcos105FormatMoney(n){
  if(typeof formatMoney === "function"){
    try{return formatMoney(Number(n)||0);}catch(e){}
  }
  return (Number(n)||0).toLocaleString("en-US");
}
function dcos105DoctorName(v){
  v=String(v||"").trim();
  return v || "غير محدد";
}
function dcos105PatientDoctor(p){
  return dcos105DoctorName(p?.doctor || p?.treatingDoctor || p?.activeDoctor || p?.provider || "");
}
function dcos105FinanceItemsForPatient(p){
  let rows=[];
  let baseDoctor = dcos105PatientDoctor(p);
  let patientName = p?.name || "";
  function add(kind, item, amountField){
    if(!item) return;
    let amount = dcos105MoneyNumber(item[amountField] ?? item.amount ?? item.cost ?? item.price ?? item.value);
    if(!amount || amount < 0) return;
    rows.push({
      doctor:dcos105DoctorName(item.doctor || item.treatingDoctor || item.provider || baseDoctor),
      patient:patientName,
      date:item.date || item.createdAt || item.at || "",
      title:item.title || item.name || item.procedure || item.note || kind,
      amount,
      kind
    });
  }
  try{(p?.finance?.charges||[]).forEach(x=>add("إجراء مالي", x, "amount"));}catch(e){}
  try{(p?.charges||[]).forEach(x=>add("إجراء مالي", x, "amount"));}catch(e){}
  try{(p?.procedures||[]).forEach(x=>add("إجراء", x, "amount"));}catch(e){}
  try{(p?.treatmentPlan||[]).forEach(x=>{
    // Only completed/paid/charged treatment items are counted if there is an explicit positive amount/cost.
    add("خطة علاج", x, "cost");
  });}catch(e){}
  return rows;
}
function dcos105CollectDoctorReports(){
  const patients = typeof getPatients === "function" ? getPatients() : [];
  const map = {};
  function bucket(name){
    name=dcos105DoctorName(name);
    if(!map[name]) map[name]={name,patients:new Set(),visits:0,prescriptions:0,appointments:0,treatments:0,revenue:0,financeRows:[],rows:[]};
    return map[name];
  }
  patients.forEach(p=>{
    let patientName = p?.name || "";
    let base = dcos105PatientDoctor(p);
    if(base !== "غير محدد"){
      let b=bucket(base); b.patients.add(patientName); b.rows.push({patient:patientName,type:"ملف مريض",date:p.createdAt||p.updatedAt||"",text:"الطبيب المعالج"});
    }
    (p.visits||[]).forEach(v=>{
      let b=bucket(v.doctor || v.treatingDoctor || base); b.visits++; b.patients.add(patientName); b.rows.push({patient:patientName,type:"زيارة",date:v.date||v.createdAt||"",text:v.text||v.note||v.notes||""});
    });
    (p.prescriptions||[]).forEach(rx=>{
      let b=bucket(rx.doctor || rx.treatingDoctor || base); b.prescriptions++; b.patients.add(patientName); b.rows.push({patient:patientName,type:"وصفة",date:rx.date||rx.createdAt||"",text:rx.title||rx.type||""});
    });
    (p.treatmentPlan||[]).forEach(t=>{
      let b=bucket(t.doctor || t.treatingDoctor || base); b.treatments++; b.patients.add(patientName); b.rows.push({patient:patientName,type:"خطة علاج",date:t.date||t.createdAt||"",text:[t.tooth,t.title||t.name,t.status].filter(Boolean).join(" - ")});
    });
    dcos105FinanceItemsForPatient(p).forEach(row=>{
      let b=bucket(row.doctor); b.revenue += row.amount; b.patients.add(row.patient); b.financeRows.push(row);
      b.rows.push({patient:row.patient,type:"إجراء مالي",date:row.date,text:row.title+" - "+dcos105FormatMoney(row.amount)});
    });
  });
  try{
    if(typeof getAppointments === "function"){
      (getAppointments()||[]).forEach(a=>{
        let b=bucket(a.doctor || a.treatingDoctor || a.provider || "");
        b.appointments++; if(a.patientName)b.patients.add(a.patientName);
        b.rows.push({patient:a.patientName||"",type:"موعد",date:(a.date||"")+" "+(a.time||""),text:a.note||a.reason||""});
      });
    }
  }catch(e){}
  return Object.values(map).map(x=>({...x,patientsCount:x.patients.size,patients:[...x.patients]})).sort((a,b)=>a.name.localeCompare(b.name,"ar"));
}
function openDoctorReports(){
  if(!dcosIsClinicAdmin()){ alert('تقارير الأطباء متاحة لمدير العيادة والسوبر أونر فقط'); return; }
  if(!dcos105Require("reports")) return;
  const data = dcos105CollectDoctorReports();
  window.__dcosDoctorReportData = data;
  const output=document.getElementById("output");
  if(!output)return;
  output.innerHTML = `
    <div class="card dcos-doctor-report">
      <h2>👨‍⚕️ تقرير الأطباء</h2>
      <p>تم تصحيح الحساب المالي: الإيرادات تُجمع فقط من الإجراءات المالية ذات قيمة موجبة.</p>
      <div class="dcos-doctor-grid">
        ${data.length ? data.map((d,i)=>`
          <button class="dcos-doctor-card" onclick="openDoctorReportDetails(${i})">
            <b>${escapeHtml ? escapeHtml(d.name) : d.name}</b>
            <span>مرضى: ${d.patientsCount}</span>
            <span>زيارات: ${d.visits}</span>
            <span>وصفات: ${d.prescriptions}</span>
            <span>مواعيد: ${d.appointments}</span>
            <span>خطط: ${d.treatments}</span>
            <span>الإيرادات: ${dcos105FormatMoney(d.revenue)}</span>
          </button>
        `).join("") : "<p>لا توجد بيانات أطباء مسجلة بعد.</p>"}
      </div>
      <button onclick="backToHome()">رجوع</button>
    </div>`;
  const backBtn=document.getElementById("backBtn");
  if(backBtn)backBtn.style.display="block";
}
function openDoctorReportDetails(index){
  if(!dcos105Require("reports")) return;
  const data = window.__dcosDoctorReportData || dcos105CollectDoctorReports();
  const d = data[index];
  if(!d){openDoctorReports();return;}
  const output=document.getElementById("output");
  output.innerHTML = `
    <div class="card dcos-doctor-report">
      <h2>👨‍⚕️ ${escapeHtml ? escapeHtml(d.name) : d.name}</h2>
      <div class="dcos-doctor-summary">
        <div><small>المرضى</small><b>${d.patientsCount}</b></div>
        <div><small>الزيارات</small><b>${d.visits}</b></div>
        <div><small>الوصفات</small><b>${d.prescriptions}</b></div>
        <div><small>المواعيد</small><b>${d.appointments}</b></div>
        <div><small>الإيرادات</small><b>${dcos105FormatMoney(d.revenue)}</b></div>
      </div>
      <h3>تفاصيل الإجراءات المالية</h3>
      <div class="audit-log-list">
        ${d.financeRows.length ? d.financeRows.slice().reverse().map(r=>`
          <div class="audit-log-item">
            <b>${escapeHtml ? escapeHtml(r.patient) : r.patient} - ${escapeHtml ? escapeHtml(r.title) : r.title}</b>
            <small>${escapeHtml ? escapeHtml(r.date||"") : (r.date||"")}</small>
            <p>${dcos105FormatMoney(r.amount)}</p>
          </div>
        `).join("") : "<p>لا توجد إجراءات مالية موجبة لهذا الطبيب.</p>"}
      </div>
      <h3>السجل العام</h3>
      <div class="audit-log-list">
        ${d.rows.slice().reverse().map(r=>`
          <div class="audit-log-item">
            <b>${escapeHtml ? escapeHtml(r.type) : r.type} - ${escapeHtml ? escapeHtml(r.patient) : r.patient}</b>
            <small>${escapeHtml ? escapeHtml(r.date||"") : (r.date||"")}</small>
            <p>${escapeHtml ? escapeHtml(r.text||"") : (r.text||"")}</p>
          </div>
        `).join("") || "<p>لا توجد تفاصيل.</p>"}
      </div>
      <button onclick="openDoctorReports()">رجوع لتقرير الأطباء</button>
    </div>`;
}

function dcos105ClearLocalPatientsOnly(){
  if(!confirm("حذف المرضى محليًا فقط؟ لن يحذف السحابة.")) return;
  localStorage.setItem("patients","[]");
  dcos105Audit("data_clear_local_patients",{});
  alert("تم حذف المرضى محليًا.");
  try{renderDashboard();}catch(e){}
}
function dcos105ClearLocalOnly(){
  if(!confirm("مسح المحلي فقط؟ سيحذف بيانات هذا المتصفح فقط.")) return;
  ["patients","dcos_v9_deleted_patient_ids","dcos_v9_deleted_patients","dcos_v9_audit_log","dcos_v10_sync_dirty","dcos_v10_last_sync"].forEach(k=>localStorage.removeItem(k));
  dcos105Audit("data_clear_local_all",{});
  alert("تم مسح البيانات المحلية.");
  location.reload();
}
async function dcos105DeleteCloudPatientById(){
  if(!dcos105Require("data")) return;
  const id = prompt("أدخل ID / رقم الملف / الاسم كما هو على السحابة:");
  if(!id) return;
  if(!confirm("سيتم حذف/تعليم هذا المريض كمحذوف على السحابة فقط. متابعة؟")) return;
  try{
    if(!window.dcosV9 || !dcosV9.open) throw new Error("افتح المزامنة أولًا للتأكد من الإعدادات");
    const cfg = JSON.parse(localStorage.getItem("dcos_v9_firebase_config")||"null");
    if(!cfg) throw new Error("لا توجد إعدادات Firebase");
    let app;
    try{app=firebase.app("dcos-v10-dm")}catch(e){app=firebase.initializeApp(cfg,"dcos-v10-dm")}
    const db=firebase.firestore(app);
    const docId=String(id).replace(/[\/#?[\]]/g,"_").slice(0,140);
    await db.collection("clinics").doc(localStorage.getItem("dcos_v9_clinic_id")||"default").collection("patients").doc(docId).set({
      id:docId, deleted:true, deletedAt:new Date().toISOString(), updatedAt:new Date().toISOString(), deletedBy:"DataManager"
    },{merge:true});
    dcos105Audit("data_delete_cloud_patient",{id:docId});
    alert("تم تعليم المريض كمحذوف على السحابة.");
  }catch(e){alert("فشل حذف المريض من السحابة: "+(e.message||e));}
}
async function dcos105ClearCloudOnly(){
  if(!dcos105Require("data")) return;
  if(!confirm("خطر: حذف كل بيانات المرضى من السحابة فقط؟")) return;
  if(prompt("اكتب DELETE للتأكيد") !== "DELETE") return;
  try{
    const cfg = JSON.parse(localStorage.getItem("dcos_v9_firebase_config")||"null");
    if(!cfg) throw new Error("لا توجد إعدادات Firebase");
    let app;
    try{app=firebase.app("dcos-v10-dm")}catch(e){app=firebase.initializeApp(cfg,"dcos-v10-dm")}
    const db=firebase.firestore(app);
    const ref=db.collection("clinics").doc(localStorage.getItem("dcos_v9_clinic_id")||"default").collection("patients");
    const snap=await ref.get();
    let batch=db.batch(), count=0;
    snap.forEach(d=>{batch.delete(d.ref); count++;});
    await batch.commit();
    dcos105Audit("data_clear_cloud_all",{count});
    alert("تم حذف بيانات السحابة: "+count);
  }catch(e){alert("فشل مسح السحابة: "+(e.message||e));}
}
async function dcos105ClearAll(){
  if(!confirm("مسح المحلي والسحابة معًا؟")) return;
  if(prompt("اكتب DELETE ALL للتأكيد") !== "DELETE ALL") return;
  await dcos105ClearCloudOnly();
  ["patients","dcos_v9_deleted_patient_ids","dcos_v9_deleted_patients"].forEach(k=>localStorage.removeItem(k));
  alert("تم طلب مسح الكل.");
  location.reload();
}
async function openDataManager(){
  if(!dcosIsClinicAdmin()){ alert('Data Manager متاح لمدير العيادة والسوبر أونر فقط'); return; }
  if(!dcos105Require("data")) return;
  let patients = typeof getPatients === "function" ? getPatients() : [];
  const output=document.getElementById("output");
  if(!output)return;
  output.innerHTML = `
    <div class="card dcos-data-manager">
      <h2>🧰 Data Manager</h2>
      <p>شاشة مخفية لإدارة البيانات. استخدمها بحذر.</p>
      <div class="dcos-doctor-summary">
        <div><small>المرضى المحليون</small><b>${patients.length}</b></div>
        <div><small>المستخدم الحالي</small><b>${dcos105CurrentUser().name}</b></div>
      </div>
      <div class="dcos-tools-grid">
        <button onclick="dcos105ClearLocalOnly()">🧹 مسح المحلي فقط</button>
        <button onclick="dcos105ClearCloudOnly()">☁️ مسح السحابة فقط</button>
        <button onclick="dcos105ClearAll()">🔥 مسح الكل</button>
        <button onclick="dcos105DeleteCloudPatientById()">🗑 حذف مريض محدد من السحابة</button>
        <button onclick="dcosV9.refresh()">🔄 مزامنة الآن</button>
        <button onclick="openAccountsManager()">👥 الحسابات والصلاحيات</button>
      </div>
      <button onclick="backToHome()">رجوع</button>
    </div>`;
  const backBtn=document.getElementById("backBtn");
  if(backBtn)backBtn.style.display="block";
}
function openAccountsManager(){
  if(!dcosIsClinicAdmin()){ alert('إدارة الحسابات متاحة لمدير العيادة والسوبر أونر فقط'); return; }
  if(!dcos105Require("accounts")) return;
  let users=dcos105EnsureAdmin();
  const output=document.getElementById("output");
  output.innerHTML = `
    <div class="card dcos-accounts-manager">
      <h2>👥 الحسابات والصلاحيات</h2>
      <div class="dcos-tools-grid">
        <button onclick="dcos105CreateUser()">➕ إنشاء حساب</button>
        <button onclick="openDataManager()">🧰 Data Manager</button>
      </div>
      <div class="audit-log-list">
        ${users.map(u=>`
          <div class="audit-log-item">
            <b>${escapeHtml ? escapeHtml(u.name) : u.name} - ${escapeHtml ? escapeHtml(u.role) : u.role}</b>
            <small>${escapeHtml ? escapeHtml(u.username) : u.username}</small>
            <p>الصلاحيات: ${(u.permissions||[]).join(", ") || "كل الصلاحيات"}</p>
            <button onclick="dcos105EditUser('${u.id}')">تعديل</button>
            ${u.role!=="owner" ? `<button onclick="dcos105DeleteUser('${u.id}')">حذف</button>` : ""}
          </div>
        `).join("")}
      </div>
      <button onclick="backToHome()">رجوع</button>
    </div>`;
  const backBtn=document.getElementById("backBtn");
  if(backBtn)backBtn.style.display="block";
}
function dcos105CreateUser(){
  let users=dcos105EnsureAdmin();
  const name=prompt("اسم المستخدم الظاهر:");
  if(!name)return;
  const username=prompt("اسم الدخول:");
  if(!username)return;
  const role=prompt("الدور: owner / doctor / assistant / viewer","doctor") || "doctor";
  const perms=prompt("الصلاحيات مفصولة بفواصل:\npatients,prescriptions,appointments,finance,reports,sync,data,accounts", role==="doctor" ? "patients,prescriptions,appointments,reports" : "patients,appointments") || "";
  users.push({id:"u-"+Date.now(), name, username, pin:"", role, permissions:perms.split(",").map(x=>x.trim()).filter(Boolean), active:true, createdAt:new Date().toISOString()});
  dcos105WriteJson(DCOS_V105_USERS_KEY, users);
  dcos105Audit("account_create",{username,role});
  openAccountsManager();
}
function dcos105EditUser(id){
  let users=dcos105EnsureAdmin();
  let u=users.find(x=>x.id===id);
  if(!u)return;
  const name=prompt("الاسم:",u.name)||u.name;
  const role=prompt("الدور:",u.role)||u.role;
  const perms=prompt("الصلاحيات:",(u.permissions||[]).join(","))||"";
  u.name=name; u.role=role; u.permissions=perms.split(",").map(x=>x.trim()).filter(Boolean); u.updatedAt=new Date().toISOString();
  dcos105WriteJson(DCOS_V105_USERS_KEY, users);
  dcos105Audit("account_edit",{id,role});
  openAccountsManager();
}
function dcos105DeleteUser(id){
  let users=dcos105EnsureAdmin().filter(x=>x.id!==id || x.role==="owner");
  dcos105WriteJson(DCOS_V105_USERS_KEY, users);
  dcos105Audit("account_delete",{id});
  openAccountsManager();
}
(function(){
  dcos105EnsureAdmin();
  function injectV105Buttons(){
  clinicV5AppendDashboardButtons();
}
  if(typeof renderDashboard==="function" && !window.__dcosV105DashboardWrapped){
    const oldRender=renderDashboard;
    window.renderDashboard=function(){
      const r=oldRender.apply(this,arguments);
      setTimeout(injectV105Buttons,100);
      return r;
    };
    window.__dcosV105DashboardWrapped=true;
  }
  document.addEventListener("DOMContentLoaded",()=>setTimeout(injectV105Buttons,700));
})();

/* v15.13 HYBRID: legacy auth/dashboard/multiclinic patches after this point were removed.
   Clinic UI/features above remain intact; auth/accounts/dashboard are provided by v15 modules. */

/* v15.20 stable bridge: expose the actual active patient without changing legacy scope. */
window.DCOS_getActivePatient = function(){
  try { return patient || (typeof getCurrentPatient === 'function' ? getCurrentPatient() : null); }
  catch(e){ return null; }
};

/* v15.27 bridge: expose the actual lexical active patient safely for external modules. */
window.DCOS_setActivePatient = function(p){ patient = p || null; return patient; };
window.DCOS_getActivePatient = function(){ return patient || null; };
