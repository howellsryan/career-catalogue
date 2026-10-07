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
test("rejections stop after exactly ten attempts and preserve the previous fact",async()=>{
  let calls=0;
  const s=setup({generate:async()=>{calls++;return candidate;},review:async()=>({...review,factual:false})});
  const previous=publication(candidate,review,Date.parse("2026-10-03T01:00:00Z"));
  s.store.state={publication:previous};
  await s.job.queue(s.day);
  for(let attempt=1;attempt<=10;attempt++) {
    await s.job.alarm();
    assert.equal(calls,attempt);
    if(attempt<10) {
      const delay=attempt===1?300000:600000;
      assert.equal(s.store.state.job.status,"retry");
      assert.equal(s.store.alarmTime,s.now()+delay);
      s.tick(delay);
    }
  }
  await s.job.alarm();
  assert.equal(calls,10);assert.equal(s.store.state.job.attempts,10);
  assert.equal(s.store.state.job.status,"stopped");assert.equal(s.store.alarmTime,undefined);
  assert.deepEqual(s.store.state.publication,previous);
  assert.equal(s.events.filter(x=>x.event==="candidate_rejected").length,10);
});
test("bootstrap resumes the legacy exhausted job without resetting its three attempts",async()=>{
  const s=setup();
  s.store.state={job:{day:s.day,attempts:3,status:"stopped",nextAt:s.now(),failure:"evidence_not_retrieved"}};
  assert.equal(await s.job.queue(s.day),"stopped");
  const results=await Promise.all(Array.from({length:20},()=>s.job.queue(s.day,true)));
  assert.equal(results.filter(x=>x==="accepted").length,1);
  assert.equal(results.filter(x=>x==="pending").length,19);
  assert.equal(s.store.state.job.attempts,3);
  await Promise.all([s.job.alarm(),s.job.alarm()]);
  assert.equal(s.store.state.job.attempts,4);assert.equal(s.store.state.job.status,"succeeded");
  assert.equal(s.events.filter(x=>x.event==="attempt_started").length,1);
  assert.equal(await s.job.queue(s.day,true),"published");
});
test("bootstrap never resumes billing, permanent, unknown legacy, or fully exhausted jobs",async()=>{
  for(const patch of [
    {failure:"openai_quota_or_billing"}, {failure:"openai_configuration_rejected"},
    {failure:"openai_configuration_missing"}, {failure:"unknown_legacy_failure"},
    {failure:undefined}, {failure:"day_expired"},
    {failure:"evidence_not_retrieved",failurePermanent:true},
    {attempts:10,failure:"review_rejected",failurePermanent:false}
  ]) {
    const s=setup();
    s.store.state={job:{day:s.day,attempts:3,status:"stopped",nextAt:s.now(),...patch}};
    const previous=structuredClone(s.store.state);
    assert.equal(await s.job.queue(s.day,true),"stopped");
    assert.deepEqual(s.store.state,previous);assert.equal(s.store.alarmTime,undefined);
  }
});
test("persisted retryability allows recovery within the larger allowance",async()=>{
  const s=setup();
  s.store.state={job:{day:s.day,attempts:7,status:"stopped",nextAt:s.now(),failure:"new_retryable_failure",failurePermanent:false}};
  assert.equal(await s.job.queue(s.day,true),"accepted");
  await s.job.alarm();assert.equal(s.store.state.job.attempts,8);
  assert.equal(s.store.state.job.status,"succeeded");
});
test("network failure can recover on the next attempt",async()=>{
  let calls=0;
  const s=setup({generate:async()=>{if(++calls===1)throw new FactError("openai_network_failure");return candidate;},review:async()=>review});
  await s.job.queue(s.day);await s.job.alarm();s.tick(300000);await s.job.alarm();
  assert.equal(s.store.state.job.status,"succeeded");assert.equal(calls,2);
});
test("billing or permanent model error stops remaining attempts",async()=>{
  for(const code of ["openai_quota_or_billing","openai_configuration_rejected","future_permanent_failure"]) {
    const s=setup({generate:async()=>{throw new FactError(code,true);},review:async()=>review});
    await s.job.queue(s.day);await s.job.alarm();s.tick(1000000);await s.job.alarm();
    assert.equal(s.store.state.job.attempts,1);assert.equal(s.store.state.job.status,"stopped");
    assert.equal(s.store.state.job.failurePermanent,true);
    assert.equal(await s.job.queue(s.day,true),"stopped");
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
  assert.equal(await s.store.get("fact:"+s.day),undefined);
});

test("each successful day is archived while the latest publication advances",async()=>{
  const s=setup();await s.job.queue(s.day);await s.job.alarm();
  const first=structuredClone(s.store.state.publication);
  s.setTime(Date.parse("2026-10-05T01:00:00Z"));
  await s.job.queue("2026-10-05");await s.job.alarm();
  assert.deepEqual(await s.store.get("fact:2026-10-04"),first);
  assert.deepEqual(await s.store.get("fact:2026-10-05"),s.store.state.publication);
  assert.equal(s.store.state.publication.public.fact_date,"2026-10-05");
  await s.job.alarm();assert.equal((await s.store.list({prefix:"fact:"})).size,2);
});
test("failed next-day generation retains the latest fact and never archives a candidate",async()=>{
  let reject=false;
  const s=setup({generate:async()=>candidate,review:async()=>({...review,factual:!reject})});
  await s.job.queue(s.day);await s.job.alarm();
  const first=structuredClone(s.store.state.publication);reject=true;
  s.setTime(Date.parse("2026-10-05T01:00:00Z"));
  await s.job.queue("2026-10-05");await s.job.alarm();
  assert.deepEqual(s.store.state.publication,first);assert.deepEqual(await s.store.get("fact:2026-10-04"),first);
  assert.equal(await s.store.get("fact:2026-10-05"),undefined);
});
test("archive storage failure rolls back latest publication and retries within allowance",async()=>{
  const s=setup();await s.job.queue(s.day);
  const transaction=s.store.transaction.bind(s.store);let fail=true;
  s.store.transaction=cb=>transaction(async tx=>{
    const put=tx.put;
    tx.put=async(key,value)=>{
      if(key.startsWith("fact:") && fail){fail=false;throw new Error("archive disk failure");}
      return put(key,value);
    };
    return cb(tx);
  });
  await s.job.alarm();
  assert.equal(s.store.state.publication,undefined);assert.equal(await s.store.get("fact:"+s.day),undefined);
  assert.equal(s.store.state.job.status,"retry");
  s.tick(300000);await s.job.alarm();
  assert.equal(s.store.state.job.status,"succeeded");assert.equal(s.store.state.job.attempts,2);
  assert.deepEqual(await s.store.get("fact:"+s.day),s.store.state.publication);
});
