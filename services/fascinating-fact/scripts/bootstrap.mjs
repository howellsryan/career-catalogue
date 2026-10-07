import { createInterface } from "node:readline";
const target=process.argv[2];
if(!target)throw new Error("Usage: npm run bootstrap -- https://<worker>.workers.dev");
const url=new URL("/internal/bootstrap",target);
if(url.protocol!=="https:" && url.hostname!=="localhost")throw new Error("HTTPS is required.");
let token=process.env.BOOTSTRAP_TOKEN;
if(!token) {
  const input=createInterface({input:process.stdin,output:process.stdout,terminal:true});
  process.stdout.write("Bootstrap token (hidden): ");
  input._writeToOutput=()=>{};
  token=await new Promise(resolve=>input.question("",resolve));
  input.close();process.stdout.write("\n");
}
if(!token || token.length<32)throw new Error("Bootstrap token must be at least 32 characters.");
const response=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(30000)});
console.log(JSON.stringify({status:response.status,result:await response.json()}));
if(!response.ok)process.exitCode=1;
