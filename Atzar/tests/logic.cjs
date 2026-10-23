/* Proves de lògica: reposició, repeticions, equilibri i temporitzadors. Ús: node tests/logic.cjs */
const { chromium } = require("playwright"); const http=require("http"),fs=require("fs"),path=require("path"),assert=require("assert/strict");
const root=path.resolve(__dirname,"..");
const T={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml",".png":"image/png"};
const srv=http.createServer((q,r)=>{let n=decodeURIComponent(q.url.split("?")[0]);if(n.endsWith("/"))n+="index.html";const f=path.join(root,n);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader("Content-Type",T[path.extname(f)]);fs.createReadStream(f).pipe(r);});
(async()=>{await new Promise(r=>srv.listen(0,r));const base=`http://127.0.0.1:${srv.address().port}/`;
const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||"chrome"});const ctx=await b.newContext({reducedMotion:"reduce"});const p=await ctx.newPage();
p.on("pageerror",e=>console.log("ERR",e.message));
const setup=async(app,key,val)=>{await p.goto(base+app+"/");await p.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify(v)),[key,val]);await p.reload();await p.waitForTimeout(200);};
const ls=k=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),k);
// Cartes: 40 cartes, 10 per tirada, sense reposició
await setup("Cartes","felip.atzar.cartes.v1",{deck:"es40",count:10,duration:350});
const seen=new Set();for(let i=0;i<4;i++){await p.click("#drawButton");await p.waitForFunction(()=>!document.querySelector("#drawButton").disabled||document.querySelector("#deckCount").textContent.startsWith("0"));await p.waitForTimeout(150);(await ls("felip.atzar.cartes.v1")).table.forEach(c=>{assert(!seen.has(c),"carta repetida "+c);seen.add(c)});}
const c=await ls("felip.atzar.cartes.v1");assert.equal(c.remaining.length,0);assert.equal(seen.size,40);
assert(await p.isDisabled("#drawButton"));console.log("✓ Cartes: 40 cartes diferents i baralla buida");
// Sorteig: 8 noms, 3 per tirada, sense tornar al barret
await setup("Sorteig","felip.atzar.sorteig.v1",{base:["A","B","C","D","E","F","G","H"],mode:"pick",qty:3,retire:true,duration:400,confetti:false});
const got=[];for(let i=0;i<3;i++){await p.click("#drawButton");await p.waitForFunction(()=>!document.querySelector("#entriesInput").disabled);got.push(...(await ls("felip.atzar.sorteig.v1")).last);}
assert.equal(new Set(got).size,8);assert.equal(got.length,8);assert.equal((await ls("felip.atzar.sorteig.v1")).pool.length,0);console.log("✓ Sorteig: 8 noms sense repetir (3+3+2)");
// Sorteig ordre complet
await setup("Sorteig","felip.atzar.sorteig.v1",{base:["A","B","C","D","E","F","G","H"],mode:"order",duration:400,confetti:false});await p.click("#drawButton");await p.waitForFunction(()=>!document.querySelector("#entriesInput").disabled);
assert.equal(await p.locator("#winners li").count(),8);console.log("✓ Sorteig: ordre complet de 8");
// Equips: 25 persones, 6 equips
const names=Array.from({length:25},(_,i)=>"P"+(i+1));
await setup("Equips","felip.atzar.equips.v1",{base:names,teams:6,duration:0,roles:true});await p.click("#makeButton");await p.waitForTimeout(300);
const e=await ls("felip.atzar.equips.v1");const sizes=e.last.teams.map(t=>t.members.length).sort();assert.deepEqual(sizes,[4,4,4,4,4,5]);
assert.equal(new Set(e.last.teams.flatMap(t=>t.members.map(m=>m.name))).size,25);assert.equal(e.last.teams[0].members[0].role,"Coordinador/a");console.log("✓ Equips: 25 en 6 equips (5,4,4,4,4,4) amb rols");
// Equips: persones per equip 4 amb 10 -> 3 equips
await setup("Equips","felip.atzar.equips.v1",{base:names.slice(0,10),split:"size",size:4,duration:0});await p.click("#makeButton");await p.waitForTimeout(200);
assert.deepEqual((await ls("felip.atzar.equips.v1")).last.teams.map(t=>t.members.length).sort(),[3,3,4]);console.log("✓ Equips: 10 de 4 en 4 → 4,3,3");
// Nombres: 10 sense repetir de 1 a 10 => permutació
await setup("Nombres","felip.atzar.nombres.v1",{mode:"number",min:1,max:10,qty:10,unique:true,sort:true,duration:500});await p.click("#drawButton");await p.waitForFunction(()=>document.querySelector("#liveResult").textContent);
assert.equal(await p.textContent("#liveResult"),"1, 2, 3, 4, 5, 6, 7, 8, 9, 10");console.log("✓ Nombres: 10 de 10 sense repetir i ordenats");
// Nombres: 11 sense repetir de 1 a 10 -> botó desactivat
await setup("Nombres","felip.atzar.nombres.v1",{mode:"number",min:1,max:10,qty:11,unique:true});assert(await p.isDisabled("#drawButton"));console.log("✓ Nombres: avisa si no hi ha prou nombres");
// Bombo: 5 boles
await setup("Nombres","felip.atzar.nombres.v1",{mode:"bingo",bingoMax:5,duration:500});for(let i=0;i<5;i++){await p.click("#drawButton");await p.waitForFunction(()=>!document.querySelector("#drawButton").disabled);}
assert.deepEqual([...(await ls("felip.atzar.nombres.v1")).bingoDrawn].sort(),[1,2,3,4,5]);console.log("✓ Bombo: 5 boles diferents");
// Moneda simulació
await setup("Moneda","felip.atzar.moneda.v1",{count:3});await p.click("#tab-coins");await p.click('[data-simulate="1000"]');const m=await ls("felip.atzar.moneda.v1");
assert.equal(m.stats.total,3000);assert(Math.abs(m.stats.heads/3000-0.5)<0.05);console.log("✓ Moneda: 3.000 monedes simulades, cares",(m.stats.heads/30).toFixed(1)+"%");
// Daus simulació 2d6
await setup("Daus","felip.atzar.daus.v1",{count:2,faces:6});await p.click('[data-simulate="3600"]');const d=(await ls("felip.atzar.daus.v1")).stats["2d6"];
assert.equal(d.rolls,3600);const seven=d.counts[5]/3600;assert(Math.abs(seven-1/6)<0.03);console.log("✓ Daus: 3.600 tirades 2D6, freq. del 7 =",(seven*100).toFixed(1)+"% (teòric 16,7%)");
// Temps: compte enrere 1 s acaba
await setup("Temps","felip.atzar.temps.v1",{mode:"countdown",cd:{total:1000,remaining:1000,endAt:null}});await p.click("#startButton");await p.waitForTimeout(1600);
assert(await p.locator("#clock.finished").count());console.log("✓ Temps: el compte enrere acaba i avisa");
// Temps: es pot marcar amb el cronòmetre en marxa, sense aturar-lo
await setup("Temps","felip.atzar.temps.v1",{mode:"stopwatch",sw:{base:0,startAt:null,marks:[]}});await p.click("#startButton");await p.click("#markButton");await p.waitForTimeout(200);await p.click("#markButton");
const sw=(await ls("felip.atzar.temps.v1")).sw;assert.equal(sw.marks.length,2);assert(sw.startAt);assert.equal(await p.locator("#stageMarks li").count(),2);console.log("✓ Temps: dues marques sense aturar el cronòmetre");
await b.close();srv.close();})().catch(e=>{console.log("✗",e.message);process.exit(1)});
