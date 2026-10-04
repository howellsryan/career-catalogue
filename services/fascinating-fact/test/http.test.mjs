import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../dist/http.js";
import { publication } from "../dist/domain.js";
import { candidate,review } from "./fixtures.mjs";
const token="bootstrap-token-with-at-least-thirty-two-characters";
function env(fact=null,status="accepted") {
  const calls={reads:0,starts:0};
  return {calls,value:{BOOTSTRAP_TOKEN:token,DAILY_FACT:{getByName(name){
    assert.equal(name,"daily-fact");return {getFact:async()=>{calls.reads++;return fact;},start:async()=>{calls.starts++;return status;}};
  }}}};
}
test("public reads never start jobs; missing fact returns uncached 503",async()=>{
  const s=env();const response=await handler.fetch(new Request("https://facts.example/v1/fact"),s.value);
  assert.equal(response.status,503);assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.deepEqual(await response.json(),{error:"fact_unavailable"});assert.equal(s.calls.starts,0);
});
test("JSON is identical for readers and excludes internal evidence or stale flags",async()=>{
  const expected=publication(candidate,review,Date.parse("2026-10-03T01:00:00Z")).public;
  const s=env(expected);const responses=await Promise.all(Array.from({length:20},()=>handler.fetch(new Request("https://facts.example/v1/fact"),s.value)));
  for(const r of responses) {
    assert.equal(r.status,200);assert.equal(r.headers.get("Access-Control-Allow-Origin"),"*");
    assert.match(r.headers.get("Cache-Control"),/s-maxage=60/);
    assert.deepEqual(await r.json(),expected);
  }
  assert.equal(s.calls.starts,0);
});
test("HEAD and OPTIONS are supported without AI work",async()=>{
  const s=env(publication(candidate,review,Date.now()).public);
  const head=await handler.fetch(new Request("https://facts.example/v1/fact",{method:"HEAD"}),s.value);
  assert.equal(head.status,200);assert.equal(await head.text(),"");
  const options=await handler.fetch(new Request("https://facts.example/v1/fact",{method:"OPTIONS"}),s.value);
  assert.equal(options.status,204);assert.equal(s.calls.reads,1);assert.equal(s.calls.starts,0);
});
test("unsupported methods, queries and refresh paths cause no work",async()=>{
  const s=env();
  for(const [path,method,status] of [["/v1/fact?refresh=true","GET",400],["/v1/fact","POST",405],["/refresh","GET",404]]) {
    const r=await handler.fetch(new Request("https://facts.example"+path,{method}),s.value);
    assert.equal(r.status,status);
  }
  assert.equal(s.calls.reads,0);assert.equal(s.calls.starts,0);
});
test("bootstrap authenticates before accessing the singleton",async()=>{
  const s=env();
  const r=await handler.fetch(new Request("https://facts.example/internal/bootstrap",{method:"POST",headers:{Authorization:"Bearer incorrect"}}),s.value);
  assert.equal(r.status,401);assert.equal(s.calls.starts,0);
});
test("authenticated bootstrap accepts only an empty initial request",async()=>{
  const s=env();const headers={Authorization:"Bearer "+token};
  const r=await handler.fetch(new Request("https://facts.example/internal/bootstrap",{method:"POST",headers}),s.value);
  assert.equal(r.status,202);assert.equal(r.headers.get("Cache-Control"),"no-store");assert.equal(s.calls.starts,1);
  const bad=await handler.fetch(new Request("https://facts.example/internal/bootstrap",{method:"POST",headers,body:'{"prompt":"override"}'}),s.value);
  assert.equal(bad.status,400);assert.equal(s.calls.starts,1);
});
test("bootstrap refuses closed, stopped and unconfigured jobs",async()=>{
  for(const [result,status] of [["published",409],["stopped",409],["unconfigured",503]]) {
    const s=env(null,result);
    const r=await handler.fetch(new Request("https://facts.example/internal/bootstrap",{method:"POST",headers:{Authorization:"Bearer "+token}}),s.value);
    assert.equal(r.status,status);assert.equal(r.headers.get("Cache-Control"),"no-store");
  }
});
test("storage failure returns 503 and never invokes generation",async()=>{
  const s=env();s.value.DAILY_FACT.getByName=()=>({getFact:async()=>{throw new Error("storage");}});
  assert.equal((await handler.fetch(new Request("https://facts.example/v1/fact"),s.value)).status,503);
  assert.equal(s.calls.starts,0);
});
