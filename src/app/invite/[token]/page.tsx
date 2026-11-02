"use client";

import {FormEvent,useEffect,useState} from "react";
import {useParams,useRouter} from "next/navigation";

export default function InvitePage(){
 const params=useParams<{token:string}>(),router=useRouter();
 const [status,setStatus]=useState("Invitation ready");
 const [busy,setBusy]=useState(false);
 const [signedIn,setSignedIn]=useState(false);
 const [mode,setMode]=useState<"login"|"register">("login");
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");

 useEffect(()=>{
  fetch("/api/auth").then(r=>r.json()).then(d=>setSignedIn(Boolean(d.user))).catch(()=>setSignedIn(false));
 },[]);

 async function accept(){
  setBusy(true);
  try{
   const response=await fetch("/api/invites/"+params.token,{method:"POST"});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not accept invitation");
   setStatus("Invitation accepted. Redirecting to your team board…");
   router.push("/");
  }catch(error){
   setStatus(error instanceof Error?error.message:"Could not accept invitation");
  }finally{
   setBusy(false);
  }
 }

 async function authenticate(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setBusy(true);
  setStatus("");
  try{
   const response=await fetch("/api/auth",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:mode,email,name,password})
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Authentication failed");
   setSignedIn(true);
   setBusy(false);
   await accept();
  }catch(error){
   setStatus(error instanceof Error?error.message:"Authentication failed");
   setBusy(false);
  }
 }

 return <main className="shell">
  <header className="top">
   <div className="brand">CREW<span>FORGE</span></div>
   <a href="/">Back to board</a>
  </header>
  <section className="dialog" style={{margin:"12vh auto",maxWidth:520}}>
   <div className="eyebrow">Team invitation</div>
   <h1>Join the crew.</h1>
   <p className="notice">{status}</p>
   {signedIn?
    <button className="btn" disabled={busy} onClick={accept}>{busy?"Joining…":"Accept invitation"}</button>:
    <form className="stack" onSubmit={authenticate}>
     <h2>{mode==="login"?"Sign in to accept":"Create an account to accept"}</h2>
     {mode==="register"&&<input required minLength={2} maxLength={60} placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/>}
     <input required type="email" maxLength={254} placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/>
     <input required type="password" minLength={10} maxLength={100} placeholder="Password (10+ characters)" value={password} onChange={e=>setPassword(e.target.value)}/>
     <button className="btn" type="submit" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in and join":"Create account and join"}</button>
     <button className="btn secondary" type="button" disabled={busy} onClick={()=>setMode(mode==="login"?"register":"login")}>{mode==="login"?"Need an account? Register":"Already registered? Sign in"}</button>
    </form>
   }
  </section>
 </main>;
}
