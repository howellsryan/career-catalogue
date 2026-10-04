const key=process.env.OPENAI_API_KEY;
if(!key)throw new Error("Set OPENAI_API_KEY securely in this process environment.");
const model=process.env.OPENAI_MODEL ?? "gpt-6-sol";
const response=await fetch("https://api.openai.com/v1/models/"+encodeURIComponent(model),{
  headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(30000)
});
if(!response.ok)throw new Error("Model availability check failed: HTTP "+response.status);
const result=await response.json();
console.log(JSON.stringify({model:result.id,available:true,
  note:"Availability only. Bootstrap must verify Responses API, structured output and web search support."}));
