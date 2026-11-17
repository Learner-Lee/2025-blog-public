/* DOM logic checks, not a browser/layout test. Install linkedom in a temporary QA directory.
   node interaction.cjs /tmp/ai-sub-qa/node_modules/linkedom /tmp/ai-sub-live-feed.json */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parseHTML} = require(process.argv[2] || 'linkedom');
const root = path.resolve(__dirname,'..');
const feed = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));

async function app({storage = new Map(), query = '', failing = false, blockedStorage = false} = {}) {
  const {document,window} = parseHTML(fs.readFileSync(path.join(root,'public/index.html'),'utf8'));
  const downloads = [];
  document.activeElement = document.body;
  window.HTMLElement.prototype.focus = function(){document.activeElement=this;};
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
    configurable:true,
    get(){return this.querySelector('option[selected]')?.getAttribute('value') ?? this.querySelector('option')?.getAttribute('value') ?? '';},
    set(value){for(const option of this.querySelectorAll('option'))option.toggleAttribute('selected',option.getAttribute('value')===String(value));}
  });
  window.HTMLSelectElement.prototype.add=function(option){this.append(option);};
  const dialog=document.getElementById('detail');
  dialog.showModal=function(){this.open=true;};
  dialog.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  function Option(text,value){const option=document.createElement('option');option.textContent=text;option.setAttribute('value',value);return option;}
  class TestURL extends URL {}
  TestURL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};
  TestURL.revokeObjectURL=()=>{};
  const location={search:query,pathname:'/ai-sub/'};
  const sandbox={document,window,Option,URL:TestURL,URLSearchParams,Blob,AbortSignal,console,
    location,history:{replaceState(_state,_unused,url){const parsed=new URL(url,'https://example.com');location.search=parsed.search;}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(blockedStorage)throw Error('quota');storage.set(key,value);}},
    fetch:async()=>{if(failing)throw Error('offline');return{ok:true,json:async()=>feed};},
    setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout,setInterval:()=>0
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root,'public/app.js'),'utf8'),sandbox);
  await pause(10);
  return {document,window,storage,downloads,location,
    run:code=>vm.runInContext(code,sandbox),
    click:selector=>{const node=document.querySelector(selector);assert.ok(node,'Missing '+selector);node.click();},
    change:(id,value,type='change')=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new window.Event(type));}
  };
}

(async()=>{
  const a=await app();
  const doc=a.document;
  assert.equal(doc.getElementById('stat-total').textContent,String(feed.items.length));
  assert.equal(doc.querySelectorAll('.article').length,24);
  a.click('#load-more');assert.equal(doc.querySelectorAll('.article').length,48);
  a.click('[data-view="release"]');assert.ok(a.run('filtered().every(x=>x.kind==="release")'));
  a.click('[data-importance="high"]');assert.ok(a.run('filtered().every(x=>x.importance==="high" && x.kind==="release")'));
  const source=a.run('filtered()[0].source');a.change('source',source);assert.ok(a.run('filtered().every(x=>x.source===state.source)'));
  a.click('#clear');a.click('[data-view="all"]');
  a.change('search','__NO_SUCH_TITLE__','input');await pause(175);assert.equal(doc.querySelectorAll('.article').length,0);assert.match(doc.getElementById('message').textContent,/没有找到/);
  a.click('#clear');
  const firstId=doc.querySelector('.article').dataset.itemId;
  a.click('.save-button');assert.equal(doc.getElementById('count-saved').textContent,'1');assert.equal(doc.querySelector('.save-button').getAttribute('aria-pressed'),'true');
  a.click('.title-button');assert.equal(doc.getElementById('detail').open,true);assert.equal(doc.querySelector('.article').classList.contains('is-read'),true);assert.ok(doc.querySelector('.primary-button').href.startsWith('http'));
  a.click('#close-detail');assert.equal(doc.getElementById('detail').open,false);
  a.click('[data-view="saved"]');assert.equal(doc.querySelectorAll('.article').length,1);assert.equal(doc.querySelector('.article').dataset.itemId,firstId);
  a.click('#export');assert.equal(a.downloads.length,1);const markdown=await a.downloads[0].text();assert.match(markdown,/# AI-Sub 收藏清单/);assert.match(markdown,/原文：https?:\/\//);
  const b=await app({storage:new Map(a.storage),query:'?view=saved'});assert.equal(b.document.querySelectorAll('.article').length,1);
  b.click('.save-button');assert.equal(b.document.getElementById('count-saved').textContent,'0');assert.match(b.document.getElementById('message').textContent,/收藏起来/);
  const offline=await app({storage:a.storage,failing:true,query:'?view=saved'});assert.equal(offline.document.querySelectorAll('.article').length,1,'Saved snapshots survive feed outage');
  const unavailable=await app({failing:true});assert.match(unavailable.document.getElementById('message').textContent,/暂时无法获取/);
  const blocked=await app({blockedStorage:true});blocked.click('.save-button');assert.match(blocked.document.getElementById('toast').textContent,/存储不可用/);blocked.click('#export');assert.equal(blocked.downloads.length,1);
  const linked=await app({query:'?view=blog&importance=medium&sort=importance'});assert.ok(linked.run('filtered().every(x=>x.kind==="blog"&&x.importance==="medium")'));assert.match(linked.location.search,/view=blog/);
  a.click('[data-view="all"]');a.change('sort','importance');assert.equal(a.run('filtered()[0].importance'),'high');
  a.change('days','1');assert.ok(a.run('filtered().every(x=>timestamp(x.fetched_at)>Date.now()-86400000)'));
  console.log('PASS: live data, pagination, type/importance/source/time/search filters, sorting, detail/read markers, URL state, local persistence, saved snapshots offline, Markdown export, empty/error states, storage failure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
