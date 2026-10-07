import test from "node:test";
import assert from "node:assert/strict";
import { DailyJob } from "../dist/job.js";
import { candidate,review,MemoryStore } from "./fixtures.mjs";
test("legacy requests with unknown input usage cannot borrow an assumed safe allowance",async()=>{
  const store=new MemoryStore();let posts=0;
  store.state={job:{day:"2026-10-04",attempts:3,status:"stopped",nextAt:0,failure:"openai_timeout",failurePermanent:false}};
  const ai={generate:async(category,day,budget)=>{await budget.reserve(40000);posts++;return candidate;},review:async()=>review};
  const job=new DailyJob(store,ai,()=>Date.parse("2026-10-04T01:00:00Z"),()=>"resumed",()=>0,()=>{});
  await job.queue("2026-10-04",true);await job.alarm();
  assert.equal(posts,0);
  assert.equal(store.state.job.failure,"daily_token_budget_exhausted");
  assert.equal(store.state.job.status,"stopped");
});
