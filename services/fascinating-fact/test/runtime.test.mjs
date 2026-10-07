import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
test("real Workers runtime routes reads through the Durable Object without AI credentials",{timeout:90000},async()=>{
  const proc=spawn("node_modules/.bin/wrangler",["dev","--local","--ip","127.0.0.1","--port","8793","--inspector-port","8795","--test-scheduled","--var","OPENAI_BUDGET_ENFORCED:false"],{env:{...process.env,CI:"true"},stdio:["ignore","pipe","pipe"]});
  let logs="";proc.stdout.on("data",chunk=>{logs+=chunk;});proc.stderr.on("data",chunk=>{logs+=chunk;});
  try {
    let response;
    for(let i=0;i<120;i++) {
      if(proc.exitCode!==null)throw new Error("Wrangler exited: "+logs);
      try {response=await fetch("http://127.0.0.1:8793/v1/fact");break;}catch{await delay(500);}
    }
    assert.ok(response,"Wrangler startup timed out: "+logs);
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:"fact_unavailable"});
    assert.equal((await fetch("http://127.0.0.1:8793/internal/bootstrap",{method:"POST"})).status,401);
    assert.equal((await fetch("http://127.0.0.1:8793/v1/fact?refresh=1")).status,400);
    assert.equal((await fetch("http://127.0.0.1:8793/v1/fact",{method:"HEAD"})).status,503);
    const history=await fetch("http://127.0.0.1:8793/v1/facts");
    assert.equal(history.status,200);assert.deepEqual(await history.json(),{schema_version:1,facts:[],next_before:null});
    assert.equal((await fetch("http://127.0.0.1:8793/v1/facts/2026-10-03")).status,404);
    assert.equal((await fetch("http://127.0.0.1:8793/v1/facts?before=2026-02-30")).status,400);
    const scheduled=await fetch("http://127.0.0.1:8793/cdn-cgi/handler/scheduled");
    assert.equal(scheduled.status,200);
    assert.equal((await fetch("http://127.0.0.1:8793/v1/fact")).status,503);
  } finally {
    proc.kill("SIGTERM");
    await Promise.race([new Promise(resolve=>proc.once("exit",resolve)),delay(5000)]);
    if(proc.exitCode===null)proc.kill("SIGKILL");
  }
});
