(function(){
  'use strict';

  const VERSION='15.66-valarm-reminder';
  const QR_MODAL_ID='dcosAppointmentQrModal';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');

  function clinicInfo(){
    const h=window.Hybrid||{};
    const p=new URLSearchParams(location.search);
    const clinic=h.clinic||{};
    const name=String(clinic.name||p.get('clinicName')||localStorage.getItem('dcos_current_clinic_name')||'عيادة د. طاهر').trim();
    const phone=String(clinic.phone||localStorage.getItem('dcos_current_clinic_phone')||'').trim();
    const city=String(clinic.city||clinic.location||localStorage.getItem('dcos_current_clinic_city')||'').trim();
    return {name,phone,city};
  }

  function getPatient(fileNo){
    try{
      if(typeof window.findPatientByFileNo==='function') return window.findPatientByFileNo(fileNo);
      const arr=typeof window.getPatients==='function'?window.getPatients():[];
      return (arr||[]).find(p=>String(p.fileNo||'')===String(fileNo||''));
    }catch{return null}
  }

  function getAppointment(fileNo,index){
    const p=getPatient(fileNo);
    const a=p?.appointments?.[Number(index)];
    return p&&a?{patient:p,appointment:a,index:Number(index)}:null;
  }

  function normalizeDate(v){
    try{return typeof window.normalizeAppointmentDate==='function'?window.normalizeAppointmentDate(v):String(v||'')}catch{return String(v||'')}
  }
  function normalizeTime(v){
    try{return typeof window.normalizeAppointmentTime==='function'?window.normalizeAppointmentTime(v):String(v||'')}catch{return String(v||'')}
  }

  function dateParts(date,time){
    const d=normalizeDate(date).split('-').map(Number);
    const t=normalizeTime(time).split(':').map(Number);
    if(d.length<3||!d[0]||!d[1]||!d[2]) throw new Error('تاريخ الموعد غير صالح');
    return new Date(d[0],d[1]-1,d[2],t[0]||0,t[1]||0,0,0);
  }

  function icsDate(dt){
    return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
  }

  function icsEscape(v){
    return String(v??'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  }

  function foldLine(line){
    const out=[]; let rest=String(line);
    while(rest.length>70){out.push(rest.slice(0,70));rest=' '+rest.slice(70)}
    out.push(rest); return out.join('\r\n');
  }

  function buildICS(item){
    const {patient:p,appointment:a}=item;
    const clinic=clinicInfo();
    const start=dateParts(a.date,a.time);
    const end=new Date(start.getTime()+60*60*1000);
    const type=String(a.type||'موعد أسنان').trim()||'موعد أسنان';
    const doctor=String(a.doctorName||a.doctor||window.Hybrid?.account?.name||'').trim();
    const description=[
      `المريض: ${p.name||''}`,
      doctor?`الطبيب: ${doctor}`:'',
      a.note?`ملاحظات: ${a.note}`:'',
      clinic.phone?`هاتف العيادة: ${clinic.phone}`:'',
      'يرجى الحضور قبل الموعد بـ 10 دقائق.'
    ].filter(Boolean).join('\n');
    const location=[clinic.name,clinic.city].filter(Boolean).join(' - ');
    const uid=`dcos-${String(p.fileNo||'patient').replace(/[^a-zA-Z0-9_-]/g,'_')}-${start.getTime()}@dentalchain.local`;
    const lines=[
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Dental Chain OS//Appointment QR//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(`${type} - ${clinic.name}`)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      `LOCATION:${icsEscape(location)}`,
      'BEGIN:VALARM','TRIGGER:-PT24H','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(`تذكير بموعدك في ${clinic.name}`)}`,'END:VALARM',
      'END:VEVENT','END:VCALENDAR'
    ];
    return lines.map(foldLine).join('\r\n');
  }

  function buildVevent(item){
    const clinic=clinicInfo();
    const start=dateParts(item.appointment.date,item.appointment.time);
    return [
      'BEGIN:VEVENT',
      `SUMMARY:${icsEscape(`موعدك في ${clinic.name}`)}`,
      `DTSTART:${icsDate(start)}`,
      'DESCRIPTION:شكراً لثقتكم.',
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(`موعدك غداً في ${clinic.name}`)}`,
      'END:VALARM',
      'END:VEVENT'
    ].join('\r\n');
  }

  function makeCalendarDataUrl(ics){
    return 'data:text/calendar;charset=utf-8,'+encodeURIComponent(ics);
  }

  function closeModal(){document.getElementById(QR_MODAL_ID)?.remove()}

  function downloadICS(fileNo,index){
    const item=getAppointment(fileNo,index); if(!item)return alert('تعذر العثور على الموعد');
    try{
      const ics=buildICS(item);
      const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      const date=normalizeDate(item.appointment.date)||'appointment';
      a.href=url;a.download=`DentalChain-Appointment-${date}.ics`;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch(e){alert(e.message||'تعذر إنشاء ملف الموعد')}
  }


  function base64UrlUtf8(value){
    const bytes=new TextEncoder().encode(value);let binary='';
    bytes.forEach(b=>binary+=String.fromCharCode(b));
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  async function sendController(payload){
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),1400);
    try{
      const response=await fetch('http://127.0.0.1:8765/command',{
        method:'POST',mode:'cors',cache:'no-store',credentials:'omit',signal:controller.signal,
        headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
      });
      if(response.ok)return'direct';
    }catch{}finally{clearTimeout(timeout)}
    const encoded=base64UrlUtf8(JSON.stringify(payload));
    const link=document.createElement('a');link.href=`dentalchair://command?data=${encodeURIComponent(encoded)}`;
    link.style.display='none';document.body.appendChild(link);link.click();setTimeout(()=>link.remove(),500);return'fallback';
  }
  async function sendQrToChair(fileNo,index){
    const item=getAppointment(fileNo,index); if(!item)return alert('تعذر العثور على الموعد');
    try{
      const clinic=clinicInfo(),a=item.appointment,p=item.patient;
      const payload={
        action:'show_appointment_qr',
        patientName:String(p.name||''),
        fileNo:String(p.fileNo||''),
        date:normalizeDate(a.date),
        time:normalizeTime(a.time),
        type:String(a.type||'موعد أسنان'),
        clinicName:clinic.name,
        location:[clinic.name,clinic.city].filter(Boolean).join(' - '),
        notes:String(a.note||''),
        reminderHours:24,
        protocol:2
      };
      await sendController(payload);
    }catch(error){alert(error.message||'تعذر إرسال QR إلى الشاشة')}
  }

  function openQR(fileNo,index){
    const item=getAppointment(fileNo,index); if(!item)return alert('تعذر العثور على الموعد');
    let vevent;
    try{vevent=buildVevent(item)}catch(e){return alert(e.message||'تعذر إنشاء QR')}
    closeModal();
    const clinic=clinicInfo(), a=item.appointment, p=item.patient;
    const modal=document.createElement('div');
    modal.id=QR_MODAL_ID;modal.className='modal dcos-appointment-qr-modal';
    modal.innerHTML=`<div class="modalBox dcos-appointment-qr-box">
      <button class="dcos-qr-close" type="button" aria-label="إغلاق">×</button>
      <div class="dcos-qr-heading"><span>📅</span><div><h2>حفظ الموعد على الهاتف</h2><p>امسح الرمز لإضافة الموعد إلى التقويم مع تذكير قبل 24 ساعة.</p></div></div>
      <div class="dcos-qr-summary">
        <b>${esc(p.name||'')}</b>
        <span>${esc(normalizeDate(a.date))} — ${esc(typeof window.formatTime12==='function'?window.formatTime12(a.time):normalizeTime(a.time))}</span>
        <small>${esc(a.type||'موعد أسنان')} · ${esc(clinic.name)}</small>
      </div>
      <div id="dcosAppointmentQrCanvas" class="dcos-appointment-qr-canvas"></div>
      <div class="dcos-qr-actions">
        <button type="button" class="primary dcos-download-ics">⬇ تنزيل ملف الموعد</button>
        <button type="button" class="dcos-close-qr">إغلاق</button>
      </div>
      <small class="dcos-qr-help">يعتمد صوت التنبيه على إعدادات التقويم والإشعارات في الهاتف. إذا لم يفتح التقويم بعد المسح، استخدم زر تنزيل ملف الموعد.</small>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.dcos-qr-close').onclick=closeModal;
    modal.querySelector('.dcos-close-qr').onclick=closeModal;
    modal.querySelector('.dcos-download-ics').onclick=()=>downloadICS(fileNo,index);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
    const box=modal.querySelector('#dcosAppointmentQrCanvas');
    try{
      if(window.QRCode){
        new QRCode(box,{text:vevent,width:250,height:250,colorDark:'#082f49',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
      }else{
        box.innerHTML='<p class="dcos-qr-error">لم يتم تحميل مولّد QR. تأكد من الاتصال بالإنترنت مرة واحدة ثم أعد المحاولة.</p>';
      }
    }catch(e){
      box.innerHTML='<p class="dcos-qr-error">حجم تفاصيل الموعد كبير. استخدم زر تنزيل ملف الموعد.</p>';
    }
  }

  function parseAppointmentButton(row){
    const controls=[...row.querySelectorAll('button[onclick]')];
    for(const b of controls){
      const code=b.getAttribute('onclick')||'';
      const m=code.match(/(?:markAppointmentDone|deleteAppointment)\(['"]([^'"]+)['"]\s*,\s*(\d+)\)/);
      if(m)return {fileNo:m[1],index:Number(m[2]),anchor:b.parentElement||row};
    }
    return null;
  }

  function enhanceRows(root=document){
    root.querySelectorAll('.appointment-row').forEach(row=>{
      if(row.dataset.dcosQrReady==='1')return;
      const ref=parseAppointmentButton(row); if(!ref)return;
      const btn=document.createElement('button');
      btn.type='button';btn.className='dcos-appt-qr-btn';btn.textContent='📺 عرض QR الموعد';
      btn.title='عرض QR على شاشة الكرسي؛ اضغط Shift لفتحه على هذا الجهاز';
      btn.onclick=(event)=>event.shiftKey?openQR(ref.fileNo,ref.index):sendQrToChair(ref.fileNo,ref.index);
      ref.anchor.insertBefore(btn,ref.anchor.firstChild);
      row.dataset.dcosQrReady='1';
    });
  }

  window.DCOS_APPOINTMENT_QR={open:openQR,sendToChair:sendQrToChair,download:downloadICS,version:VERSION};
  let timer;
  const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>enhanceRows(document),80)};
  document.addEventListener('DOMContentLoaded',refresh);
  document.addEventListener('dcos:view-changed',refresh);
  new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true});
})();
