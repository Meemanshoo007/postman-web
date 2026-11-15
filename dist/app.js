import { uid, blankRequest, normalizeRequest, parseCurl, generateCurl, buildRequest, parseUrlParams, urlWithParams, formatBytes } from './core.js';
import { icon } from './icons.js';

const STORAGE_KEY = 'relay.workspace.v1';
const $ = (selector, root=document) => root.querySelector(selector);
const esc = (value='') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clone = value => JSON.parse(JSON.stringify(value));
const methods = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'];
const button = (action, name, text='', classes='icon-button', attrs='') => `<button class="${classes}" data-action="${action}" ${attrs} title="${esc(text || action)}" aria-label="${esc(text || action)}">${name ? icon(name) : ''}${classes.includes('icon-button') ? '' : esc(text)}</button>`;
const method = value => `<span class="method ${esc(value.toLowerCase())}">${esc(value)}</span>`;
let storageError = '';

function seed() {
  const collectionId = uid(), secondId = uid();
  const make = (name, verb, url, body='') => normalizeRequest({...blankRequest(),name,method:verb,url,params:parseUrlParams(url),headers:[{id:uid(),key:'Accept',value:'application/json',enabled:true}],bodyType:body?'json':'none',body,collectionId});
  const requests = [
    make('Get all posts','GET','https://jsonplaceholder.typicode.com/posts?_limit=5'),
    make('Get a single post','GET','https://jsonplaceholder.typicode.com/posts/1'),
    make('Create a post','POST','https://jsonplaceholder.typicode.com/posts',JSON.stringify({title:'Hello from Relay',body:'Your next great idea starts with a request.',userId:1},null,2)),
    normalizeRequest({...blankRequest(),name:'Echo a request',url:'https://httpbin.org/get',collectionId:secondId})
  ];
  return {version:1,collections:[{id:collectionId,name:'Getting started',open:true},{id:secondId,name:'HTTP playground',open:false}],requests,tabs:[clone(requests[0])],activeId:requests[0].id,history:[],environments:[{id:uid(),name:'Development',variables:[{id:uid(),key:'base_url',value:'https://jsonplaceholder.typicode.com',enabled:true}]}],activeEnv:'',settings:{theme:'dark',timeout:30,credentials:false}};
}
function hydrate(data) {
  if (!data || !Array.isArray(data.collections) || !Array.isArray(data.requests)) throw new Error('This is not a valid Relay workspace.');
  const d = seed();
  d.collections = data.collections.map(c=>({id:String(c.id||uid()),name:String(c.name||'Collection'),open:c.open!==false}));
  d.requests = data.requests.map(normalizeRequest);
  d.tabs = Array.isArray(data.tabs) && data.tabs.length ? data.tabs.map(normalizeRequest) : [blankRequest()];
  d.activeId = d.tabs.some(t=>t.id===data.activeId) ? data.activeId : d.tabs[0].id;
  d.history = Array.isArray(data.history) ? data.history.filter(h=>h?.request).slice(0,100).map(h=>({...h,id:String(h.id||uid()),status:Number(h.status)||0,request:normalizeRequest(h.request)})) : [];
  d.environments = Array.isArray(data.environments) ? data.environments.map(e=>({id:String(e.id||uid()),name:String(e.name||'Environment'),variables:Array.isArray(e.variables)?e.variables.map(v=>({id:uid(),key:String(v.key||''),value:String(v.value||''),enabled:v.enabled!==false})):[]})) : [];
  d.activeEnv = d.environments.some(e=>e.id===data.activeEnv)?data.activeEnv:'';
  d.settings = {...d.settings,...data.settings,timeout:Math.min(300,Math.max(1,Number(data.settings?.timeout)||30)),theme:data.settings?.theme==='light'?'light':'dark'};
  return d;
}
let state;
try { const raw=localStorage.getItem(STORAGE_KEY); state=raw?hydrate(JSON.parse(raw)):seed(); }
catch { state=seed(); storageError='Browser storage could not be loaded. Use Export to keep a backup.'; }
let view='collections', search='', configTab='params', responseTab='body', responseMode='pretty', responseSearch='', modal='', lastFocus=null;
const responses = new Map(), pending = new Map();
let toastTimer, persistTimer;
const current = () => state.tabs.find(t=>t.id===state.activeId) || state.tabs[0];
const vars = () => Object.fromEntries((state.environments.find(e=>e.id===state.activeEnv)?.variables||[]).filter(v=>v.enabled && v.key).map(v=>[v.key,v.value]));
function persist() {
  clearTimeout(persistTimer);
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); $('#storage-status')?.replaceChildren(document.createTextNode('All changes saved locally')); }
  catch { $('#storage-status')?.replaceChildren(document.createTextNode('Storage full · export a backup')); toast('Could not save to browser storage. Export a backup.',true); }
}
function changed() { clearTimeout(persistTimer);persistTimer=setTimeout(persist,200); updateSaveState();for(const key of ['params','headers']){const count=$(`[data-action="config-tab"][data-value="${key}"] .tab-count`);if(count)count.textContent=current()[key].filter(r=>r.key&&r.enabled).length;} }
function dirty(req=current()) { const saved=state.requests.find(r=>r.id===req.id); return !saved || JSON.stringify(saved)!==JSON.stringify(req); }
function updateSaveState() { const el=$('#save-state'); if(el) el.textContent=dirty()?'Unsaved changes':'Saved in collection'; const dot=$('.request-tab.active .tab-dirty'); if(dot) dot.hidden=!dirty(); }
function toast(message,error=false) { const el=$('#toast'); el.textContent=message; el.className=`toast visible ${error?'is-error':''}`; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),4200); }
function render() {
  document.documentElement.dataset.theme=state.settings.theme;
  $('#app').innerHTML=`<div class="app-shell">
    <header class="topbar"><a class="brand" href="#" aria-label="Relay home"><span class="brand-mark">${icon('bolt')}</span>relay<span class="brand-dot">.</span></a><nav class="top-nav"><button class="active" data-action="workspace">Workspace</button><button data-action="help">How it works ${icon('export')}</button></nav><div class="top-actions"><span class="private-note">${icon('lock')} Your workspace. Your device.</span>${button('theme',state.settings.theme==='dark'?'sun':'moon','Switch color theme')}<button class="avatar" data-action="settings" title="Workspace settings">M</button></div></header>
    <div class="workspace-bar"><div class="workspace-label">${button('toggle-sidebar','menu','Toggle sidebar','icon-button mobile-menu')} ${icon('environment')}<strong>Personal workspace</strong><span class="local-badge"><i></i> LOCAL</span></div><div class="workspace-actions">${button('new-request','plus','New request','button secondary small')}${button('import','import','Import','button secondary small')}</div></div>
    <div class="workspace-layout"><nav class="activity-rail" aria-label="Workspace navigation">${rail('collections','collection','Collections')}${rail('history','history','History')}${rail('environments','environment','Variables')}<div class="rail-bottom">${rail('help','help','Help')}${rail('settings','settings','Settings')}</div></nav><aside class="sidebar" id="sidebar"></aside><main class="main-workspace"><div class="request-tabs" id="request-tabs"></div><div class="request-workspace"><div class="request-heading"><div class="breadcrumb" id="breadcrumb"></div><div class="request-actions"><span id="save-state" class="muted save-state"></span>${button('save','save','Save','button secondary small')}${button('code','code','cURL','button secondary small')}</div></div><form class="url-bar" id="request-form"><div class="method-select"><select id="request-method" aria-label="HTTP method">${methods.map(m=>`<option ${m===current().method?'selected':''}>${m}</option>`).join('')}</select></div><input id="request-url" class="url-input" aria-label="Request URL" placeholder="Enter a URL or paste a cURL command" spellcheck="false" autocomplete="off" value="${esc(current().url)}"><button class="send-button" type="submit" id="send-button">Send ${icon('arrow')}</button></form><section class="request-config"><div class="section-tabs" id="config-tabs"></div><div class="config-content" id="config-content"></div></section><section class="response-panel" id="response-panel" aria-label="API response"></section></div></main></div>
    <footer class="statusbar"><div class="status-left"><span class="status-dot"></span><span id="storage-status">All changes saved locally</span><span class="status-divider"></span>${icon('shield')}<span>No cloud. No database.</span></div><div class="status-right"><span>Send request</span><kbd>Ctrl</kbd><kbd>↵</kbd><span class="status-divider"></span><span>Relay v1.0</span></div></footer></div>`;
  renderSidebar(); renderTabs(); renderHeading(); renderConfig(); renderResponse(); updateSendButton();
}
function rail(action,name,label) { return `<button class="rail-button ${view===action?'active':''}" data-action="${action}" title="${label}">${icon(name)}<span>${label}</span></button>`; }
function renderTabs() {
  $('#request-tabs').innerHTML=state.tabs.map(t=>`<div class="request-tab ${t.id===state.activeId?'active':''}" role="tab" aria-selected="${t.id===state.activeId}"><button class="tab-label" data-action="open-tab" data-id="${esc(t.id)}">${method(t.method)}<span>${esc(t.name)}</span><i class="tab-dirty" ${dirty(t)?'':'hidden'}></i></button>${button('close-tab','close','Close '+t.name,'icon-button tab-close',`data-id="${esc(t.id)}"`)}</div>`).join('')+button('new-request','plus','New request tab','icon-button tab-new');
}
function renderHeading() { const req=current(), collection=state.collections.find(c=>c.id===req.collectionId); $('#breadcrumb').innerHTML=`${icon('folder')}<span>${esc(collection?.name||'Scratch pad')}</span>${icon('chevron')}<button data-action="save" class="request-name">${esc(req.name)}</button>`; updateSaveState(); }
function renderSidebar() {
  const title=view==='history'?'History':view==='environments'?'Environments':'Collections';
  $('#sidebar').innerHTML=`<div class="sidebar-heading"><strong>${title}</strong><span class="count-badge">${view==='history'?state.history.length:view==='environments'?state.environments.length:state.collections.length}</span><div class="sidebar-heading-actions">${button(view==='history'?'clear-history':view==='environments'?'new-environment':'new-collection',view==='history'?'trash':'plus',view==='history'?'Clear history':view==='environments'?'New environment':'New collection')}${button('export','export','Export workspace')}</div></div><div class="sidebar-tools"><div class="search-box">${icon('search')}<input id="sidebar-search" value="${esc(search)}" placeholder="${view==='history'?'Search history':view==='environments'?'Search environments':'Search collections'}" aria-label="Search workspace"><kbd>⌘ K</kbd></div></div><div class="sidebar-content" id="sidebar-list"></div><div class="sidebar-footer"><div class="local-illustration">${icon('shield')}</div><strong>A little lighter. All yours.</strong><p>Your requests stay in this browser.<br>No account needed.</p><button class="text-button" data-action="export">Back up your workspace ${icon('arrow')}</button></div>`;
  renderSidebarList();
}
function renderSidebarList() {
  const query=search.toLowerCase(); let html='';
  if(view==='collections') {
    for(const c of state.collections) {
      const requests=state.requests.filter(r=>r.collectionId===c.id);
      const matches=requests.filter(r=>`${r.name} ${r.url} ${r.method}`.toLowerCase().includes(query));
      if(query&&!c.name.toLowerCase().includes(query)&&!matches.length) continue;
      html+=`<div class="collection"><div class="collection-heading"><button class="collection-toggle" data-action="toggle-collection" data-id="${esc(c.id)}"><span class="collection-chevron ${c.open||query?'expanded':''}">${icon('chevron')}</span>${icon('folder')}<span>${esc(c.name)}</span><small>${requests.length}</small></button>${button('collection-menu','more','Collection options','icon-button collection-more',`data-id="${esc(c.id)}"`)}</div>${c.open||query?`<div class="collection-children">${(query&&!c.name.toLowerCase().includes(query)?matches:requests).map(r=>`<div class="request-item ${r.id===state.activeId?'active':''}"><button class="request-link" data-action="open-request" data-id="${esc(r.id)}">${method(r.method)}<span>${esc(r.name)}</span></button>${button('request-menu','more','Request options','icon-button request-more',`data-id="${esc(r.id)}"`)}</div>`).join('')}${!requests.length?'<div class="collection-empty">Save a request here to get started.</div>':''}</div>`:''}</div>`;
    }
    const loose=state.requests.filter(r=>!state.collections.some(c=>c.id===r.collectionId)&&`${r.name} ${r.url}`.toLowerCase().includes(query));
    html+=loose.map(r=>`<div class="request-item ${r.id===state.activeId?'active':''}"><button class="request-link" data-action="open-request" data-id="${esc(r.id)}">${method(r.method)}<span>${esc(r.name)}</span></button>${button('request-menu','more','Request options','icon-button',`data-id="${esc(r.id)}"`)}</div>`).join('');
    html+=`<button class="add-collection" data-action="new-collection">${icon('plus')} Create collection</button>`;
  } else if(view==='history') {
    html=state.history.filter(h=>`${h.request.name} ${h.request.url}`.toLowerCase().includes(query)).map(h=>`<button class="history-item" data-action="open-history" data-id="${esc(h.id)}"><div>${method(h.request.method)}<span>${esc(h.request.name)}</span><small class="${h.status>=400||!h.status?'error-text':'green'}">${h.status||'ERR'}</small></div><p>${esc(h.request.url)}</p><time>${new Date(h.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></button>`).join('');
  } else {
    html=state.environments.filter(e=>e.name.toLowerCase().includes(query)).map(e=>`<button class="environment-item ${e.id===state.activeEnv?'selected':''}" data-action="edit-environment" data-id="${esc(e.id)}">${icon('environment')}<span>${esc(e.name)}<small>${e.variables.filter(v=>v.key).length} variables</small></span>${e.id===state.activeEnv?'<i class="status-dot"></i>':icon('chevron')}</button>`).join('');
  }
  $('#sidebar-list').innerHTML=html||`<div class="sidebar-empty">${icon(view==='history'?'history':'search')}<strong>${search?'No matches found':view==='history'?'A fresh start':'No environments yet'}</strong><p>${search?'Try a different search.':view==='history'?'Your sent requests will appear here.':'Create reusable variables for your requests.'}</p></div>`;
}
function renderConfig() {
  const req=current();
  $('#config-tabs').innerHTML=['params','authorization','headers','body'].map(t=>`<button class="section-tab ${configTab===t?'active':''}" data-action="config-tab" data-value="${t}">${t==='authorization'?'Authorization':t[0].toUpperCase()+t.slice(1)}${['params','headers'].includes(t)?`<span class="tab-count">${req[t].filter(r=>r.key&&r.enabled).length}</span>`:t==='authorization'&&req.auth.type!=='none'?'<span class="active-dot"></span>':t==='body'&&req.bodyType!=='none'?'<span class="active-dot"></span>':''}</button>`).join('')+`<div class="environment-select">${icon('environment')}<select id="active-environment" aria-label="Active environment"><option value="">No environment</option>${state.environments.map(e=>`<option value="${esc(e.id)}" ${e.id===state.activeEnv?'selected':''}>${esc(e.name)}</option>`).join('')}</select>${button('environments','settings','Manage environments')}</div>`;
  const content=$('#config-content');
  if(configTab==='params'||configTab==='headers') content.innerHTML=`<div class="config-caption"><span>${configTab==='params'?'Query parameters':'Request headers'}</span><span class="muted">Use <code>{{variables}}</code> anywhere</span></div>${kvTable(req[configTab],configTab)}<button class="add-row" data-action="add-row" data-target="${configTab}">${icon('plus')} Add ${configTab==='params'?'parameter':'header'}</button>`;
  if(configTab==='authorization') content.innerHTML=`<div class="auth-layout"><div class="field"><label for="auth-type">Auth type</label><select id="auth-type"><option value="none" ${req.auth.type==='none'?'selected':''}>No authentication</option><option value="bearer" ${req.auth.type==='bearer'?'selected':''}>Bearer token</option><option value="basic" ${req.auth.type==='basic'?'selected':''}>Basic auth</option><option value="apiKey" ${req.auth.type==='apiKey'?'selected':''}>API key</option></select><p class="muted">Applied when you send the request.</p></div><div class="auth-fields">${authFields(req.auth)}</div></div>`;
  if(configTab==='body') content.innerHTML=`<div class="body-toolbar">${['none','json','text','form'].map(t=>`<label class="radio-label"><input type="radio" name="body-type" value="${t}" ${req.bodyType===t?'checked':''}>${{none:'None',json:'JSON',text:'Text',form:'Form URL encoded'}[t]}</label>`).join('')}${req.bodyType==='json'?button('format-body','code','Beautify','button small secondary'):''}</div>${req.bodyType==='none'?'<div class="body-none">This request has no body. Choose a format to add one.</div>':`<textarea id="request-body" class="code-editor" aria-label="Request body" spellcheck="false" placeholder="${req.bodyType==='json'?'&#123; &quot;message&quot;: &quot;Hello, world!&quot; &#125;':req.bodyType==='form'?'name=Relay&hello=world':'Enter your request body'}">${esc(req.body)}</textarea>`}`;
}
function kvTable(rows,target) {
  return `<div class="kv-table"><div class="kv-head"><span></span><span>KEY</span><span>VALUE</span><span></span></div>${rows.map((r,i)=>`<div class="kv-row ${r.enabled?'':'disabled-row'}"><input type="checkbox" data-row-target="${target}" data-index="${i}" data-field="enabled" aria-label="Enable ${target} row ${i+1}" ${r.enabled?'checked':''}><input data-row-target="${target}" data-index="${i}" data-field="key" aria-label="${target} key ${i+1}" placeholder="Key" value="${esc(r.key)}" spellcheck="false"><input data-row-target="${target}" data-index="${i}" data-field="value" aria-label="${target} value ${i+1}" placeholder="Value" value="${esc(r.value)}" spellcheck="false">${button('delete-row','close','Remove row','icon-button',`data-target="${target}" data-index="${i}"`)}</div>`).join('')}${!rows.length?'<div class="table-empty">No entries yet. Add a row below.</div>':''}</div>`;
}
function authFields(auth) {
  const field=(key,label,type='text',placeholder='')=>`<div class="field"><label for="auth-${key}">${label}</label><input type="${type}" id="auth-${key}" data-auth="${key}" value="${esc(auth[key])}" placeholder="${placeholder}" autocomplete="off" spellcheck="false"></div>`;
  if(auth.type==='none') return `<div class="auth-none">${icon('lock')}<span>This request doesn’t use authentication.</span></div>`;
  if(auth.type==='bearer') return field('token','Token','password','Enter token or {{token}}');
  if(auth.type==='basic') return field('username','Username')+field('password','Password','password');
  return field('key','Key','text','X-API-Key')+field('value','Value','password','Enter API key or {{api_key}}')+`<div class="field"><label for="auth-addTo">Add to</label><select id="auth-addTo" data-auth="addTo"><option value="header" ${auth.addTo==='header'?'selected':''}>Header</option><option value="query" ${auth.addTo==='query'?'selected':''}>Query parameters</option></select></div>`;
}
function renderResponse() {
  const data=responses.get(state.activeId), loading=pending.has(state.activeId);
  $('#response-panel').innerHTML=`<div class="response-header"><div class="response-tabs"><strong>Response</strong><button class="section-tab ${responseTab==='body'?'active':''}" data-action="response-tab" data-value="body">Body</button><button class="section-tab ${responseTab==='headers'?'active':''}" data-action="response-tab" data-value="headers">Headers ${data&&!data.error?`<span class="tab-count">${data.headers.length}</span>`:''}</button></div><div class="response-meta">${data&&!data.error?`<span class="status-badge ${data.status>=400?'error':''}"><i></i>${data.status} ${esc(data.statusText)}</span><span>${icon('clock')}${Math.round(data.time)} ms</span><span>${formatBytes(data.size)}</span>`:`<span class="muted">${loading?'Request in progress':data?.error?'Request failed':'No response yet'}</span>`}</div></div><div id="response-inner" class="response-inner"></div>`;
  const inner=$('#response-inner');
  if(loading) { inner.innerHTML=`<div class="response-empty"><div class="request-spinner"></div><h2 class="empty-title">Making the connection…</h2><p class="empty-description">Waiting for the server to respond.</p><button class="button secondary" data-action="cancel">Cancel request</button></div>`; return; }
  if(data?.error) { inner.innerHTML=`<div class="response-error">${icon('alert')}<h2>Couldn’t complete this request</h2><p>${esc(data.error)}</p>${data.network?'<div class="error-help"><strong>Browser access matters</strong><p>The API must allow this website’s origin through CORS. Also check your connection and the URL. HTTPS pages may block HTTP endpoints. Relay sends requests directly; there is no proxy.</p><button class="button secondary small" data-action="code">Copy as cURL</button></div>':''}</div>`; return; }
  if(!data) { inner.innerHTML=`<div class="response-empty"><div class="empty-orbit"><span class="orbit-dot one"></span><span class="orbit-dot two"></span><div class="empty-icon">${icon('bolt')}</div></div><span class="empty-kicker">FROM REQUEST TO RESPONSE</span><h2 class="empty-title">Good things start with a request.</h2><p class="empty-description">Enter an endpoint, fine-tune the details, and hit Send.<br>Your next discovery is one request away.</p><div class="shortcut-hints"><span><kbd>Ctrl</kbd> + <kbd>↵</kbd> to send</span><span class="hint-separator">·</span><button data-action="import">${icon('terminal')} Import cURL</button></div></div><div class="response-bottom-note">${icon('shield')} Requests go directly from your browser to your API.</div>`; return; }
  if(responseTab==='headers') { inner.innerHTML=`<div class="response-content response-headers"><div class="response-header-row"><strong>HEADER</strong><strong>VALUE</strong></div>${data.headers.map(([k,v])=>`<div class="response-header-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}<p class="muted header-note">Only headers exposed by the server to your browser are available.</p></div>`; return; }
  inner.innerHTML=`<div class="response-toolbar"><div class="segmented"><button data-action="response-mode" data-value="pretty" class="${responseMode==='pretty'?'active':''}">Pretty</button><button data-action="response-mode" data-value="raw" class="${responseMode==='raw'?'active':''}">Raw</button></div><span class="response-format">${data.json?'JSON':'TEXT'}</span><div class="response-tools"><div class="response-find">${icon('search')}<input id="response-search" aria-label="Find in response" placeholder="Find in response" value="${esc(responseSearch)}"></div>${button('copy-response','copy','Copy response')}${button('download-response','download','Download response')}</div></div><div class="response-content"><pre class="code-view" id="response-code"></pre></div>${data.truncated?'<div class="response-truncated">Response exceeded 5 MB. Showing a partial response.</div>':''}`;
  renderCode(data);
}
function highlighted(line) { return esc(line).replace(/(&quot;(?:[^&]|&(?!quot;)|&quot;(?=\s*[^:,}\]]))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/gi,(m,str,colon,bool,num)=>str?`<span class="${colon?'json-key':'json-string'}">${str}</span>${colon||''}`:bool?`<span class="json-boolean">${bool}</span>`:`<span class="json-number">${num}</span>`); }
function renderCode(data=responses.get(state.activeId)) { if(!data||!$('#response-code'))return; let body=data.body; if(responseMode==='pretty'&&data.json)body=JSON.stringify(data.jsonValue,null,2); const lines=body.split('\n'), query=responseSearch.toLowerCase(); $('#response-code').innerHTML=lines.map((line,i)=>({line,i})).filter(({line})=>!query||line.toLowerCase().includes(query)).map(({line,i})=>`<span class="code-line"><span class="line-number">${i+1}</span><span class="line-content">${data.json&&responseMode==='pretty'?highlighted(line):esc(line)||' '}</span></span>`).join('')||'<span class="code-no-results">No matching lines.</span>'; }
function updateSendButton() { const b=$('#send-button'), loading=pending.has(state.activeId); b.innerHTML=loading?`Cancel ${icon('close')}`:`Send ${icon('arrow')}`; b.classList.toggle('is-loading',loading); }
function openRequest(req) { if(!state.tabs.some(t=>t.id===req.id))state.tabs.push(clone(req)); state.activeId=req.id;responseSearch='';persist();render(); }
function newRequest() { const req=blankRequest();state.tabs.push(req);state.activeId=req.id;configTab='params';persist();render();$('#request-url').focus(); }
function closeTab(id) { if(pending.has(id))pending.get(id).controller.abort();state.tabs=state.tabs.filter(t=>t.id!==id);if(!state.tabs.length)state.tabs.push(blankRequest());if(state.activeId===id)state.activeId=state.tabs.at(-1).id;responses.delete(id);persist();render(); }

async function sendRequest() {
  const request=clone(current()), id=request.id;
  if(pending.has(id)) { pending.get(id).controller.abort();return; }
  let built;
  try { built=buildRequest(request,vars()); }
  catch(error) { responses.set(id,{error:error.message});renderResponse();return; }
  const controller=new AbortController(), started=performance.now();let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true;controller.abort();},state.settings.timeout*1000);
  pending.set(id,{controller});updateSendButton();renderResponse();
  let result;
  try {
    const response=await fetch(built.url,{...built.options,signal:controller.signal,credentials:state.settings.credentials?'include':'omit'});
    const reader=response.body?.getReader(), decoder=new TextDecoder();let size=0,body='',truncated=false;
    if(reader) { while(true) { const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5*1024*1024){truncated=true;await reader.cancel();break;}body+=decoder.decode(value,{stream:true}); } body+=decoder.decode(); }
    let json=false,jsonValue=null;try{jsonValue=JSON.parse(body);json=true;}catch{}
    result={status:response.status,statusText:response.statusText||({200:'OK',201:'Created',204:'No Content',400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',500:'Server Error'}[response.status]||''),headers:[...response.headers.entries()],body,time:performance.now()-started,size,json,jsonValue,truncated};
  } catch(error) { result={error:controller.signal.aborted?(timedOut?`The request timed out after ${state.settings.timeout} seconds.`:'The request was canceled.'):error.message||'A network error occurred.',network:!controller.signal.aborted,time:performance.now()-started}; }
  finally { clearTimeout(timeout);pending.delete(id); }
  responses.set(id,result);
  state.history.unshift({id:uid(),date:new Date().toISOString(),request,status:result.status||0,time:result.time});state.history=state.history.slice(0,100);persist();
  if(current().id===id){updateSendButton();renderResponse();}if(view==='history')renderSidebar();
}

function showModal(type,title,body,footer='') {
  modal=type;lastFocus=document.activeElement;
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${type==='help'?'help-modal':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header class="modal-header"><h2 id="modal-title">${title}</h2>${button('close-modal','close','Close dialog')}</header><div class="modal-body">${body}</div>${footer?`<footer class="modal-footer">${footer}</footer>`:''}</section></div>`;
  setTimeout(()=>($('.modal input:not([type="file"]), .modal textarea, .modal button')||$('.modal')).focus(),0);
}
function closeModal() { modal='';$('#modal-root').innerHTML='';lastFocus?.focus(); }
const cancelButton=()=>button('close-modal','','Cancel','button secondary');
function saveModal() {
  const req=current();
  showModal('save','Save request',`<p class="modal-description">Give this request a home in your local workspace.</p><div class="field"><label for="save-name">Request name</label><input id="save-name" value="${esc(req.name)}" placeholder="e.g. Get all users"></div><div class="field"><label for="save-collection">Collection</label><select id="save-collection"><option value="">Unfiled requests</option>${state.collections.map(c=>`<option value="${esc(c.id)}" ${c.id===req.collectionId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>`,cancelButton()+button('confirm-save','save','Save request','button primary'));
}
function saveRequest() { const name=$('#save-name').value.trim();if(!name){$('#save-name').focus();return;}const req=current();req.name=name;req.collectionId=$('#save-collection').value||null;const i=state.requests.findIndex(r=>r.id===req.id);if(i<0)state.requests.push(clone(req));else state.requests[i]=clone(req);const c=state.collections.find(c=>c.id===req.collectionId);if(c)c.open=true;persist();closeModal();render();toast('Request saved to your workspace'); }
function importModal() { showModal('import','Bring your requests along',`<p class="modal-description">Paste a cURL command, a Postman collection (v2), or a Relay workspace backup.</p><textarea id="import-text" class="import-textarea" spellcheck="false" placeholder="curl 'https://api.example.com/users' \\\n  -H 'Accept: application/json'"></textarea><div class="import-file-row">${icon('folder')}<label class="text-button" for="import-file">Choose a JSON file</label><input type="file" id="import-file" accept=".json,application/json" hidden><span class="muted">Or paste it above</span></div><div class="modal-error" id="import-error" role="alert"></div>`,cancelButton()+button('confirm-import','import','Import','button primary')); }
function postmanRequests(items,collectionId,prefix='',inheritedAuth=null) {
  const requests=[];
  for(const item of items||[]) {
    if(item.item){requests.push(...postmanRequests(item.item,collectionId,prefix+String(item.name||'Folder')+' / ',item.auth||inheritedAuth));continue;}
    const r=typeof item.request==='string'?{url:item.request}:item.request;if(!r)continue;
    const url=typeof r.url==='string'?r.url:r.url?.raw||'';
    const auth={...blankRequest().auth};const a=r.auth||inheritedAuth;
    if(a?.type==='bearer'){auth.type='bearer';auth.token=a.bearer?.find(x=>x.key==='token')?.value||'';}
    if(a?.type==='basic'){auth.type='basic';for(const key of ['username','password'])auth[key]=a.basic?.find(x=>x.key===key)?.value||'';}
    if(a?.type==='apikey'){auth.type='apiKey';auth.key=a.apikey?.find(x=>x.key==='key')?.value||'';auth.value=a.apikey?.find(x=>x.key==='value')?.value||'';auth.addTo=a.apikey?.find(x=>x.key==='in')?.value==='query'?'query':'header';}
    if(r.body?.mode&&!['raw','urlencoded'].includes(r.body.mode))throw new Error('This collection contains a file or multipart body. Import requests with raw or URL-encoded bodies instead.');
    requests.push(normalizeRequest({...blankRequest(),name:prefix+(item.name||'Imported request'),method:r.method||'GET',url,params:Array.isArray(r.url?.query)?r.url.query.map(q=>({id:uid(),key:q.key,value:q.value??'',enabled:!q.disabled})):parseUrlParams(url),collectionId,headers:(r.header||[]).map(h=>({id:uid(),key:h.key,value:h.value,enabled:!h.disabled})),auth,bodyType:r.body?.mode==='urlencoded'?'form':r.body?.mode==='raw'?(r.body.options?.raw?.language==='json'?'json':'text'):'none',body:r.body?.mode==='urlencoded'?new URLSearchParams((r.body.urlencoded||[]).filter(p=>!p.disabled).map(p=>[p.key,p.value])).toString():r.body?.raw||''}));
  }
  return requests;
}
function doImport() {
  try {
    const text=$('#import-text').value.trim();if(!text)throw new Error('Paste a cURL command or choose a JSON file first.');
    if(/^curl\b/i.test(text)) { const req=parseCurl(text);req.name='Imported request';closeModal();openRequest(req);toast('cURL imported. Review the request and send when ready.');return; }
    const data=JSON.parse(text);
    if(data.version===1&&Array.isArray(data.collections)&&Array.isArray(data.requests)) {
      const imported=hydrate(data), idMap=new Map(),requestIdMap=new Map();
      imported.collections.forEach(c=>{const id=uid();idMap.set(c.id,id);state.collections.push({...c,id});});
      imported.requests.forEach(r=>{const id=uid();requestIdMap.set(r.id,id);state.requests.push({...r,id,collectionId:idMap.get(r.collectionId)||null});});
      imported.tabs.forEach(r=>state.tabs.push({...r,id:requestIdMap.get(r.id)||uid(),collectionId:idMap.get(r.collectionId)||null}));
      state.history=[...imported.history.map(h=>({...h,id:uid()})),...state.history].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,100);
      imported.environments.forEach(e=>state.environments.push({...e,id:uid()}));
      persist();closeModal();view='collections';render();toast(`Imported ${imported.requests.length} saved requests, drafts, variables, and history. Current settings were kept.`);return;
    }
    if(Array.isArray(data.item)) {
      const collection={id:uid(),name:String(data.info?.name||'Imported collection'),open:true};const requests=postmanRequests(data.item,collection.id,'',data.auth);
      if(!requests.length)throw new Error('This collection has no supported requests.');
      const environment=Array.isArray(data.variable)&&data.variable.length?{id:uid(),name:collection.name,variables:data.variable.filter(v=>v?.key).map(v=>({id:uid(),key:String(v.key),value:String(v.value??''),enabled:!v.disabled}))}:null;
      state.collections.push(collection);state.requests.push(...requests);
      if(environment){state.environments.push(environment);state.activeEnv=environment.id;}
      persist();closeModal();view='collections';openRequest(requests[0]);toast(`Imported ${requests.length} requests`);return;
    }
    throw new Error('Use a Relay backup or a Postman v2 collection JSON file.');
  }catch(error){const message=error instanceof SyntaxError?'That JSON could not be read. Check the file or paste a cURL command.':error.message;const errorEl=$('#import-error');if(errorEl)errorEl.textContent=message;else toast(message,true);}
}
function download(name,content,type='application/json') { const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function copy(text) { try { await navigator.clipboard.writeText(text);toast('Copied to clipboard'); }catch { toast('Clipboard unavailable. Select the text and copy manually.',true); } }
function codeModal() { let curl;try{curl=generateCurl(current(),vars());}catch(error){toast(error.message,true);return;}showModal('code','Copy as cURL',`<p class="modal-description">Run this command in Bash, zsh, WSL, or Git Bash. Active environment variables are resolved.</p><textarea id="curl-output" class="import-textarea" readonly spellcheck="false">${esc(curl)}</textarea>`,cancelButton()+button('copy-curl','copy','Copy cURL','button primary')); }
function collectionModal(id) {
  const c=state.collections.find(c=>c.id===id);
  showModal('collection',c?'Collection settings':'New collection',`<div class="field"><label for="collection-name">Collection name</label><input id="collection-name" value="${esc(c?.name||'')}" placeholder="e.g. My API" data-id="${esc(c?.id||'')}"></div>${c?'<p class="modal-description">Deleting a collection also removes its saved requests. Open request tabs are kept.</p>':''}`,c?button('delete-collection','trash','Delete','button danger',`data-id="${esc(id)}"`)+button('export-collection','export','Export JSON','button secondary',`data-id="${esc(id)}"`)+button('confirm-collection','check','Save','button primary'):cancelButton()+button('confirm-collection','plus','Create collection','button primary'));
}
function requestMenu(id) { const r=state.requests.find(r=>r.id===id);if(!r)return;showModal('request-menu',esc(r.name),`<p class="modal-description">${method(r.method)} ${esc(r.url)}</p><p class="muted">Open the request and use Save to rename it or move it to another collection.</p>`,button('delete-request','trash','Delete','button danger',`data-id="${esc(id)}"`)+button('duplicate-request','copy','Duplicate','button secondary',`data-id="${esc(id)}"`)+button('edit-saved-request','edit','Edit request','button primary',`data-id="${esc(id)}"`)); }
let editingEnv;
function environmentModal(id) { const original=state.environments.find(e=>e.id===id);editingEnv=clone(original||{id:uid(),name:'',variables:[]});showModal('environment',original?'Edit environment':'New environment',`<div class="field"><label for="environment-name">Environment name</label><input id="environment-name" value="${esc(editingEnv.name)}" placeholder="e.g. Development"></div><p class="modal-description">Use <code>{{variable_name}}</code> in URLs, headers, authentication, and bodies. Values are saved on this device.</p><div id="env-table">${kvTable(editingEnv.variables,'environment')}</div><button class="add-row" data-action="add-env-row">${icon('plus')} Add variable</button>`,(original?button('delete-environment','trash','Delete','button danger',`data-id="${esc(id)}"`):cancelButton())+button('confirm-environment','check','Save environment','button primary')); }
function settingsModal() {showModal('settings','Workspace settings',`<div class="settings-section"><strong>Made to stay local</strong><p class="modal-description">Requests, authentication details, history, and variables are stored in this browser’s local storage. Clearing browser data removes them. Export a backup to move your workspace.</p></div><div class="form-grid"><div class="field"><label for="setting-timeout">Request timeout (seconds)</label><input id="setting-timeout" type="number" min="1" max="300" value="${state.settings.timeout}"></div><div class="field"><label for="setting-theme">Appearance</label><select id="setting-theme"><option value="dark" ${state.settings.theme==='dark'?'selected':''}>Dark</option><option value="light" ${state.settings.theme==='light'?'selected':''}>Light</option></select></div></div><label class="checkbox-label"><input type="checkbox" id="setting-credentials" ${state.settings.credentials?'checked':''}> Include browser cookies in requests</label><p class="muted">The API must support credentialed CORS. Browser cookie restrictions still apply.</p>`,cancelButton()+button('confirm-settings','check','Save settings','button primary'));}
function helpModal() {showModal('help','A small tool for big ideas.',`<p class="modal-description">Relay is your personal, browser-local API workspace.</p><div class="help-item">${icon('send')}<div><strong>Build a request</strong><p>Choose a method, enter a URL, add parameters, headers, authentication, or a body, and press Send.</p></div></div><div class="help-item">${icon('folder')}<div><strong>Make it a collection</strong><p>Use Save to name and organize requests. Draft tabs, collections, variables, and the last 100 requests are remembered locally.</p></div></div><div class="help-item">${icon('terminal')}<div><strong>Bring your cURL</strong><p>Import cURL or Postman v2 collections. Export a request as cURL, a collection as Postman JSON, or your entire workspace as a backup.</p></div></div><div class="help-item">${icon('globe')}<div><strong>Direct from your browser</strong><p>The API needs to allow your origin through CORS. Browser-managed headers and cookies can’t be controlled like a desktop client. There is no backend, proxy, or database.</p></div></div><div class="help-shortcuts"><span><kbd>Ctrl / ⌘</kbd> + <kbd>Enter</kbd> Send</span><span><kbd>Ctrl / ⌘</kbd> + <kbd>S</kbd> Save</span><span><kbd>Ctrl / ⌘</kbd> + <kbd>K</kbd> Search</span></div>`,button('close-modal','check','Got it','button primary'));}

function exportCollection(id) {
  const collection=state.collections.find(c=>c.id===id);if(!collection)return;
  const item=state.requests.filter(r=>r.collectionId===id).map(r=>{
    const auth=r.auth.type==='bearer'?{type:'bearer',bearer:[{key:'token',value:r.auth.token,type:'string'}]}:r.auth.type==='basic'?{type:'basic',basic:[{key:'username',value:r.auth.username,type:'string'},{key:'password',value:r.auth.password,type:'string'}]}:r.auth.type==='apiKey'?{type:'apikey',apikey:[{key:'key',value:r.auth.key,type:'string'},{key:'value',value:r.auth.value,type:'string'},{key:'in',value:r.auth.addTo,type:'string'}]}:{type:'noauth'};
    const request={method:r.method,url:urlWithParams(r.url,r.params),header:r.headers.map(h=>({key:h.key,value:h.value,disabled:!h.enabled})),auth};
    if(r.bodyType==='form')request.body={mode:'urlencoded',urlencoded:[...new URLSearchParams(r.body)].map(([key,value])=>({key,value,type:'text'}))};
    else if(r.bodyType!=='none')request.body={mode:'raw',raw:r.body,options:{raw:{language:r.bodyType==='json'?'json':'text'}}};
    return {name:r.name,request};
  });
  download(`${collection.name.replace(/[^a-z0-9_-]/gi,'-')}.postman_collection.json`,JSON.stringify({info:{name:collection.name,schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},item},null,2));toast('Collection exported as Postman JSON');
}
function updateRow(el) {
  const {rowTarget,index,field}=el.dataset,rows=rowTarget==='environment'?editingEnv?.variables:current()[rowTarget];
  if(!rows?.[index])return;rows[index][field]=field==='enabled'?el.checked:el.value;
  if(rowTarget==='environment')return;
  if(rowTarget==='params'){current().url=urlWithParams(current().url,rows);$('#request-url').value=current().url;}
  changed();
}
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='request-url'){current().url=el.value;current().params=parseUrlParams(el.value);changed();if(configTab==='params')renderConfig();}
  else if(el.id==='request-body'){current().body=el.value;changed();}
  else if(el.id==='sidebar-search'){search=el.value;renderSidebarList();}
  else if(el.id==='response-search'){responseSearch=el.value;renderCode();}
  else if(el.dataset.rowTarget)updateRow(el);
  else if(el.dataset.auth){current().auth[el.dataset.auth]=el.value;changed();}
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.id==='request-method'){current().method=el.value;changed();renderTabs();}
  else if(el.id==='active-environment'){state.activeEnv=el.value;persist();if(view==='environments')renderSidebarList();}
  else if(el.id==='auth-type'){current().auth.type=el.value;changed();renderConfig();}
  else if(el.name==='body-type'){current().bodyType=el.value;changed();renderConfig();}
  else if(el.dataset.auth){current().auth[el.dataset.auth]=el.value;changed();}
  else if(el.dataset.rowTarget&&el.type==='checkbox'){updateRow(el);el.closest('.kv-row').classList.toggle('disabled-row',!el.checked);}
  else if(el.id==='import-file'&&el.files?.[0]){if(el.files[0].size>10*1024*1024){$('#import-error').textContent='Choose a JSON file smaller than 10 MB.';return;}$('#import-text').value=await el.files[0].text();$('#import-error').textContent='';}
});
document.addEventListener('paste',event=>{if(event.target.id!=='request-url')return;const text=event.clipboardData.getData('text').trim();if(!/^curl\b/i.test(text))return;event.preventDefault();importModal();$('#import-text').value=text;});
document.addEventListener('submit',event=>{if(event.target.id==='request-form'){event.preventDefault();sendRequest();}});
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el)return;const {action,id,value,target,index}=el.dataset;
  if(action==='workspace'){view='collections';search='';render();}
  else if(['collections','history','environments'].includes(action)){view=action;search='';render();if(innerWidth<=850)$('.workspace-layout').classList.add('sidebar-open');}
  else if(action==='theme'){state.settings.theme=state.settings.theme==='dark'?'light':'dark';persist();render();}
  else if(action==='toggle-sidebar')$('.workspace-layout').classList.toggle('sidebar-open');
  else if(action==='new-request')newRequest();
  else if(action==='open-tab'){state.activeId=id;responseSearch='';persist();render();}
  else if(action==='open-request'){const req=state.requests.find(r=>r.id===id);if(req)openRequest(req);}
  else if(action==='close-tab'){
    const req=state.tabs.find(t=>t.id===id);if(req&&dirty(req)&&(req.url||req.body))showModal('close-tab','Close this request?',`<p class="modal-description">“${esc(req.name)}” has changes that haven’t been saved to a collection. Closing the tab discards those changes.</p>`,cancelButton()+button('discard-tab','close','Discard and close','button danger',`data-id="${esc(id)}"`));else closeTab(id);
  }
  else if(action==='discard-tab'){closeModal();closeTab(id);}
  else if(action==='toggle-collection'){const c=state.collections.find(c=>c.id===id);c.open=!c.open;persist();renderSidebarList();}
  else if(action==='config-tab'){configTab=value;renderConfig();}
  else if(action==='response-tab'){responseTab=value;renderResponse();}
  else if(action==='response-mode'){responseMode=value;renderResponse();}
  else if(action==='add-row'){current()[target].push({id:uid(),key:'',value:'',enabled:true});changed();renderConfig();$(`[data-row-target="${target}"][data-index="${current()[target].length-1}"][data-field="key"]`)?.focus();}
  else if(action==='delete-row'){
    const rows=target==='environment'?editingEnv.variables:current()[target];rows.splice(Number(index),1);
    if(target==='environment')$('#env-table').innerHTML=kvTable(rows,'environment');else {if(target==='params'){current().url=urlWithParams(current().url,rows);$('#request-url').value=current().url;}changed();renderConfig();}
  }
  else if(action==='format-body'){try{current().body=JSON.stringify(JSON.parse(current().body),null,2);changed();renderConfig();toast('JSON formatted');}catch{toast('The body needs valid JSON before it can be formatted.',true);}}
  else if(action==='save')saveModal();
  else if(action==='confirm-save')saveRequest();
  else if(action==='import')importModal();
  else if(action==='confirm-import')doImport();
  else if(action==='export'){persist();download(`relay-workspace-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2));toast('Workspace exported. The file includes any saved credentials.');}
  else if(action==='code')codeModal();
  else if(action==='copy-curl')copy($('#curl-output').value);
  else if(action==='copy-response'){const r=responses.get(state.activeId);if(r)copy(responseMode==='pretty'&&r.json?JSON.stringify(r.jsonValue,null,2):r.body);}
  else if(action==='download-response'){const r=responses.get(state.activeId);if(r)download(`response-${Date.now()}.${r.json?'json':'txt'}`,r.body,r.json?'application/json':'text/plain');}
  else if(action==='cancel')pending.get(state.activeId)?.controller.abort();
  else if(action==='new-collection')collectionModal();
  else if(action==='collection-menu')collectionModal(id);
  else if(action==='confirm-collection'){
    const input=$('#collection-name'),name=input.value.trim();if(!name){input.focus();return;}const c=state.collections.find(c=>c.id===input.dataset.id);if(c)c.name=name;else state.collections.push({id:uid(),name,open:true});persist();closeModal();render();toast(c?'Collection updated':'Collection created');
  }
  else if(action==='delete-collection'){state.collections=state.collections.filter(c=>c.id!==id);state.requests=state.requests.filter(r=>r.collectionId!==id);for(const t of state.tabs)if(t.collectionId===id)t.collectionId=null;persist();closeModal();render();toast('Collection deleted');}
  else if(action==='export-collection')exportCollection(id);
  else if(action==='request-menu')requestMenu(id);
  else if(action==='edit-saved-request'){const req=state.requests.find(r=>r.id===id);closeModal();if(req){openRequest(req);saveModal();}}
  else if(action==='delete-request'){state.requests=state.requests.filter(r=>r.id!==id);persist();closeModal();render();toast('Saved request deleted. Any open draft was kept.');}
  else if(action==='duplicate-request'){const req=clone(state.requests.find(r=>r.id===id));req.id=uid();req.name+=' (copy)';state.requests.push(req);persist();closeModal();openRequest(req);toast('Request duplicated');}
  else if(action==='open-history'){const h=state.history.find(h=>h.id===id);if(h){const req={...clone(h.request),id:uid(),collectionId:null};openRequest(req);}}
  else if(action==='clear-history')showModal('clear-history','Clear request history?',`<p class="modal-description">Remove all ${state.history.length} history entries from this browser. Your collections and open requests are kept.</p>`,cancelButton()+button('confirm-clear-history','trash','Clear history','button danger'));
  else if(action==='confirm-clear-history'){state.history=[];persist();closeModal();renderSidebar();toast('History cleared');}
  else if(action==='new-environment')environmentModal();
  else if(action==='edit-environment')environmentModal(id);
  else if(action==='add-env-row'){editingEnv.variables.push({id:uid(),key:'',value:'',enabled:true});$('#env-table').innerHTML=kvTable(editingEnv.variables,'environment');$(`[data-row-target="environment"][data-index="${editingEnv.variables.length-1}"][data-field="key"]`).focus();}
  else if(action==='confirm-environment'){
    const name=$('#environment-name').value.trim();if(!name){$('#environment-name').focus();return;}editingEnv.name=name;editingEnv.variables=editingEnv.variables.filter(v=>v.key);const i=state.environments.findIndex(e=>e.id===editingEnv.id);if(i<0)state.environments.push(editingEnv);else state.environments[i]=editingEnv;persist();closeModal();render();toast('Environment saved. Select it above the request editor to use it.');
  }
  else if(action==='delete-environment'){state.environments=state.environments.filter(e=>e.id!==id);if(state.activeEnv===id)state.activeEnv='';persist();closeModal();render();toast('Environment deleted');}
  else if(action==='settings')settingsModal();
  else if(action==='confirm-settings'){const timeout=Number($('#setting-timeout').value);if(!Number.isFinite(timeout)||timeout<1||timeout>300){toast('Timeout must be between 1 and 300 seconds.',true);return;}state.settings={timeout,theme:$('#setting-theme').value,credentials:$('#setting-credentials').checked};persist();closeModal();render();toast('Settings saved');}
  else if(action==='help')helpModal();
  else if(action==='close-modal')closeModal();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&modal){closeModal();return;}
  if(modal&&event.key==='Tab'){
    const focusable=[...document.querySelectorAll('.modal button, .modal input:not([type="file"]), .modal textarea, .modal select, .modal [tabindex="0"]')].filter(el=>!el.disabled&&!el.hidden),first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}return;
  }
  if(!(event.ctrlKey||event.metaKey))return;
  if(event.key==='Enter'){event.preventDefault();if(!modal)sendRequest();}
  if(event.key.toLowerCase()==='s'){event.preventDefault();if(!modal)saveModal();}
  if(event.key.toLowerCase()==='k'){event.preventDefault();if(!modal){if(innerWidth<=850)$('.workspace-layout').classList.add('sidebar-open');$('#sidebar-search').focus();}}
});
window.addEventListener('pagehide',persist);
render();persist();if(storageError)toast(storageError,true);
