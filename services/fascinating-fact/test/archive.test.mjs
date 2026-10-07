import test from "node:test";
import assert from "node:assert/strict";
import { archiveCurrent, archiveKey, historyPage, HISTORY_PAGE_SIZE } from "../dist/archive.js";
import { publication, validFactDate } from "../dist/domain.js";
import { candidate, review, MemoryStore } from "./fixtures.mjs";

test("legacy latest publication is archived idempotently without changing job state",async()=>{
  const store=new MemoryStore();
  const fact=publication(candidate,review,Date.parse("2026-10-04T01:00:00Z"));
  store.state={publication:fact,job:{day:"2026-10-05",attempts:2,status:"retry",nextAt:123}};
  store.alarmTime=123;const previous=structuredClone(store.state);
  await store.transaction(archiveCurrent);await store.transaction(archiveCurrent);
  assert.deepEqual(await store.get(archiveKey("2026-10-04")),fact);
  assert.deepEqual(store.state,previous);assert.equal(store.alarmTime,123);
  assert.equal((await store.list({prefix:"fact:"})).size,1);
});
test("migration never overwrites an existing archive and handles no publication",async()=>{
  const store=new MemoryStore();await store.transaction(archiveCurrent);
  assert.equal(store.records.size,0);
  const fact=publication(candidate,review,Date.parse("2026-10-04T01:00:00Z"));
  const archived={...fact,public:{...fact.public,title:"An existing immutable archive fact"}};
  store.state={publication:fact};store.records.set(archiveKey("2026-10-04"),archived);
  await store.transaction(archiveCurrent);assert.deepEqual(await store.get(archiveKey("2026-10-04")),archived);
});
test("migration failure leaves the old publication intact and can be retried",async()=>{
  const store=new MemoryStore();store.state={publication:publication(candidate,review,Date.parse("2026-10-04T01:00:00Z"))};
  const previous=structuredClone(store.state);
  await assert.rejects(store.transaction(tx=>archiveCurrent({...tx,put:async()=>{throw new Error("disk");}})));
  assert.deepEqual(store.state,previous);assert.equal(store.records.size,1);
  await store.transaction(archiveCurrent);assert.equal(store.records.size,2);
});
test("history has bounded exclusive pages and exposes metadata without evidence or fact bodies",async()=>{
  const store=new MemoryStore();
  for(let index=0;index<103;index++){
    const fact=publication(candidate,review,Date.parse("2026-01-01T01:00:00Z")+index*86400000);
    store.records.set(archiveKey(fact.public.fact_date),fact);
  }
  store.state={job:{day:"2026-04-14"}};
  const dates=[];let before;
  do {
    const entries=await store.list({prefix:"fact:",reverse:true,limit:HISTORY_PAGE_SIZE+1,...(before?{end:archiveKey(before)}:{})});
    const page=historyPage([...entries.values()]);
    assert.ok(page.facts.length<=50);
    for(const fact of page.facts)assert.deepEqual(Object.keys(fact),["id","fact_date","title","category","published_at"]);
    dates.push(...page.facts.map(fact=>fact.fact_date));before=page.next_before;
  } while(before);
  assert.equal(dates.length,103);assert.equal(new Set(dates).size,103);
  assert.deepEqual(dates,[...dates].sort().reverse());
  assert.deepEqual(historyPage([]),{schema_version:1,facts:[],next_before:null});
});
test("dates validate real UTC calendar dates including leap years",()=>{
  for(const date of ["2024-02-29","2026-10-04","2026-12-31"])assert.equal(validFactDate(date),true);
  for(const date of ["2026-02-29","2026-02-30","2026-13-01","2026-00-01","2026-01-00","2026-1-01","2026-10-04T00:00:00Z","../state"])assert.equal(validFactDate(date),false);
});
