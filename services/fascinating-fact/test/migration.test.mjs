import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { publication } from "../dist/domain.js";
import { candidate, review } from "./fixtures.mjs";

test("native Durable Object archives legacy data across restarts and paginates every stored day",{timeout:180000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),"daily-fact-migration-"));
  const config=join(directory,"wrangler.json");
  const base="http://127.0.0.1:8794";
  let processHandle,logs="";
  async function stop() {
    if(!processHandle || processHandle.exitCode!==null || processHandle.signalCode!==null)return;
    const exited=new Promise(done=>processHandle.once("exit",done));
    processHandle.kill("SIGTERM");
    await Promise.race([exited,delay(5000)]);
    if(processHandle.exitCode===null && processHandle.signalCode===null){processHandle.kill("SIGKILL");await exited;}
  }
  async function start(main) {
    await writeFile(config,JSON.stringify({
      name:"daily-fact-local-migration",main:resolve(main),compatibility_date:"2026-10-04",
      compatibility_flags:["nodejs_compat"],vars:{OPENAI_MODEL:"gpt-5.6-terra",OPENAI_BUDGET_ENFORCED:"false"},
      durable_objects:{bindings:[{name:"DAILY_FACT",class_name:"DailyFactStore"}]},
      migrations:[{tag:"v1",new_sqlite_classes:["DailyFactStore"]}]
    }));
    logs="";
    processHandle=spawn("node_modules/.bin/wrangler",["dev","--local","--config",config,"--persist-to",join(directory,"storage"),
      "--ip","127.0.0.1","--port","8794","--inspector-port","8796"],{env:{...process.env,CI:"true"},stdio:["ignore","pipe","pipe"]});
    processHandle.stdout.on("data",value=>{logs+=value;});processHandle.stderr.on("data",value=>{logs+=value;});
    for(let attempt=0;attempt<120;attempt++){
      if(processHandle.exitCode!==null)throw new Error("Wrangler exited: "+logs);
      try{await fetch(base+"/v1/fact");return;}catch{await delay(500);}
    }
    throw new Error("Wrangler startup timed out: "+logs);
  }
  try {
    const facts=Array.from({length:103},(_,index)=>publication(candidate,review,Date.parse("2026-01-01T01:00:00Z")+index*86400000));
    const latest=facts[facts.length-1].public;
    await start("test/seed-worker.ts");
    assert.equal((await fetch(base+"/test/seed",{method:"POST",body:JSON.stringify(facts)})).status,204);
    await stop();await start("src/index.ts");
    assert.deepEqual(await (await fetch(base+"/v1/fact")).json(),latest);
    const dates=[];let cursor;
    do {
      const response=await fetch(base+"/v1/facts"+(cursor?"?before="+cursor:""));
      assert.equal(response.status,200);
      const page=await response.json();assert.ok(page.facts.length<=50);
      for(const fact of page.facts) {
        assert.deepEqual(Object.keys(fact),["id","fact_date","title","category","published_at"]);
        dates.push(fact.fact_date);
      }
      cursor=page.next_before;
    } while(cursor);
    assert.deepEqual(dates,facts.map(fact=>fact.public.fact_date).reverse());
    assert.deepEqual(await (await fetch(base+"/v1/facts/"+latest.fact_date)).json(),latest);
    assert.deepEqual(await (await fetch(base+"/v1/facts/2026-01-01")).json(),facts[0].public);
    assert.equal((await fetch(base+"/v1/facts/2026-12-31")).status,404);
    await stop();await start("src/index.ts");
    assert.deepEqual(await (await fetch(base+"/v1/facts/"+latest.fact_date)).json(),latest);
    assert.deepEqual(await (await fetch(base+"/v1/fact")).json(),latest);
    assert.equal((await fetch(base+"/test/seed",{method:"POST"})).status,404);
  } finally {await stop();await rm(directory,{recursive:true,force:true});}
});
