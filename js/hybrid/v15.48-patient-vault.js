'use strict';
/* Dental Chain OS v15.73 compatibility adapter.
   The former localStorage vault is intentionally retired: full patient records now live in
   DCOSPatientStore (IndexedDB in browsers, SQLite in the Windows application).
*/
(function(){
  const VERSION='15.73-durable-vault-adapter';
  const store=window.DCOSPatientStore;
  if(!store){console.error('DCOSPatientStore is unavailable');return}

  function diagnostics(){return {...store.diagnostics(),version:VERSION}}
  window.DCOS_PATIENT_VAULT={
    version:VERSION,
    clinicId:()=>store.clinicId,
    read:()=>store.get(),
    save:list=>store.set(list),
    flush:()=>store.flush(),
    diagnostics
  };
  store.ready.then(()=>{
    document.documentElement.dataset.patientStorage='durable-v15.73';
    document.dispatchEvent(new CustomEvent('dcos:patient-vault-ready',{detail:diagnostics()}));
  });
})();
