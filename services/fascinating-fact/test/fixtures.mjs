export const candidate = {
  title: "An unexpected detail of the natural world",
  fact: "The natural world contains surprising adaptations that change how scientists understand life in demanding environments. This example describes a specific mechanism with a measurable outcome, places the observation in its original context, and explains the boundaries of the evidence without turning an interesting finding into a universal claim.",
  explanation: "The surprising connection between the mechanism and its outcome makes this discovery memorable, while its practical significance helps readers understand why researchers investigated it.",
  category: "science",
  sources: [{url:"https://research.example/paper",publisher:"Research Institute",quote:"Direct supporting evidence.",primary:true,published_at:"2026-09-01"}]
};
export const review = {
  fascinating:true,specification:true,factual:true,reasons:["The evidence supports the surprising finding."],
  claims:[{claim:"All factual claims checked.",supported:true,source_urls:["https://research.example/paper"]}],
  sources:structuredClone(candidate.sources)
};
export class MemoryStore {
  state; alarmTime; serial=Promise.resolve();
  async transaction(callback) {
    const previous=this.serial;
    let release; this.serial=new Promise(resolve=>{release=resolve;});
    await previous;
    let state=structuredClone(this.state), alarmTime=this.alarmTime;
    try {
      const result=await callback({
        get:async()=>structuredClone(state),
        put:async(key,value)=>{state=structuredClone(value);},
        setAlarm:async time=>{alarmTime=time;},
        deleteAlarm:async()=>{alarmTime=undefined;}
      });
      this.state=state; this.alarmTime=alarmTime;
      return result;
    } finally { release(); }
  }
}
export function deferred() { let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; }
