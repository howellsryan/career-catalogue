import test from "node:test";
import assert from "node:assert/strict";
import { DailyJob } from "../dist/job.js";
import { FactError, approved, publication, validateCandidate } from "../dist/domain.js";
import { candidate, review, MemoryStore, deferred } from "./fixtures.mjs";
function setup(ai={generate:async()=>structuredClone(candidate),review:async()=>structuredClone(review)}) {
  const store=new MemoryStore(); let time=Date.parse("2026-10-04T01:00:00Z"), id=0;
  const events=[];
  const make=()=>new DailyJob(store,ai,()=>time,()=>String(++id),()=>0.25,(event,data)=>events.push({event,...data}));
  return {store,job:make(),make,events,day:"2026-10-04",setTime:x=>{time=x;},tick:x=>{time+=x;},now:()=>time};
}
test("one approved publication survives repeat schedules and concurrent alarms",async()=>{
  let generates=0,reviews=0;
  const s=setup({generate:async()=>{generates++;return candidate;},review:async()=>{reviews++;return review;}});
  assert.equal(await s.job.queue(s.day),"accepted");
  await Promise.all([s.job.alarm(),s.job.alarm(),s.job.alarm()]);
  assert.equal(generates,1);assert.equal(reviews,1);
  assert.equal(s.store.state.publication.public.id,s.day);
  assert.equal(await s.job.queue(s.day),"published");
  await s.job.alarm();
  assert.equal(generates,1);assert.equal(s.store.alarmTime,undefined);
});
test("simultaneous queue requests share a single job",async()=>{
  const s=setup(); const results=await Promise.all(Array.from({length:20},()=>s.job.queue(s.day)));
  assert.equal(results.filter(x=>x==="accepted").length,1);
  assert.equal(s.store.state.job.attempts,0);
});
test("rejections stop after exactly three attempts and preserve the previous fact",async()=>{
  let calls=0;
  const s=setup({generate:async()=>{calls++;return candidate;},review:async()=>({...review,factual:false})});
  const previous=publication(candidate,review,Date.parse("2026-10-03T01:00:00Z"));
  s.store.state={publication:previous};
  await s.job.queue(s.day);
  await s.job.alarm();
  assert.equal(s.store.alarmTime,s.now()+300000);
  s.tick(300000);await s.job.alarm();
  assert.equal(s.store.alarmTime,s.now()+600000);
  s.tick(600000);await s.job.alarm();await s.job.alarm();
  assert.equal(calls,3);assert.equal(s.store.state.job.status,"stopped");
  assert.deepEqual(s.store.state.publication,previous);
  assert.equal(s.events.filter(x=>x.event==="candidate_rejected").length,3);
});
test("network failure can recover on the next attempt",async()=>{
  let calls=0;
  const s=setup({generate:async()=>{if(++calls===1)throw new FactError("openai_network_failure");return candidate;},review:async()=>review});
  await s.job.queue(s.day);await s.job.alarm();s.tick(300000);await s.job.alarm();
  assert.equal(s.store.state.job.status,"succeeded");assert.equal(calls,2);
});
test("billing or permanent model error stops remaining attempts",async()=>{
  for(const code of ["openai_quota_or_billing","openai_configuration_rejected"]) {
    const s=setup({generate:async()=>{throw new FactError(code,true);},review:async()=>review});
    await s.job.queue(s.day);await s.job.alarm();s.tick(1000000);await s.job.alarm();
    assert.equal(s.store.state.job.attempts,1);assert.equal(s.store.state.job.status,"stopped");
  }
});
test("a duplicate alarm while generation is pending does not resubmit",async()=>{
  const pending=deferred();let calls=0;
  const s=setup({generate:()=>{calls++;return pending.promise;},review:async()=>review});
  await s.job.queue(s.day);const running=s.job.alarm();
  await new Promise(resolve=>setImmediate(resolve));
  await s.make().alarm();assert.equal(calls,1);
  pending.resolve(candidate);await running;assert.equal(s.store.state.job.status,"succeeded");
});
test("restart watchdog fences an interrupted request and rejects its late result",async()=>{
  const pending=deferred();let calls=0;
  const s=setup({generate:()=>{calls++;return calls===1?pending.promise:Promise.resolve(candidate);},review:async()=>review});
  await s.job.queue(s.day);const running=s.job.alarm();await new Promise(resolve=>setImmediate(resolve));
  s.tick(195000);await s.make().alarm();
  assert.equal(s.store.state.job.status,"retry");
  s.tick(300000);await s.make().alarm();
  const published=structuredClone(s.store.state.publication);
  pending.resolve({...candidate,title:"A different result arriving too late"});await running;
  assert.deepEqual(s.store.state.publication,published);assert.equal(calls,2);
});
test("UTC rollover discards late results and gives the next day a fresh allowance",async()=>{
  const pending=deferred();
  const s=setup({generate:()=>pending.promise,review:async()=>review});
  s.setTime(Date.parse("2026-10-04T23:59:00Z"));
  await s.job.queue(s.day);const running=s.job.alarm();await new Promise(resolve=>setImmediate(resolve));
  s.setTime(Date.parse("2026-10-05T00:00:00Z"));pending.resolve(candidate);await running;
  assert.equal(s.store.state.publication,undefined);
  assert.equal(s.store.state.job.status,"stopped");
  assert.equal(await s.job.queue("2026-10-04"),"obsolete");
  assert.equal(await s.job.queue("2026-10-05"),"accepted");
  assert.equal(s.store.state.job.attempts,0);
});
test("a rejected review and an interrupted review never publish",async()=>{
  const pending=deferred();let reviewCalls=0;
  const s=setup({generate:async()=>candidate,review:()=>{reviewCalls++;return pending.promise;}});
  await s.job.queue(s.day);const running=s.job.alarm();await new Promise(resolve=>setImmediate(resolve));
  s.tick(195000);await s.make().alarm();
  pending.resolve(review);await running;
  assert.equal(reviewCalls,1);assert.equal(s.store.state.publication,undefined);
});
test("bootstrap is permanently closed after any publication",async()=>{
  const s=setup();s.store.state={publication:publication(candidate,review,Date.parse("2026-10-03T01:00:00Z"))};
  assert.equal(await s.job.queue(s.day,true),"published");
  assert.equal(s.store.state.job,undefined);
});
test("empty claims, unsupported claims and citations cannot pass",()=>{
  assert.equal(approved({...review,claims:[]}),false);
  assert.equal(approved({...review,claims:[{claim:"unsupported",supported:false,source_urls:["https://research.example/paper"]}]}),false);
  assert.equal(approved({...review,claims:[{claim:"invented",supported:true,source_urls:["https://fake.example"]}]}),false);
  assert.throws(()=>validateCandidate({...candidate,fact:candidate.fact+" [1]"}));
});

test("every review gate must pass",async()=>{
  for(const gate of ["fascinating","specification","factual"]) {
    const s=setup({generate:async()=>candidate,review:async()=>({...review,[gate]:false})});
    await s.job.queue(s.day);await s.job.alarm();
    assert.equal(s.store.state.publication,undefined);assert.equal(s.store.state.job.status,"retry");
  }
});
test("publication storage failure cannot expose an uncommitted candidate",async()=>{
  const s=setup();await s.job.queue(s.day);
  const original=s.store.transaction.bind(s.store);
  let fail=true;
  s.store.transaction=cb=>original(async tx=>{
    const put=tx.put;
    tx.put=async(key,value)=>{
      if(value.publication && fail){fail=false;throw new Error("disk failure");}
      return put(key,value);
    };
    return cb(tx);
  });
  await s.job.alarm();
  assert.equal(s.store.state.publication,undefined);assert.equal(s.store.state.job.status,"retry");
});
