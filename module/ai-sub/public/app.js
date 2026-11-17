'use strict';
const $ = id => document.getElementById(id);
const STORE = 'ai-sub:saved:v1';
const READ = 'ai-sub:read:v1';
const PAGE_SIZE = 24;
const names = { all: '全部动态', release: '产品更新', blog: '技术博客', saved: '我的收藏' };
const priorities = { high: '重点', medium: '关注', low: '了解' };
const rank = { high: 0, medium: 1, low: 2 };
let items = [], loaded = false, busy = false, shown = PAGE_SIZE, activeItem = null, detailTrigger = null;
let saved = {}, read = {}, storageAvailable = true, searchTimer, toastTimer;
try {
  const stored = JSON.parse(localStorage.getItem(STORE) || '{}');
  const storedRead = JSON.parse(localStorage.getItem(READ) || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) saved = stored;
  if (storedRead && typeof storedRead === 'object' && !Array.isArray(storedRead)) read = storedRead;
} catch { storageAvailable = false; }
function validItem(item) {
  if (!item || typeof item.id !== 'string' || !/^[a-f0-9]{24}$/.test(item.id) || !['release','blog'].includes(item.kind)) return false;
  try { const url = new URL(item.url); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
saved = Object.fromEntries(Object.entries(saved).filter(([key, value]) => validItem(value) && key === value.id));
const initial = new URLSearchParams(location.search);
const state = { view: names[initial.get('view')] ? initial.get('view') : 'all', q: (initial.get('q') || '').slice(0,200), importance: priorities[initial.get('importance')] ? initial.get('importance') : 'all', source: initial.get('source') || '', category: initial.get('category') || '', days: ['0','1','7','30'].includes(initial.get('days')) ? initial.get('days') : '0', sort: ['newest','published','importance'].includes(initial.get('sort')) ? initial.get('sort') : 'newest' };
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const title = item => item.title_zh || item.title || '未命名内容';
const timestamp = value => { const date = Date.parse(value); return Number.isFinite(date) ? date : 0; };
function dateText(value, full = false) {
  if (!timestamp(value)) return '日期未知';
  return new Date(value).toLocaleString('zh-CN', full ? {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false} : {year:'numeric',month:'2-digit',day:'2-digit'});
}
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200); }
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(saved)); localStorage.setItem(READ, JSON.stringify(read)); storageAvailable = true; return true; }
  catch { storageAvailable = false; toast('浏览器存储不可用，当前收藏请及时导出保存。'); return false; }
}
function syncURL() {
  const params = new URLSearchParams();
  const defaults = { view:'all', q:'', importance:'all', source:'', category:'', days:'0', sort:'newest' };
  for (const [key, value] of Object.entries(state)) if (value !== defaults[key]) params.set(key, value);
  history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''));
}
function allItems() { const map = new Map(items.map(item => [item.id,item])); if (state.view === 'saved') for (const item of Object.values(saved)) if (!map.has(item.id)) map.set(item.id,item); return [...map.values()]; }
function filtered() {
  const query = state.q.trim().toLocaleLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const cutoff = state.days === '0' ? 0 : Date.now() - Number(state.days) * 86400000;
  return allItems().filter(item => {
    if (state.view === 'saved' ? !saved[item.id] : state.view !== 'all' && item.kind !== state.view) return false;
    if (state.importance !== 'all' && item.importance !== state.importance) return false;
    if (state.source && item.source !== state.source) return false;
    if (state.category && item.category !== state.category) return false;
    if (cutoff && timestamp(item.fetched_at) < cutoff) return false;
    const haystack = [item.title,item.title_zh,item.summary,item.summary_zh,item.source,item.category,item.product].join(' ').toLocaleLowerCase();
    return words.every(word => haystack.includes(word));
  }).sort((a,b) => (state.sort === 'importance' ? rank[a.importance] - rank[b.importance] : 0) || (state.sort === 'published' ? timestamp(b.published_date || b.fetched_at) - timestamp(a.published_date || a.fetched_at) : timestamp(b.fetched_at) - timestamp(a.fetched_at)) || a.id.localeCompare(b.id));
}
function markRead(item) {
  if (!read[item.id]) { read[item.id] = Date.now(); const entries = Object.entries(read).sort((a,b)=>b[1]-a[1]).slice(0,5000); read = Object.fromEntries(entries); persist(); }
  document.querySelectorAll('[data-item-id="'+item.id+'"]').forEach(node => {node.classList.add('is-read'); if (!node.querySelector('.read-label')) node.querySelector('.card-meta')?.append(el('span','read-label','已读'));});
}
function toggleSave(item) {
  const removing = Boolean(saved[item.id]);
  if (removing) delete saved[item.id]; else saved[item.id] = {...item, saved_at: new Date().toISOString()};
  const persisted = persist();
  if (persisted) toast(removing ? '已取消收藏' : '已收藏到当前浏览器');
  render();
  if (activeItem?.id === item.id) updateDetailSave();
}
function saveButton(item, detail = false) {
  const button = el('button', 'save-button' + (saved[item.id] ? ' saved' : ''), detail ? (saved[item.id] ? '★ 已收藏' : '☆ 收藏这篇') : (saved[item.id] ? '★' : '☆'));
  button.type = 'button'; button.setAttribute('aria-label', (saved[item.id] ? '取消收藏：' : '收藏：') + title(item)); button.setAttribute('aria-pressed', String(Boolean(saved[item.id])));
  button.addEventListener('click', () => toggleSave(item)); return button;
}
function originalLink(item, className, label) {
  const link = el('a',className,label); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.addEventListener('click',()=>markRead(item)); return link;
}
function card(item, featured) {
  const article = el('article','article' + (featured ? ' featured' : '') + (read[item.id] ? ' is-read' : '')); article.dataset.itemId = item.id;
  const top = el('div','card-top'); const source = el('div','source'); source.append(el('span','source-letter',(item.source || 'A').slice(0,1).toUpperCase()),el('span','source-name',item.source || '未知来源')); top.append(source,el('span','badge '+item.importance,(featured ? '✦ ' : '') + priorities[item.importance]));
  const h3 = el('h3'); const button = el('button','title-button',title(item)); button.type = 'button'; button.addEventListener('click',()=>openDetail(item, button)); h3.append(button);
  const summary = el('p','card-summary',item.summary_zh || item.summary || '暂无摘要，点击查看原文。');
  const meta = el('div','card-meta'); meta.append(el('span','tag',item.kind==='release'?'产品更新':'技术博客')); if (item.category) meta.append(el('span','tag',item.category)); if (item.product && item.product !== item.source) meta.append(el('span','tag',item.product)); if (read[item.id]) meta.append(el('span','read-label','已读'));
  const footer = el('div','card-footer'); const date = el('time','card-date',dateText(item.published_date || item.fetched_at)+(item.published_date ? ' 发布' : ' 收录')); date.title = '收录时间：'+dateText(item.fetched_at,true); date.dateTime = item.published_date || item.fetched_at;
  const actions = el('div','card-actions'); actions.append(saveButton(item),originalLink(item,'original-link','阅读原文 ↗')); footer.append(date,actions); article.append(top,h3,summary,meta,footer); return article;
}
function updateDetailSave() { const holder = $('detail-save'); if (holder && activeItem) holder.replaceChildren(saveButton(activeItem,true)); }
function openDetail(item, trigger) {
  activeItem = item; detailTrigger = trigger; markRead(item);
  const body = $('detail-body'); body.replaceChildren();
  body.append(el('div','detail-source',item.source+' · '+(item.kind==='release'?'产品更新':'技术博客')));
  const heading = el('h2','',title(item)); heading.id = 'detail-title'; body.append(heading);
  if (item.title_zh && item.title && item.title_zh !== item.title) body.append(el('p','detail-original',item.title));
  const meta = el('div','card-meta'); meta.append(el('span','badge '+item.importance,priorities[item.importance]),el('span','tag',item.category || '其他主题'),el('span','',dateText(item.published_date || item.fetched_at)+' '+(item.published_date ? '发布' : '收录'))); body.append(meta);
  body.append(el('div','detail-heading','AI 内容摘要'),el('div','detail-summary',item.summary_zh || item.summary || '这篇内容还没有摘要，可直接阅读原文。'));
  if (item.summary_zh && item.summary && item.summary !== item.summary_zh) {const details=el('details'); const summary=el('summary','detail-heading','查看原始摘要'); details.append(summary,el('div','detail-summary',item.summary));body.append(details);}
  const actions = el('div','detail-actions'); const holder=el('span');holder.id='detail-save';actions.append(originalLink(item,'primary-button','前往原文 ↗'),holder);body.append(actions,el('p','detail-note','收录于 '+dateText(item.fetched_at,true)+' · 摘要由 AI 整理，完整内容与准确表述请以原文为准。'));updateDetailSave();
  $('detail').showModal(); $('detail').scrollTop = 0;
}
$('close-detail').addEventListener('click',()=>$('detail').close());
$('detail').addEventListener('click',event=>{if(event.target===$('detail')) {const r=$('detail').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('detail').close();}});
$('detail').addEventListener('close',()=>{activeItem=null;if(detailTrigger?.isConnected)detailTrigger.focus();else document.querySelector('.nav-item.active')?.focus();});
function fillOptions(id, key, label) {
  const node=$(id);node.replaceChildren(new Option(label,''));const values=new Set([...items,...Object.values(saved)].map(item=>item[key]).filter(Boolean)); if(state[key])values.add(state[key]);[...values].sort((a,b)=>a.localeCompare(b,'zh-CN')).forEach(value=>node.add(new Option(value,value))); node.value=state[key];
}
function statistics() {
  $('count-all').textContent = items.length; $('count-release').textContent = items.filter(x=>x.kind==='release').length; $('count-blog').textContent = items.filter(x=>x.kind==='blog').length; $('count-saved').textContent=Object.keys(saved).length;
  $('stat-total').textContent=items.length;$('stat-today').textContent=items.filter(x=>timestamp(x.fetched_at)>Date.now()-86400000).length;$('stat-high').textContent=items.filter(x=>x.importance==='high').length;$('stat-sources').textContent=new Set(items.map(x=>x.source)).size;
}
function showMessage(headline, description, action) {
  $('message').replaceChildren(el('div','',headline));if(description)$('message').append(el('p','',description));if(action){const b=el('button','',action.label);b.addEventListener('click',action.run);$('message').append(b);} $('message').hidden=false;
}
function render() {
  const previousFocus=document.activeElement;
  const previousSaveId=previousFocus?.classList.contains('save-button')?previousFocus.closest('[data-item-id]')?.dataset.itemId:null;
  statistics(); document.querySelectorAll('[data-view]').forEach(node=>{node.classList.toggle('active',node.dataset.view===state.view);node.setAttribute('aria-current',node.dataset.view===state.view?'page':'false');});
  document.querySelectorAll('[data-importance]').forEach(node=>{node.classList.toggle('selected',node.dataset.importance===state.importance);node.setAttribute('aria-pressed',String(node.dataset.importance===state.importance));});
  $('breadcrumb').textContent=names[state.view];$('view-title').replaceChildren();
  const headings={all:['AI 世界，','值得读的都在这里。'],release:['产品在更新，','想法也在发生。'],blog:['读技术，','也读背后的思考。'],saved:['值得细读的，','给它留个位置。']};
  $('view-title').append(document.createTextNode(headings[state.view][0]),el('span','',headings[state.view][1]));
  $('view-description').textContent=state.view==='saved'?'你的浏览器本地收藏。即使原记录清理，已收藏的摘要仍可在这里阅读。':'产品发布、模型进展、开发实践。收集信息，也留一点时间思考。';
  $('list-title').firstChild.textContent=state.view==='saved'?'收藏列表 ':'最新收录 ';
  const results=filtered();$('result-count').textContent=results.length+' 篇';
  $('active-filters').hidden=!(state.q||state.importance!=='all'||state.source||state.category||state.days!=='0');$('filter-summary').textContent='找到 '+results.length+' 篇符合条件的内容';
  $('cards').replaceChildren();$('cards').setAttribute('aria-busy',String(busy&&!loaded));
  $('message').hidden=results.length>0;
  if (!results.length) {
    if (busy&&!loaded&&state.view!=='saved') showMessage('正在整理阅读列表…','连接现有采集结果，请稍候。');
    else if(!loaded&&state.view!=='saved') showMessage('暂时无法获取内容','请稍后重试。你的本地收藏仍可阅读。',{label:'重新加载',run:()=>fetchFeed()});
    else if(state.view==='saved'&&!Object.keys(saved).length)showMessage('把值得细读的内容收藏起来','点击卡片上的 ☆，它就会留在这里。收藏仅存在当前浏览器，建议定期导出。');
    else showMessage('没有找到符合条件的内容','试试换个关键词，或减少筛选条件。',{label:'清除筛选',run:clearFilters});
  }
  const fragment=document.createDocumentFragment();results.slice(0,shown).forEach((item,index)=>fragment.append(card(item,index===0&&item.importance==='high'&&state.view!=='saved')));$('cards').append(fragment);
  $('load-more').hidden=results.length<=shown;$('list-end').textContent=results.length?'已显示 '+Math.min(shown,results.length)+' / '+results.length+' 篇':'';
  if(previousSaveId&&previousFocus!==document.activeElement){const replacement=$('cards').querySelector('[data-item-id="'+previousSaveId+'"] .save-button');if(replacement)replacement.focus({preventScroll:true});else $('feed').focus({preventScroll:true});}
  syncURL();
}
function change(key,value) {state[key]=value;shown=PAGE_SIZE;render();}
function clearFilters() {Object.assign(state,{q:'',importance:'all',source:'',category:'',days:'0'});$('search').value='';$('source').value='';$('category').value='';$('days').value='0';shown=PAGE_SIZE;render();}
document.querySelectorAll('[data-view]').forEach(node=>node.addEventListener('click',()=>change('view',node.dataset.view)));
document.querySelectorAll('[data-importance]').forEach(node=>node.addEventListener('click',()=>change('importance',node.dataset.importance)));
$('search').value=state.q;$('search').addEventListener('input',event=>{const value=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>change('q',value),150);});
for(const key of ['source','category','days','sort']){$(key).value=state[key];$(key).addEventListener('change',event=>change(key,event.target.value));}
$('clear').addEventListener('click',clearFilters);$('load-more').addEventListener('click',()=>{shown+=PAGE_SIZE;render();});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!$('detail').open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('search').focus();}});
$('export').addEventListener('click',()=>{
  const values=Object.values(saved).sort((a,b)=>timestamp(b.saved_at)-timestamp(a.saved_at));if(!values.length){toast('先收藏几篇内容，再导出阅读清单。');return;}
  const safe=s=>String(s||'').replace(/[\\`*_[\]<>#]/g,'\\$&');
  const lines=['# AI-Sub 收藏清单','',`导出时间：${new Date().toLocaleString('zh-CN')} · 共 ${values.length} 篇`,'','收藏保存在浏览器，以下内容为导出时的摘要快照。',''];
  for(const item of values)lines.push(`## ${safe(title(item))}`,'',`${safe(item.source)} · ${item.kind==='release'?'产品更新':'技术博客'} · ${priorities[item.importance]||'了解'} · ${dateText(item.published_date||item.fetched_at)}`,'',safe(item.summary_zh||item.summary),'',`原文：${item.url.replace(/[\r\n]/g,'')}`,'');
  const blob=new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='AI-Sub-收藏-'+new Date().toISOString().slice(0,10)+'.md';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出 '+values.length+' 篇收藏');
});
async function fetchFeed(manual=false) {
  if(busy)return;busy=true;$('refresh').disabled=true;render();
  try {
    const response=await fetch('./api/feed',{cache:manual?'reload':'default',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('HTTP '+response.status);const payload=await response.json();if(!Array.isArray(payload.items))throw new Error('Invalid feed');
    items=payload.items.filter(validItem);loaded=true;fillOptions('source','source','所有来源');fillOptions('category','category','所有主题');
    $('updated').textContent=payload.latest_fetched_at?'最近收录 '+dateText(payload.latest_fetched_at,true):'暂无新收录';$('updated').title='页面每 5 分钟同步；最近收录为采集时间。';
    if(payload.truncated)toast('当前展示最近 '+payload.limit+' 篇，较早内容请提前收藏。');else if(manual)toast('已同步最新内容');
  }catch(error){$('updated').textContent=loaded?'同步失败，保留当前内容':'暂时无法连接数据源';if(loaded||manual)toast('同步失败，请稍后重试。');}
  finally{busy=false;$('refresh').disabled=false;render();}
}
$('refresh').addEventListener('click',()=>fetchFeed(true));
window.addEventListener('storage',event=>{if(event.key===STORE){try{const next=JSON.parse(event.newValue||'{}');saved=Object.fromEntries(Object.entries(next).filter(([key,value])=>validItem(value)&&key===value.id));render();if(activeItem)updateDetailSave();}catch{}}});
const now=new Date();$('date-stamp').append(el('span','',now.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()),el('strong','',String(now.getMonth()+1).padStart(2,'0')+' / '+String(now.getDate()).padStart(2,'0')));
fetchFeed();setInterval(()=>{if(!document.hidden)fetchFeed();},300000);
if(!storageAvailable)toast('浏览器存储不可用，收藏后请导出保存。');
