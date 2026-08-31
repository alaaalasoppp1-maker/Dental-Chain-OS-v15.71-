'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');

function safeClinicId(value){
  return String(value||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120)||'taher-main-clinic';
}

function createPatientStore(databasePath){
  fs.mkdirSync(path.dirname(databasePath),{recursive:true});
  const database=new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS clinic_store (
      clinic_id TEXT PRIMARY KEY NOT NULL,
      record_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const readStatement=database.prepare('SELECT record_json FROM clinic_store WHERE clinic_id = ?');
  const writeStatement=database.prepare(`
    INSERT INTO clinic_store (clinic_id, record_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(clinic_id) DO UPDATE SET
      record_json = excluded.record_json,
      updated_at = excluded.updated_at
  `);

  function load(clinicId){
    const row=readStatement.get(safeClinicId(clinicId));
    if(!row)return null;
    try{return JSON.parse(row.record_json)}catch(error){
      throw new Error(`تعذر قراءة سجل العيادة المحلي: ${error.message}`);
    }
  }
  function save(clinicId,record){
    const normalized={
      schema:'dcos-patient-store-v1',
      patients:Array.isArray(record?.patients)?record.patients:[],
      backups:Array.isArray(record?.backups)?record.backups.slice(0,1):[]
    };
    const json=JSON.stringify(normalized);
    database.exec('BEGIN IMMEDIATE');
    try{
      writeStatement.run(safeClinicId(clinicId),json,new Date().toISOString());
      database.exec('COMMIT');
    }catch(error){
      try{database.exec('ROLLBACK')}catch{}
      throw error;
    }
    return {ok:true,count:normalized.patients.length};
  }
  function close(){database.close()}
  return {load,save,close,path:databasePath};
}

module.exports={createPatientStore,safeClinicId};
