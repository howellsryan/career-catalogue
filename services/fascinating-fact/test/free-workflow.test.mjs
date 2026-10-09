import test from "node:test";
import assert from "node:assert/strict";
import { OpenAI } from "../dist/ai.js";
import { DailyJob } from "../dist/job.js";
import { candidate, review, MemoryStore, deferred } from "./fixtures.mjs";
const quiet=()=>{};
const documents=[{...candidate.sources[0],text:"Direct supporting evidence.",organization:"research",quote:undefined}];
const evidence={generate:async()=>documents,review:async()=>documents};
function envelope(value,legacy=false) {
  const selected={...value,sources:value.sources.map((_source,document_index)=>({document_index,excerpt_index:0,primary:_source.primary}))};
  return {id:"response-id",status:"completed",usage:{input_tokens:100,output_tokens:100},
    output:[...(legacy?[{type:"web_search_call",status:"completed",action:{sources:value.sources.map(s=>({url:s.url}))}}]:[]),
    {type:"message",content:[{type:"output_text",text:JSON.stringify(selected)}]}]};
}
test("Worker evidence replaces all chargeable hosted tools in the outgoing request",async()=>{
  let body;
  const send=async(url,options)=>{body=JSON.parse(options.body);return Response.json(envelope(candidate,!!body.tools));};
  const ai=new OpenAI("key","gpt-5.6-terra",send,quiet,true,evidence);
  assert.deepEqual(await ai.generate("science","2026-10-04",{reserve:async()=>{}}),candidate);
  assert.equal(body.tools,undefined); assert.equal(body.tool_choice,undefined);
  assert.equal(body.max_tool_calls,undefined); assert.equal(body.include,undefined);
  assert.match(body.input,/Direct supporting evidence\./);
});
test("a plausible invented quote cannot pass grounding against fetched source text",async()=>{
  const forged={...candidate,sources:[{...candidate.sources[0],quote:"A quote that the publisher never wrote."}]};
  const send=async()=>{const payload=envelope(forged);payload.output[0].content[0].text=JSON.stringify(forged);return Response.json(payload);};
  await assert.rejects(()=>new OpenAI("key","gpt-5.6-terra",send,quiet,true,evidence)
    .generate("science","2026-10-04",{reserve:async()=>{}}),{code:"evidence_not_retrieved"});
});
test("a generation POST is preceded by an awaited token reservation",async()=>{
  const events=[];
  const send=async(url,options)=>{events.push("post");return Response.json(envelope(candidate,!!JSON.parse(options.body).tools));};
  const ai=new OpenAI("key","gpt-5.6-terra",send,quiet,true,evidence);
  await ai.generate("science","2026-10-04",{reserve:async(tokens)=>{assert.ok(tokens>4000);events.push("reserved");}});
  assert.deepEqual(events,["reserved","post"]);
});
test("daily reservations stop retries before the configured token budget is exceeded",async()=>{
  const store=new MemoryStore();let now=Date.parse("2026-10-04T01:00:00Z");let calls=0,id=0;
  const ai={
    generate:async(category,day,budget)=>{await budget?.reserve(40000);calls++;return candidate;},
    review:async(fact,day,budget)=>{await budget?.reserve(40000);calls++;return {...review,factual:false};}
  };
  const job=new DailyJob(store,ai,()=>now,()=>String(++id),()=>0,quiet,100000);
  await job.queue("2026-10-04");
  for(let i=0;i<12;i++){await job.alarm();if(typeof store.alarmTime==='number')now=store.alarmTime;else break;}
  assert.equal(calls,2);
  assert.equal(store.state.job.status,"stopped");
  assert.equal(store.state.job.failure,"daily_token_budget_exhausted");
});

test("an exhausted reservation never sends the model request",async()=>{
  let posts=0;
  const send=async(url,options)=>{posts++;return Response.json(envelope(candidate,!!JSON.parse(options.body).tools));};
  const error=Object.assign(new Error("Budget exhausted"),{code:"daily_token_budget_exhausted"});
  await assert.rejects(()=>new OpenAI("key","gpt-5.6-terra",send,quiet,true,evidence)
    .generate("science","2026-10-04",{reserve:async()=>{throw error;}}),error);
  assert.equal(posts,0);
});
test("a source cannot grant itself primary authority through generated metadata",async()=>{
  const secondary=[{...documents[0],primary:false}];
  const forged={...candidate};
  const send=async(url,options)=>Response.json(envelope(forged,!!JSON.parse(options.body).tools));
  await assert.rejects(()=>new OpenAI("key","gpt-5.6-terra",send,quiet,true,{...evidence,generate:async()=>secondary})
    .generate("science","2026-10-04",{reserve:async()=>{}}),{code:"evidence_metadata_mismatch"});
});
test("independent review uses freshly retrieved documents instead of trusting candidate quotes",async()=>{
  const changed=[{...documents[0],text:"The publisher has corrected the original observation."}];
  const send=async(url,options)=>{
    assert.match(JSON.parse(options.body).input,/The publisher has corrected the original observation/);
    return Response.json(envelope({...review,factual:false},!!JSON.parse(options.body).tools));
  };
  const result=await new OpenAI("key","gpt-5.6-terra",send,quiet,true,{...evidence,review:async()=>changed})
    .review(candidate,"2026-10-04",{reserve:async()=>{}});
  assert.equal(result.factual,false);assert.equal(result.sources[0].quote,changed[0].text);
});
test("a persisted timeout reservation is never refunded on a restarted job",async()=>{
  const store=new MemoryStore();let now=Date.parse("2026-10-04T01:00:00Z");let calls=0,id=0;
  const ai={generate:async(category,day,budget)=>{await budget?.reserve(40000);calls++;throw Error("Lost reply");},review:async()=>review};
  await new DailyJob(store,ai,()=>now,()=>String(++id),()=>0,quiet,70000).queue("2026-10-04");
  await new DailyJob(store,ai,()=>now,()=>String(++id),()=>0,quiet,70000).alarm();
  now=store.alarmTime;
  await new DailyJob(store,ai,()=>now,()=>String(++id),()=>0,quiet,70000).alarm();
  assert.equal(calls,1);
  assert.equal(store.state.job.failure,"daily_token_budget_exhausted");
});
const nasaCandidate={...candidate,sources:[{url:"https://www.nasa.gov/news-release/surprising-discovery/",publisher:"NASA",quote:"Direct supporting evidence.",primary:true,published_at:"2026-09-01"}]};
const html='<html><head><meta property="article:published_time" content="2026-09-01T10:00:00Z"></head><body><nav>Invented navigation evidence</nav><main><h1>Research observation</h1><p>Direct supporting evidence.</p><script>Injected instructions</script><p>'+('The actual observation gives a measured outcome. '.repeat(12))+'</p></main></body></html>';
function publicTransport(mode,seen) {
  return async(url,options)=>{
    assert.equal(options.headers.Authorization, url==="https://api.openai.com/v1/responses"?"Bearer key":undefined);
    seen.push(String(url));
    if(url==="https://api.openai.com/v1/responses")return Response.json(envelope(nasaCandidate,!!JSON.parse(options.body).tools));
    if(String(url).includes("w/rest.php"))return Response.json({pages:[]});
    if(String(url)===nasaCandidate.sources[0].url) {
      if(mode==="redirect")return new Response(null,{status:302,headers:{Location:"http://127.0.0.1/admin"}});
      if(mode==="oversize")return new Response("x".repeat(600000),{headers:{"Content-Type":"text/html"}});
      if(mode==="broken")return new Response("unavailable",{status:503});
      return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8"}});
    }
    return new Response('<rss><channel><item><title>Discovery</title><link>'+nasaCandidate.sources[0].url+'</link></item></channel></rss>',{headers:{"Content-Type":"application/rss+xml"}});
  };
}
test("default workflow retrieves public feed articles and sends their clean evidence to the model",async()=>{
  const seen=[];const send=publicTransport("ok",seen);
  await new OpenAI("key","gpt-5.6-terra",send,quiet).generate("science","2026-10-04",{reserve:async()=>{}});
  assert.ok(seen.includes(nasaCandidate.sources[0].url));
});
for(const mode of ["redirect","oversize","broken"])test("unusable "+mode+" evidence stops before any model POST",async()=>{
  const seen=[];
  await assert.rejects(()=>new OpenAI("key","gpt-5.6-terra",publicTransport(mode,seen),quiet)
    .generate("science","2026-10-04",{reserve:async()=>{}}),{code:"evidence_unavailable"});
  assert.ok(!seen.includes("https://api.openai.com/v1/responses"));
  assert.ok(!seen.some(url=>url.includes("127.0.0.1")));
});

test("a crashed phase cannot reserve or send twice after restart",async()=>{
  const store=new MemoryStore();let now=Date.parse("2026-10-04T01:00:00Z");let calls=0,id=0;
  const started=deferred(),reply=deferred();let context;
  const ai={generate:async(category,day,budget)=>{context=budget;await budget?.reserve(40000);calls++;started.resolve();return reply.promise;},review:async()=>review};
  const make=()=>new DailyJob(store,ai,()=>now,()=>String(++id),()=>0,quiet,100000);
  await make().queue("2026-10-04");
  const work=make().alarm();await started.promise;
  await make().alarm();assert.equal(calls,1);
  now=store.alarmTime;await make().alarm();
  await assert.rejects(async()=>{await context?.reserve(40000);},{code:"attempt_not_active"});
  reply.resolve(candidate);await work;
  assert.equal(store.state.job.status,"retry");
  assert.equal(store.state.job.budget.reservedTokens,40000);
});
test("legacy attempts conservatively count against the new budget instead of resetting on bootstrap",async()=>{
  const store=new MemoryStore();let calls=0;
  store.state={job:{day:"2026-10-04",attempts:3,status:"stopped",nextAt:0,failure:"attempts_exhausted"}};
  const ai={generate:async(category,day,budget)=>{await budget?.reserve(40000);calls++;return candidate;},review:async()=>review};
  const job=new DailyJob(store,ai,()=>Date.parse("2026-10-04T01:00:00Z"),()=>"new-attempt",()=>0,quiet,200000);
  assert.equal(await job.queue("2026-10-04",true),"accepted");await job.alarm();
  assert.equal(calls,0);assert.equal(store.state.job.failure,"daily_token_budget_exhausted");
});
test("the next UTC day receives a fresh budget while a stale request cannot charge it",async()=>{
  const store=new MemoryStore();let now=Date.parse("2026-10-04T01:00:00Z"),id=0,oldContext;
  const started=deferred(),reply=deferred();
  const ai={generate:async(category,day,budget)=>{
    await budget?.reserve(40000);
    if(day==="2026-10-04"){oldContext=budget;started.resolve();return reply.promise;}
    return candidate;
  },review:async(fact,day,budget)=>{await budget?.reserve(40000);return review;}};
  const job=new DailyJob(store,ai,()=>now,()=>String(++id),()=>0,quiet,100000);
  await job.queue("2026-10-04");const old=job.alarm();await started.promise;
  now=Date.parse("2026-10-05T01:00:00Z");await job.queue("2026-10-05");
  await assert.rejects(async()=>{await oldContext?.reserve(40000);},{code:"attempt_not_active"});
  await job.alarm();reply.resolve(candidate);await old;
  assert.equal(store.state.publication.public.fact_date,"2026-10-05");
  assert.equal(store.state.job.budget.reservedTokens,80000);
});

test("free reference API discovery works without downloading large Wikipedia HTML",async()=>{
  const seen=[];
  const send=async(url,options)=>{
    seen.push(String(url));
    if(url==="https://api.openai.com/v1/responses")return Response.json(envelope(nasaCandidate));
    if(String(url).includes("/w/rest.php"))return Response.json({pages:[{key:"Science_observation"}]});
    if(String(url).includes("/w/api.php"))return Response.json({query:{pages:[{title:"Science observation",extlinks:[{url:nasaCandidate.sources[0].url}]}]}});
    if(String(url).includes("/wiki/"))return new Response("x".repeat(600000),{headers:{"Content-Type":"text/html"}});
    if(url===nasaCandidate.sources[0].url)return new Response(html,{headers:{"Content-Type":"text/html"}});
    return new Response("No feed available",{status:503});
  };
  let result;
  try {await new OpenAI("key","gpt-5.6-terra",send,quiet).generate("science","2026-10-04",{reserve:async()=>{}});result="fetched";}
  catch(error){result=error.code;}
  assert.equal(result,"fetched");
  assert.ok(seen.some(url=>url.includes("/w/api.php")));
  assert.ok(!seen.some(url=>url.includes("/wiki/")));
});

test("sport records remain discoverable when public news feeds and Wikimedia are unavailable",async()=>{
  const athlete="https://www.olympedia.org/athletes/1234";
  const sport={...candidate,category:"sport",sources:[{url:athlete,publisher:"Olympedia",quote:"Direct supporting evidence.",primary:true,published_at:"2026-09-01"}]};
  const seen=[];
  const send=async(url,options)=>{
    seen.push(String(url));
    if(url==="https://api.openai.com/v1/responses")return Response.json(envelope(sport));
    if(url==="https://www.olympedia.org/")return new Response('<html><body><h2>Random Olympians</h2><a href="/athletes/1234">Athlete</a></body></html>',{headers:{"Content-Type":"text/html"}});
    if(url===athlete)return new Response(html,{headers:{"Content-Type":"text/html"}});
    if(String(url).includes("/w/rest.php"))return Response.json({pages:[]});
    return new Response("Unavailable",{status:503});
  };
  let result;
  try{await new OpenAI("key","gpt-5.6-terra",send,quiet).generate("sport","2026-10-04",{reserve:async()=>{}});result="fetched";}
  catch(error){result=error.code;}
  assert.equal(result,"fetched");assert.ok(seen.includes(athlete));
});
