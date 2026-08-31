import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const index = read("index.html");
const clinical = read("js/hybrid/v15.70-doctor-assistant-link.js");
const tooth = read("js/hybrid/v15.72-smart-tooth-services.js");

for (const relative of [
  "css/v15.72-smart-tooth-services.css",
  "js/hybrid/v15.72-smart-tooth-services.js",
  "js/hybrid/v15.70-doctor-assistant-link.js",
  "js/shared/clinical-contract.js"
]) assert.ok(fs.existsSync(path.join(root, relative)), `Missing ${relative}`);

for (const token of [
  "v15.72-smart-tooth-services.css?v=15_72",
  "v15.72-smart-tooth-services.js?v=15_72"
]) assert.ok(index.includes(token), `Missing index reference ${token}`);

for (const token of [
  'event.type==="assistant_event"', "plan.clinicalEvents", "payload.details",
  "lastAssistantAction", "تُسجّل هذه المرحلة تلقائياً من تطبيق مساعد الطبيب"
]) assert.ok(clinical.includes(token), `Missing clinical-link token ${token}`);

for (const token of [
  'const VERSION="15.72"', "clinicServiceNames", "serviceRecords", "openSmartToothModal",
  "إضافة جسر", "خزف معدن", "زركون", "dentalBridges", "dcos-tooth-service-dots"
]) assert.ok(tooth.includes(token), `Missing smart-tooth token ${token}`);

const localRefs = [...index.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)]
  .map(match => match[1])
  .filter(value => !/^(?:https?:|data:|#)/.test(value));
for (const relative of localRefs) assert.ok(fs.existsSync(path.join(root, relative)), `Missing local index asset ${relative}`);

console.log("Dental Chain OS v15.72 validation passed");
