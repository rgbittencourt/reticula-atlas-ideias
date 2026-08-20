import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const academic=/academic|professor|researcher|scientist|philosopher|physicist|mathematician|oceanographer|engineer|psychologist|educator|scholar|economist|sociologist|biologist|chemist|geologist|historian|physician/i;
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();

async function findPhoto(name:string){
  const url=`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g,"_"))}`;
  const r=await fetch(url,{headers:{"User-Agent":"ReticulaAtlas/1.0 (inovalab.cte@ifsc.edu.br)"}});
  if(!r.ok)return null;const p:any=await r.json();
  if(p.type==="disambiguation"||!p.thumbnail?.source||!academic.test(`${p.description||""} ${p.extract||""}`))return null;
  if(norm(p.title)!==norm(name))return null;
  return{image:p.thumbnail.source,page:p.content_urls?.desktop?.page||`https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,description:p.description||"Biografia na Wikipedia"};
}

export async function GET(request:NextRequest){
  let names:string[]=[];try{names=JSON.parse(request.nextUrl.searchParams.get("names")||"[]")}catch{}
  names=[...new Set(names.map(String).map(n=>n.trim()).filter(Boolean))].slice(0,36);
  const found=await Promise.all(names.map(async name=>[name,await findPhoto(name)] as const));
  return NextResponse.json(Object.fromEntries(found.filter(([,photo])=>photo)),{headers:{"Cache-Control":"public, max-age=86400, s-maxage=604800"}});
}
