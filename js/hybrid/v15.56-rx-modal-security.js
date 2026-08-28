(function(){
  'use strict';

  function portalVisitModal(){
    var modal=document.getElementById('visitModal');
    if(!modal || modal.parentElement===document.body) return;
    document.body.appendChild(modal);
  }

  function addInstructionHelp(){
    var field=document.getElementById('readyInstructions');
    if(!field || field.dataset.redHelpReady==='1') return;
    field.dataset.redHelpReady='1';
    var help=document.createElement('small');
    help.className='rx-instruction-help';
    help.innerHTML='لتلوين كلمة أو جملة بالأحمر في العرض والطباعة، ضعها بين قوسين مزدوجين، مثال: <b>[[بعد الطعام]]</b>';
    field.insertAdjacentElement('afterend',help);
  }

  function watchUI(){
    portalVisitModal();
    addInstructionHelp();
    var root=document.getElementById('output')||document.body;
    var observer=new MutationObserver(function(){
      portalVisitModal();
      addInstructionHelp();
    });
    observer.observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',watchUI,{once:true});
  else watchUI();
})();
