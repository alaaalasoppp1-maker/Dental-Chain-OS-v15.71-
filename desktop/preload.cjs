'use strict';

const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('DCOSDesktop',Object.freeze({
  isDesktop:true,
  platform:process.platform,
  patientStore:Object.freeze({
    load:clinicId=>ipcRenderer.invoke('patient-store:load',clinicId),
    save:(clinicId,record)=>ipcRenderer.invoke('patient-store:save',clinicId,record),
    info:()=>ipcRenderer.invoke('patient-store:info')
  })
}));
