import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../assets/js/daily-fact.js",import.meta.url),"utf8");
const fact=(day,title="A fact about our world")=>({schema_version:1,id:day,fact_date:day,published_at:day+"T01:00:00Z",
  category:"science",title,fact:"The fact text for "+day,explanation:"The context for "+day});
const summary=data=>({id:data.id,fact_date:data.fact_date,title:data.title,category:data.category,published_at:data.published_at});
const history=(facts,next_before=null)=>({schema_version:1,facts:facts.map(summary),next_before});
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};

// A small DOM fixture exercises the shipped script; rendered CSS is checked in a browser.
function page(search="") {
  let now=Date.parse("2026-10-05T06:00:00Z"),timerId=0,copied="";
  const timers=new Map(),requests=[],windowListeners=new Map();
  class Element {
    constructor(tag="div"){this.tag=tag;this.children=[];this.hidden=false;this.disabled=false;this.textContent="";this.attributes={};this.listeners={};this._value="";}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...children){this.children=children.flatMap(child=>child.tag==="fragment"?child.children:[child]);this._value="";}
    get options(){return this.children;}
    get value(){return this._value;}
    set value(value){this._value=this.tag==="select" && !this.children.some(child=>child.value===value)?"":value;}
    setAttribute(name,value){this.attributes[name]=value;}
    addEventListener(name,callback){this.listeners[name]=callback;}
    click(){if(!this.disabled)this.listeners.click?.();}
    change(value){this.value=value;this.listeners.change?.();}
  }
  const ids=["daily-fact","fact-state","fact-state-title","fact-state-description","fact-content","fact-retry","fact-copy",
    "fact-copy-status","fact-loading","fact-announcement","fact-history","fact-earlier","fact-history-status","fact-browser",
    "fact-category","fact-title","fact-text","fact-explanation","fact-date"];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(id==="fact-history"?"select":"div")]));
  for(const id of ["fact-state","fact-content","fact-retry","fact-copy","fact-loading","fact-earlier","fact-browser"])elements[id].hidden=true;
  const initial=new Element("option");initial.value="";initial.textContent="Today";elements["fact-history"].appendChild(initial);
  elements["daily-fact"].dataset={endpoint:"https://facts.example/v1/fact"};
  const window={
    isSecureContext:true,location:{href:"https://reader.example/daily-fact/"+search},
    history:{pushState(_state,_title,url){window.location.href=String(url);}},
    addEventListener(name,callback){windowListeners.set(name,callback);},
    setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,at:now+delay});return id;},
    clearTimeout(id){timers.delete(id);}
  };
  class ClockDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  vm.runInNewContext(source,{
    document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element("fragment")},
    window,Date:ClockDate,Intl,URL,AbortController,
    navigator:{clipboard:{async writeText(text){copied=text;}}},
    fetch(url,options){return new Promise(resolve=>{requests.push({url:new URL(url),options,resolve,done:false});});}
  });
  return {
    elements,requests,window,get copied(){return copied;},
    async respond(path,data,status=200){
      const request=requests.find(item=>!item.done && item.url.pathname+item.url.search===path);
      assert.ok(request,"No pending request for "+path);request.done=true;
      request.resolve({status,ok:status>=200&&status<300,async json(){return data;}});
      await settle();
    },
    advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.callback();}},
    setDate(iso){now=Date.parse(iso);},
    async backTo(search){window.location.href="https://reader.example/daily-fact/"+search;windowListeners.get("popstate")();await settle();}
  };
}
async function ready() {
  const p=page();
  await p.respond("/v1/fact",fact("2026-10-05"));
  await p.respond("/v1/facts",history([fact("2026-10-05"),fact("2026-10-04"),fact("2026-10-03")]));
  return p;
}

test("Today is the single option representing the current publication",async()=>{
  const p=await ready(),e=p.elements;
  assert.deepEqual(e["fact-history"].options.map(option=>option.value),["","2026-10-04","2026-10-03"]);
  assert.equal(e["fact-history"].options[0].textContent,"Today");
  assert.equal(e["fact-loading"].hidden,true);assert.equal(e["fact-state"].hidden,true);
});
test("slow date changes retain the article and give unobtrusive loading feedback",async()=>{
  const p=await ready(),e=p.elements;
  e["fact-history"].change("2026-10-04");
  assert.equal(e["fact-content"].hidden,false);assert.equal(e["fact-state"].hidden,true);
  assert.equal(e["fact-date"].dateTime,"2026-10-05");assert.equal(e["fact-copy"].disabled,true);
  p.advance(249);assert.equal(e["fact-loading"].hidden,true);
  p.advance(1);assert.equal(e["fact-loading"].hidden,false);
  assert.match(e["fact-loading"].textContent,/4 October 2026/);
  await p.respond("/v1/facts/2026-10-04",fact("2026-10-04"));
  assert.equal(e["fact-date"].dateTime,"2026-10-04");
  assert.equal(e["fact-loading"].hidden,true);assert.equal(e["daily-fact"].attributes["aria-busy"],"false");
});
test("fast and previously read date changes never show the loading screen",async()=>{
  const p=await ready(),e=p.elements;
  e["fact-history"].change("2026-10-04");
  await p.respond("/v1/facts/2026-10-04",fact("2026-10-04"));
  p.advance(250);assert.equal(e["fact-loading"].hidden,true);
  await p.backTo("?date=2026-10-05");
  const reads=p.requests.length;
  e["fact-history"].change("2026-10-04");await settle();
  assert.equal(p.requests.length,reads);assert.equal(e["fact-date"].dateTime,"2026-10-04");
  assert.equal(e["fact-content"].hidden,false);assert.equal(e["fact-state"].hidden,true);
});
test("late responses cannot replace a more recent selection",async()=>{
  const p=await ready(),e=p.elements;
  e["fact-history"].change("2026-10-04");e["fact-history"].change("2026-10-03");
  await p.respond("/v1/facts/2026-10-03",fact("2026-10-03","The selected fact"));
  await p.respond("/v1/facts/2026-10-04",fact("2026-10-04","A late response"));
  assert.equal(e["fact-title"].textContent,"The selected fact");assert.equal(e["fact-loading"].hidden,true);
});
test("a retained previous-day publication is also represented once by Today",async()=>{
  const p=page(),e=p.elements;
  await p.respond("/v1/facts",history([fact("2026-10-04"),fact("2026-10-03")]));
  await p.respond("/v1/fact",fact("2026-10-04"));
  assert.deepEqual(e["fact-history"].options.map(option=>option.value),["","2026-10-03"]);
  assert.equal(e["fact-date"].dateTime,"2026-10-04");
});
test("date links and browser navigation preserve the requested fact without duplicating Today",async()=>{
  const p=page("?date=2026-10-05"),e=p.elements;
  await p.respond("/v1/facts/2026-10-05",fact("2026-10-05"));
  await p.respond("/v1/facts",history([fact("2026-10-05"),fact("2026-10-04")]));
  assert.equal(e["fact-history"].value,"");assert.equal(e["fact-history"].options.length,2);
  assert.equal(new URL(p.window.location.href).searchParams.get("date"),"2026-10-05");
  await p.backTo("?date=2026-10-04");
  await p.respond("/v1/facts/2026-10-04",fact("2026-10-04"));
  assert.equal(e["fact-history"].value,"2026-10-04");
});
test("UTC rollover and a fresh latest read make yesterday available",async()=>{
  const p=await ready(),e=p.elements;
  p.setDate("2026-10-06T02:00:00Z");e["fact-history"].change("");
  await p.respond("/v1/fact",fact("2026-10-06"));
  assert.deepEqual(e["fact-history"].options.map(option=>option.value),["","2026-10-05","2026-10-04","2026-10-03"]);
  assert.equal(e["fact-date"].dateTime,"2026-10-06");
});
test("read errors show a plain actionable state and history errors do not hide the fact",async()=>{
  const p=page(),e=p.elements;
  await p.respond("/v1/fact",fact("2026-10-05"));
  await p.respond("/v1/facts",{error:"history_unavailable"},503);
  assert.equal(e["fact-content"].hidden,false);assert.equal(e["fact-earlier"].textContent,"Retry dates");
  await p.backTo("?date=2026-10-01");await p.respond("/v1/facts/2026-10-01",{error:"fact_not_found"},404);
  assert.equal(e["fact-content"].hidden,true);assert.equal(e["fact-state-title"].textContent,"No fact for this date");
  assert.equal(e["fact-loading"].hidden,true);assert.match(e["fact-state-description"].textContent,/Today/);
});
test("copy follows the selected fact and is unavailable during a pending selection",async()=>{
  const p=await ready(),e=p.elements;
  e["fact-history"].change("2026-10-04");e["fact-copy"].click();assert.equal(p.copied,"");
  await p.respond("/v1/facts/2026-10-04",fact("2026-10-04"));
  e["fact-copy"].click();await settle();assert.match(p.copied,/2026-10-04/);
  assert.ok(p.requests.every(request=>request.options.method==="GET" && request.options.credentials==="omit"));
});

test("a stale history response cannot override the latest publication returned by the fact API",async()=>{
  const p=page(),e=p.elements;
  await p.respond("/v1/fact",fact("2026-10-05"));
  await p.respond("/v1/facts",history([fact("2026-10-04"),fact("2026-10-03")]));
  assert.deepEqual(e["fact-history"].options.map(option=>option.value),["","2026-10-04","2026-10-03"]);
});
