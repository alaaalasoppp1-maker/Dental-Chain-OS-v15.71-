'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createPatientStore}=require('../desktop/patient-store.cjs');

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dcos-store-'));
const database=path.join(directory,'patients.sqlite');
let store=createPatientStore(database);
assert.equal(store.load('clinic-a'),null);
assert.deepEqual(store.save('clinic-a',{patients:[{id:'P-1',name:'اختبار',plans:[{id:'PLAN-1'}]}],backups:[]}),{ok:true,count:1});
store.close();
store=createPatientStore(database);
assert.equal(store.load('clinic-a').patients[0].plans[0].id,'PLAN-1');
assert.equal(store.load('clinic-b'),null);
store.close();
fs.rmSync(directory,{recursive:true,force:true});
console.log('Desktop SQLite patient store test passed');
