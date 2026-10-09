import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../dist/http.js";
import { publication } from "../dist/domain.js";
import { candidate,review } from "./fixtures.mjs";
const token="bootstrap-token-with-at-least-thirty-two-characters";
function env(fact=null,status="accepted") {
  const calls={reads:0,starts:0,dates:[],pages:[]};
  return {calls,value:{BOOTSTRAP_TOKEN:token,DAILY_FACT:{getByName(name){
    assert.equal(name,"daily-fact");return {getFact:async()=>{calls.reads++;return fact;},
      getFactByDate:async day=>{calls.dates.push(day);return fact?.fact_date===day?fact:null;},
      listFacts:async before=>{calls.pages.push(before);return {schema_version:1,facts:[],next_before:null};},
      start:async()=>{calls.starts++;return status;}};
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
test("operator retry requires its separate token and an empty POST for the current day",async()=>{
  const s=env();s.value.RECOVERY_TOKEN=token+"-recovery";
  let args;s.value.DAILY_FACT.getByName=()=>({start:async(...values)=>{args=values;s.calls.starts++;return "accepted";}});
  for(const [headers,method,suffix,body,status] of [
    [{Authorization:"Bearer "+token},"POST","",undefined,401],
    [{Authorization:"Bearer "+token+"-recovery"},"GET","",undefined,405],
    [{Authorization:"Bearer "+token+"-recovery"},"POST","?date=2026-10-09",undefined,400],
    [{Authorization:"Bearer "+token+"-recovery"},"POST","","{}",400]
  ]) {
    assert.equal((await handler.fetch(new Request("https://facts.example/internal/retry"+suffix,{headers,method,body}),s.value)).status,status);
  }
  assert.equal(s.calls.starts,0);
  const response=await handler.fetch(new Request("https://facts.example/internal/retry",{method:"POST",
    headers:{Authorization:"Bearer "+token+"-recovery"}}),s.value);
  assert.equal(response.status,202);assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.deepEqual(args,[new Date().toISOString().slice(0,10),false,true]);
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

test("bootstrap accepts an empty POST body stream",async()=>{
  const s=env();
  const request=new Request("https://facts.example/internal/bootstrap",{
    method:"POST",headers:{Authorization:"Bearer "+token,"Content-Length":"0"},body:new Uint8Array()
  });
  assert.notEqual(request.body,null);
  const response=await handler.fetch(request,s.value);
  assert.equal(response.status,202);assert.equal(s.calls.starts,1);
});
test("bootstrap rejects streamed payloads despite a zero content length",async()=>{
  const s=env();let cancelled=false;
  const body=new ReadableStream({
    start(controller){controller.enqueue(new Uint8Array());controller.enqueue(new TextEncoder().encode('{"prompt":"override"}'));},
    cancel(){cancelled=true;}
  });
  const request=new Request("https://facts.example/internal/bootstrap",{
    method:"POST",headers:{Authorization:"Bearer "+token,"Content-Length":"0"},body,duplex:"half"
  });
  const response=await handler.fetch(request,s.value);
  assert.equal(response.status,400);assert.equal(s.calls.starts,0);assert.equal(cancelled,true);
});
test("bootstrap rejects query parameters with an empty body stream",async()=>{
  const s=env();
  const request=new Request("https://facts.example/internal/bootstrap?refresh=true",{
    method:"POST",headers:{Authorization:"Bearer "+token},body:new Uint8Array()
  });
  const response=await handler.fetch(request,s.value);
  assert.equal(response.status,400);assert.equal(s.calls.starts,0);
});

test("archived reads expose public fields only and immutable caching",async()=>{
  const expected=publication(candidate,review,Date.parse("2026-10-03T01:00:00Z")).public;
  const s=env(expected);
  const response=await handler.fetch(new Request("https://facts.example/v1/facts/2026-10-03"),s.value);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),expected);
  assert.match(response.headers.get("Cache-Control"),/max-age=86400, immutable/);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),"*");
  const missing=await handler.fetch(new Request("https://facts.example/v1/facts/2026-10-02"),s.value);
  assert.equal(missing.status,404);assert.deepEqual(await missing.json(),{error:"fact_not_found"});
  assert.equal(missing.headers.get("Cache-Control"),"no-store");
  assert.equal(s.calls.reads,0);assert.equal(s.calls.starts,0);
});
test("history passes the exclusive pagination cursor and caches metadata briefly",async()=>{
  const s=env();
  for(const suffix of ["","?before=2026-10-03"]) {
    const response=await handler.fetch(new Request("https://facts.example/v1/facts"+suffix),s.value);
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{schema_version:1,facts:[],next_before:null});
    assert.match(response.headers.get("Cache-Control"),/s-maxage=60/);
  }
  assert.deepEqual(s.calls.pages,[undefined,"2026-10-03"]);assert.equal(s.calls.starts,0);
});
test("invalid archive dates and queries never access storage or generation",async()=>{
  const s=env();
  for(const suffix of ["/2026-02-30","/2026-2-01","/2025-02-29","/2026-10-03/extra","/2026-10-03?refresh=1",
    "?before=2026-02-30","?before=","?before=2026-10-03&before=2026-10-02","?refresh=1"]) {
    assert.equal((await handler.fetch(new Request("https://facts.example/v1/facts"+suffix),s.value)).status,400,suffix);
  }
  assert.deepEqual(s.calls.dates,[]);assert.deepEqual(s.calls.pages,[]);assert.equal(s.calls.starts,0);
});
test("archive HEAD, OPTIONS and rejected write methods never start generation",async()=>{
  const s=env(publication(candidate,review,Date.parse("2026-10-03T01:00:00Z")).public);
  for(const path of ["/v1/facts","/v1/facts/2026-10-03"]) {
    const head=await handler.fetch(new Request("https://facts.example"+path,{method:"HEAD"}),s.value);
    assert.equal(head.status,200);assert.equal(await head.text(),"");
    const options=await handler.fetch(new Request("https://facts.example"+path,{method:"OPTIONS"}),s.value);
    assert.equal(options.status,204);
    const write=await handler.fetch(new Request("https://facts.example"+path,{method:"POST"}),s.value);
    assert.equal(write.status,405);
  }
  assert.equal(s.calls.pages.length,1);assert.equal(s.calls.dates.length,1);assert.equal(s.calls.starts,0);
});
test("archive storage errors are uncached 503s without AI work",async()=>{
  const s=env();const fail=async()=>{throw new Error("storage");};
  s.value.DAILY_FACT.getByName=()=>({getFactByDate:fail,listFacts:fail});
  for(const path of ["/v1/facts","/v1/facts/2026-10-03"]) {
    const response=await handler.fetch(new Request("https://facts.example"+path),s.value);
    assert.equal(response.status,503);assert.equal(response.headers.get("Cache-Control"),"no-store");
  }
  assert.equal(s.calls.starts,0);
});
