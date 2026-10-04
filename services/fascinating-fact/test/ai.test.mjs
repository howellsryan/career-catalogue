import test from "node:test";
import assert from "node:assert/strict";
import { OpenAI, CONTENT_RULES } from "../dist/ai.js";
import { candidate,review } from "./fixtures.mjs";
const quiet=()=>{};
function envelope(value,urls=value.sources.map(x=>x.url)) {
  return {id:"response-id",status:"completed",usage:{input_tokens:100,output_tokens:100},
    output:[{type:"web_search_call",status:"completed",action:{sources:urls.map(url=>({url}))}},
      {type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}]};
}
test("generation uses configured model, bounded tools and strict structured output",async()=>{
  let requests=0;
  const send=async(url,options)=>{
    requests++;assert.equal(url,"https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization,"Bearer dedicated-test-key");
    const body=JSON.parse(options.body);
    assert.equal(body.model,"gpt-6-sol");assert.equal(body.max_output_tokens,4000);
    assert.equal(body.max_tool_calls,4);assert.equal(body.store,false);
    assert.equal(body.text.format.strict,true);
    assert.match(body.instructions,/No graphic violence/);
    return Response.json(envelope(candidate));
  };
  assert.deepEqual(await new OpenAI("dedicated-test-key","gpt-6-sol",send,quiet).generate("science","2026-10-04"),candidate);
  assert.equal(requests,1);
});
test("review independently searches and returns claim-level evidence",async()=>{
  const send=async(url,options)=>{
    const body=JSON.parse(options.body);
    assert.match(body.instructions,/Independently retrieve evidence/);
    return Response.json(envelope(review));
  };
  assert.deepEqual(await new OpenAI("key","model",send,quiet).review(candidate,"2026-10-04"),review);
});
test("fabricated URLs are rejected even with a passing model response",async()=>{
  const send=async()=>Response.json(envelope(candidate,["https://different.example/evidence"]));
  await assert.rejects(()=>new OpenAI("key","model",send,quiet).generate("science","2026-10-04"),{code:"evidence_not_retrieved"});
});
test("a response without evidence retrieval is rejected",async()=>{
  const response=envelope(candidate);response.output.shift();
  await assert.rejects(()=>new OpenAI("key","model",async()=>Response.json(response),quiet).generate("science","2026-10-04"),{code:"evidence_search_missing"});
});
test("quota rejection is permanent; throttling is retryable and never retried inside adapter",async()=>{
  for(const [status,code,expected,permanent] of [[429,"insufficient_quota","openai_quota_or_billing",true],[429,"rate_limit_exceeded","openai_transient",false],[400,"model_not_found","openai_configuration_rejected",true]]) {
    let calls=0;const events=[];
    const send=async()=>{calls++;return Response.json({error:{code}},{status});};
    const log=(event,data)=>events.push({event,...data});
    await assert.rejects(()=>new OpenAI("key","model",send,log).generate("science","2026-10-04"),{code:expected,permanent});
    assert.equal(calls,1);
    assert.deepEqual(events,[{event:"openai_request_rejected",phase:"daily_fact_candidate",day:"2026-10-04",status,code,request_id:null}]);
  }
});
test("refusal and malformed output are rejected",async()=>{
  for(const payload of [{...envelope(candidate),status:"incomplete"},
      {...envelope(candidate),output:[{type:"web_search_call",status:"completed",action:{sources:[]}},{type:"message",content:[{type:"refusal"}]}]}]) {
    await assert.rejects(()=>new OpenAI("key","model",async()=>Response.json(payload),quiet).generate("science","2026-10-04"));
  }
});

test("disabled budget verification blocks persisted alarm work before an external request",async()=>{
  let calls=0;
  const ai=new OpenAI("key","model",async()=>{calls++;return Response.json(envelope(candidate));},quiet,false);
  await assert.rejects(()=>ai.generate("science","2026-10-04"),{code:"openai_configuration_missing",permanent:true});
  await assert.rejects(()=>ai.review(candidate,"2026-10-04"),{code:"openai_configuration_missing",permanent:true});
  assert.equal(calls,0);
});

test("transport is called without an adapter receiver in generation and review",async()=>{
  const send=async function(url,options) {
    assert.equal(this,undefined);
    const phase=JSON.parse(options.body).text.format.name;
    return Response.json(envelope(phase==="daily_fact_candidate"?candidate:review));
  };
  const ai=new OpenAI("key","model",send,quiet);
  assert.deepEqual(await ai.generate("science","2026-10-04"),candidate);
  assert.deepEqual(await ai.review(candidate,"2026-10-04"),review);
});
