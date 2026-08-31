'use strict';

const {app,BrowserWindow,ipcMain,shell}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {createPatientStore}=require('./patient-store.cjs');

const WEB_ROOT=path.resolve(__dirname,'..');
const mime={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'
};
let server=null;
let window=null;
let patientStore=null;

function allowedFile(file){
  const relative=path.relative(WEB_ROOT,file).replaceAll('\\','/');
  if(relative.startsWith('..')||path.isAbsolute(relative))return false;
  return !/^(?:desktop|tests|tools|dist|node_modules|\.github)(?:\/|$)/.test(relative)&&
    !/^(?:package(?:-lock)?\.json|firebase\.json)$/i.test(relative);
}
function startServer(){
  return new Promise((resolve,reject)=>{
    server=http.createServer((request,response)=>{
      try{
        const url=new URL(request.url,'http://127.0.0.1');
        let requested=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
        let file=path.resolve(WEB_ROOT,requested);
        if(!allowedFile(file)){response.writeHead(403);response.end('Forbidden');return}
        if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
        fs.readFile(file,(error,data)=>{
          if(error){response.writeHead(error.code==='ENOENT'?404:500);response.end('Not found');return}
          response.writeHead(200,{
            'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream',
            'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
          });
          response.end(data);
        });
      }catch{response.writeHead(400);response.end('Bad request')}
    });
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve(server.address().port));
  });
}
function installIpc(){
  ipcMain.handle('patient-store:load',(_event,clinicId)=>patientStore.load(clinicId));
  ipcMain.handle('patient-store:save',(_event,clinicId,record)=>patientStore.save(clinicId,record));
  ipcMain.handle('patient-store:info',()=>({backend:'sqlite',path:patientStore.path}));
}
async function createWindow(){
  const port=await startServer();
  window=new BrowserWindow({
    width:1440,height:940,minWidth:1024,minHeight:700,show:false,
    backgroundColor:'#f4f8fc',autoHideMenuBar:true,
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),
      contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,
      spellcheck:false
    }
  });
  window.webContents.setWindowOpenHandler(({url})=>{
    if(/^https?:\/\//i.test(url))shell.openExternal(url);
    return {action:'deny'};
  });
  window.webContents.on('will-navigate',(event,url)=>{
    const local=`http://127.0.0.1:${port}/`;
    if(!url.startsWith(local)){event.preventDefault();if(/^https?:\/\//i.test(url))shell.openExternal(url)}
  });
  window.once('ready-to-show',()=>window.show());
  await window.loadURL(`http://127.0.0.1:${port}/index.html?desktop=1`);
  // A very fast renderer can emit ready-to-show while loadURL is resolving.
  if(!window.isVisible())window.show();
}

if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus()}});
  app.whenReady().then(async()=>{
    const dataDirectory=path.join(app.getPath('documents'),'Dental Chain OS','Data');
    patientStore=createPatientStore(path.join(dataDirectory,'dental-chain-os.sqlite'));
    installIpc();
    await createWindow();
  }).catch(error=>{console.error(error);app.quit()});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>{try{server?.close()}catch{}try{patientStore?.close()}catch{}});
}
