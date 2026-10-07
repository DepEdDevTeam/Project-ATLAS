"use client";
import { useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut, type User } from "firebase/auth";

type Page = { collections?: string[]; documents?: {id:string;path:string;fields:Record<string,unknown>}[]; nextCursor?:string|null };
export default function FirebaseBrowser() {
  const [user,setUser]=useState<User|null>(null), [data,setData]=useState<Page|null>(null), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const [collection,setCollection]=useState(""), [cursor,setCursor]=useState(""), [history,setHistory]=useState<string[]>([]);
  async function load(identity:User, path="", after="", document="") {
    setBusy(true);setError("");setData(null);
    try {
      const query=new URLSearchParams(); if(path)query.set("collection",path);if(after)query.set("cursor",after);if(document)query.set("document",document);
      const response=await fetch(`/api/firebase-data?${query}`,{headers:{Authorization:`Bearer ${await identity.getIdToken()}`},cache:"no-store"});
      const body=await response.json();if(!response.ok)throw new Error(body.error);setData(body);
    }catch(e){setError(e instanceof Error?e.message:"Could not read Firebase data.")}finally{setBusy(false)}
  }
  async function login(){setBusy(true);setError("");try{const response=await fetch("/api/firebase-data?view=config");const config=await response.json();if(!config.apiKey)throw new Error("FIREBASE_API_KEY is not configured.");const app=getApps().find(a=>a.name==="atlas-browser")||initializeApp(config,"atlas-browser");const result=await signInWithPopup(getAuth(app),new GoogleAuthProvider());setUser(result.user);await load(result.user);}catch(e){setError(e instanceof Error?e.message:"Sign-in failed.")}finally{setBusy(false)}}
  function open(path:string){setCollection(path);setCursor("");setHistory([]);if(user)void load(user,path)}
  return <section className="source-data" aria-busy={busy}><div className="source-data-heading"><div><h2>DepEd Firebase data</h2><p>Browse depedprototype collections, documents, nested fields, and subcollections. All documents are accessible through pagination.</p></div></div>
    <div className="source-toolbar">{!user?<button className="button primary" disabled={busy} onClick={login}>Sign in with Google</button>:<><span>{user.email}</span><button className="button" onClick={()=>{setCollection("");setCursor("");setHistory([]);void load(user)}}>All collections</button><button className="button" onClick={async()=>{await signOut(getAuth(getApps().find(a=>a.name==="atlas-browser")!));setUser(null);setData(null);setCollection("");setError("")}}>Sign out</button></>}</div>
    {error&&<p className="source-error" role="alert">{error}</p>}{busy&&<p role="status">Loading Firebase data…</p>}
    {collection&&<p className="source-note">Collection: {collection}</p>}
    {data?.collections&&<div className="source-toolbar">{data.collections.map(path=><button key={path} className="button" onClick={()=>open(path)}>{path}</button>)}{!data.collections.length&&<p>No collections found at this path.</p>}</div>}
    {data?.documents&&<><div className="source-table-wrap"><table><thead><tr><th>Document ID</th><th>Fields</th><th>Explore</th></tr></thead><tbody>{data.documents.map(doc=><tr key={doc.path}><td>{doc.id}</td><td><details><summary>{Object.keys(doc.fields).length} fields · View complete record</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxWidth:900}}>{JSON.stringify(doc.fields,null,2)}</pre></details></td><td><button className="source-row-link" onClick={()=>{setCollection("");setCursor("");setHistory([]);if(user)void load(user,"","",doc.path)}}>Subcollections</button></td></tr>)}</tbody></table>{!data.documents.length&&<p>No documents in this collection.</p>}</div><div className="source-pagination"><button disabled={busy||!history.length} onClick={()=>{const previous=[...history];const after=previous.pop()||"";setHistory(previous);setCursor(after);if(user)void load(user,collection,after)}}>Previous</button><span>Page {history.length+1}</span><button disabled={busy||!data.nextCursor} onClick={()=>{const after=data.nextCursor!;setHistory([...history,cursor]);setCursor(after);if(user)void load(user,collection,after)}}>Next</button></div></>}
  </section>;
}
