import test from "node:test";
import assert from "node:assert/strict";
import { OpenAI } from "../dist/ai.js";
import { candidate,review } from "./fixtures.mjs";
const quiet=()=>{};
const budget={reserve:async()=>{}};
const documents=[{...candidate.sources[0],text:candidate.sources[0].quote,organization:"research"}];
const evidence={generate:async()=>documents,review:async()=>documents};
function adapter(send,log=quiet,enabled=true,provider=evidence) {
  return new OpenAI("key","gpt-5.6-terra",send,log,enabled,provider);
}
function envelope(value) {
  return {id:"response-id",status:"completed",usage:{input_tokens:100,output_tokens:100},
    output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}]};
}
test("generation uses the free-group model and strict structured output",async()=>{
  let requests=0;
  const send=async(url,options)=>{
    requests++;assert.equal(url,"https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization,"Bearer key");
    const body=JSON.parse(options.body);
    assert.equal(body.model,"gpt-5.6-terra");assert.equal(body.max_output_tokens,4000);
    assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    assert.match(body.instructions,/No graphic violence/);
    return Response.json(envelope(candidate));
  };
  assert.deepEqual(await adapter(send).generate("science","2026-10-04",budget),candidate);
  assert.equal(requests,1);
});
test("review returns validated claim-level evidence from an independent request",async()=>{
  const send=async(url,options)=>{
    const body=JSON.parse(options.body);
    assert.match(body.instructions,/Independently check/);
    return Response.json(envelope(review));
  };
  assert.deepEqual(await adapter(send).review(candidate,"2026-10-04",budget),review);
});
test("fabricated URLs are rejected even with a passing model response",async()=>{
  const send=async()=>Response.json(envelope({...candidate,sources:[{...candidate.sources[0],url:"https://different.example/evidence"}]}));
  await assert.rejects(()=>adapter(send).generate("science","2026-10-04",budget),{code:"evidence_not_retrieved"});
});
test("empty evidence stops before reserving tokens or calling the model",async()=>{
  let calls=0,reservations=0;
  const ai=adapter(async()=>{calls++;return Response.json(envelope(candidate));},quiet,true,
    {generate:async()=>[],review:async()=>[]});
  await assert.rejects(()=>ai.generate("science","2026-10-04",{reserve:async()=>{reservations++;}}),{code:"evidence_unavailable"});
  assert.equal(calls,0);assert.equal(reservations,0);
});
test("quota rejection is permanent; throttling is retryable and never retried inside adapter",async()=>{
  for(const [status,code,expected,permanent] of [[429,"insufficient_quota","openai_quota_or_billing",true],[429,"rate_limit_exceeded","openai_transient",false],[400,"model_not_found","openai_configuration_rejected",true]]) {
    let calls=0;const events=[];
    const send=async()=>{calls++;return Response.json({error:{code}},{status});};
    const log=(event,data)=>events.push({event,...data});
    await assert.rejects(()=>adapter(send,log).generate("science","2026-10-04",budget),{code:expected,permanent});
    assert.equal(calls,1);
    assert.deepEqual(events,[{event:"openai_request_rejected",phase:"daily_fact_candidate",day:"2026-10-04",status,code,request_id:null}]);
  }
});
test("refusal and malformed output are rejected",async()=>{
  for(const payload of [{...envelope(candidate),status:"incomplete"},
      {...envelope(candidate),output:[{type:"message",content:[{type:"refusal"}]}]},
      {...envelope(candidate),output:[{type:"message",content:[{type:"output_text",text:"invalid"}]}]}]) {
    await assert.rejects(()=>adapter(async()=>Response.json(payload)).generate("science","2026-10-04",budget));
  }
});
test("disabled spending verification blocks persisted alarm work before external requests",async()=>{
  let calls=0,retrievals=0;
  const ai=adapter(async()=>{calls++;return Response.json(envelope(candidate));},quiet,false,
    {generate:async()=>{retrievals++;return documents;},review:async()=>{retrievals++;return documents;}});
  await assert.rejects(()=>ai.generate("science","2026-10-04",budget),{code:"openai_configuration_missing",permanent:true});
  await assert.rejects(()=>ai.review(candidate,"2026-10-04",budget),{code:"openai_configuration_missing",permanent:true});
  assert.equal(calls,0);assert.equal(retrievals,0);
});
test("transport is called without an adapter receiver in generation and review",async()=>{
  const send=async function(url,options) {
    assert.equal(this,undefined);
    const phase=JSON.parse(options.body).text.format.name;
    return Response.json(envelope(phase==="daily_fact_candidate"?candidate:review));
  };
  const ai=adapter(send);
  assert.deepEqual(await ai.generate("science","2026-10-04",budget),candidate);
  assert.deepEqual(await ai.review(candidate,"2026-10-04",budget),review);
});
test("a model outside the configured free group is refused without a paid fallback",async()=>{
  let calls=0;
  const ai=new OpenAI("key","gpt-5.6-sol",async()=>{calls++;return Response.json(envelope(candidate));},quiet,true,evidence);
  await assert.rejects(()=>ai.generate("science","2026-10-04",budget),{code:"openai_model_not_allowed",permanent:true});
  assert.equal(calls,0);
});
test("oversized input is rejected before reservation and transport",async()=>{
  let calls=0,reservations=0;
  const oversized={...documents[0],text:"x".repeat(41000)};
  const ai=adapter(async()=>{calls++;return Response.json(envelope(candidate));},quiet,true,{...evidence,generate:async()=>[oversized]});
  await assert.rejects(()=>ai.generate("science","2026-10-04",{reserve:async()=>{reservations++;}}),{code:"openai_input_limit"});
  assert.equal(calls,0);assert.equal(reservations,0);
});
test("an unsolicited hosted tool response cannot be accepted",async()=>{
  const payload={...envelope(candidate),output:[{type:"web_search_call",status:"completed"},...envelope(candidate).output]};
  await assert.rejects(()=>adapter(async()=>Response.json(payload)).generate("science","2026-10-04",budget),
    {code:"openai_unexpected_tool",permanent:true});
});
test("provider usage exceeding the conservative reservation stops generation permanently",async()=>{
  const payload={...envelope(candidate),usage:{input_tokens:50000,output_tokens:1000}};
  await assert.rejects(()=>adapter(async()=>Response.json(payload)).generate("science","2026-10-04",budget),
    {code:"token_reservation_exceeded",permanent:true});
});
test("different publisher hosts in the same organization cannot corroborate news",async()=>{
  const second={...candidate.sources[0],url:"https://alternate.example/paper",publisher:"Research Institute"};
  const news={...candidate,category:"news"};
  const checked={...review,sources:[{...candidate.sources[0],primary:false},{...second,primary:false}],
    claims:[{claim:"The specific discovery was announced.",supported:true,source_urls:[candidate.sources[0].url,second.url]}]};
  const provider={...evidence,review:async()=>[...documents,{...documents[0],...second,text:second.quote,organization:"research"}]};
  await assert.rejects(()=>adapter(async()=>Response.json(envelope(checked)),quiet,true,provider).review(news,"2026-10-04",budget),
    {code:"evidence_corroboration_missing"});
});
test("primary support for one claim cannot cover another unsupported secondary-only claim",async()=>{
  const second={...candidate.sources[0],url:"https://secondary.example/paper",publisher:"Secondary Publisher",primary:false};
  const checked={...review,sources:[...candidate.sources,second],claims:[
    {claim:"The primary finding.",supported:true,source_urls:[candidate.sources[0].url]},
    {claim:"A further comparison.",supported:true,source_urls:[second.url]}]};
  const provider={...evidence,review:async()=>[...documents,{...documents[0],...second,text:second.quote,organization:"secondary"}]};
  await assert.rejects(()=>adapter(async()=>Response.json(envelope(checked)),quiet,true,provider).review(candidate,"2026-10-04",budget),
    {code:"evidence_corroboration_missing"});
});
