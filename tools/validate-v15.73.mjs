import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const index=read('index.html');
const storage=read('js/hybrid/v15.73-patient-storage.js');
const vault=read('js/hybrid/v15.48-patient-vault.js');
const bridge=read('js/hybrid/clinic-bridge.js');
const app=read('app.js');
const desktop=read('desktop/main.cjs');
const preload=read('desktop/preload.cjs');

for(const relative of [
  'js/hybrid/v15.73-patient-storage.js','desktop/main.cjs','desktop/preload.cjs',
  'desktop/patient-store.cjs','tests/desktop-patient-store.test.cjs','package.json'
])assert.ok(fs.existsSync(path.join(root,relative)),`Missing ${relative}`);

assert.ok(index.indexOf('v15.73-patient-storage.js?v=15_73')<index.indexOf('app.js?v=15_73'),'Patient store must load before app.js');
for(const token of [
  "DB_NAME='dcos-patient-store-v15'","backend='sqlite'","backend='indexeddb'",
  'cleanupLegacy();','Large localStorage copies are removed only after the durable write succeeds',
  'getBackups,setBackups','navigator.storage?.persist'
])assert.ok(storage.includes(token),`Missing durable storage token ${token}`);

assert.ok(!vault.includes('localStorage.setItem(K.patients'),'Legacy vault still writes full patients to localStorage');
assert.ok(bridge.includes('patientStore()?.set?.(merged)'),'Cloud merge must use durable storage');
assert.ok(bridge.includes('await patientStore()?.ready'),'Login must wait for local migration');
assert.ok(app.includes('window.DCOSPatientStore.set(list)'),'Base patient save must use durable storage');
assert.ok(app.includes('window.DCOSPatientStore.setBackups'),'Automatic backups must use durable storage');

for(const token of ['contextIsolation:true','nodeIntegration:false','sandbox:true','webSecurity:true'])
  assert.ok(desktop.includes(token),`Missing Electron security setting ${token}`);
assert.ok(preload.includes("contextBridge.exposeInMainWorld('DCOSDesktop'"),'Missing narrow preload bridge');

const packageJson=JSON.parse(read('package.json'));
assert.equal(packageJson.version,'15.73.0');
assert.equal(packageJson.build.productName,'Dental Chain OS');
assert.ok(packageJson.build.win.target.some(target=>target.target==='portable'));
assert.ok(packageJson.build.win.target.some(target=>target.target==='nsis'));

console.log('Dental Chain OS v15.73 durable storage and desktop validation passed');
