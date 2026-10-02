'use strict';
// Runs the unmodified app.js with in-memory DOM, file and storage doubles.
// It exercises browser event code, but cannot validate layout or OS downloads.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),W=require('../engine.js');
const KEY='birdsong-workshop-save-v1';
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function view(options={}){
 const bounds=(r={})=>{const left=r.left||0,top=r.top||0,width=r.width??((r.right??280)-left),height=r.height??((r.bottom??96)-top);return {left,top,width,height,right:left+width,bottom:top+height};};
 const viewportListeners=new Map();
 const elements=new Map(),documentListeners=new Map(),windowListeners=new Map(),downloads=[],blobs=new Map();
 const storage=options.storage||new Map();
 if(!options.storage){const raw=Object.hasOwn(options,'raw')?options.raw:W.exportSave(options.state||W.initialState());if(raw!==null)storage.set(KEY,raw);if(options.previous)storage.set(KEY+'-previous',options.previous);}
 function element(id){
  if(!elements.has(id)){
   const listeners=new Map();const e={innerHTML:'',textContent:'',value:'',open:false,returnValue:'',hidden:true,style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},contains(n){return n===this;},closest(selector){return selector==='#'+id?this:null;},getBoundingClientRect(){const r=bounds(id==='trait-tooltip'?options.tooltipRect:options.rects?.[id]);if(id==='trait-tooltip'){r.width=Math.min(r.width,parseFloat(this.style.maxWidth)||Infinity);r.height=Math.min(r.height,parseFloat(this.style.maxHeight)||Infinity);r.left=parseFloat(this.style.left)||0;r.top=parseFloat(this.style.top)||0;r.right=r.left+r.width;r.bottom=r.top+r.height;}return r;},classList:{toggle(){}},scrollTo(){},focus(){},addEventListener(name,cb,opts={}){const list=listeners.get(name)||[];list.push({cb,once:opts.once});listeners.set(name,list);},fire(name,event){const list=listeners.get(name)||[];listeners.set(name,list.filter(x=>!x.once));return Promise.all(list.map(x=>x.cb(event)));},showModal(){this.open=true;},close(value){this.returnValue=value;this.open=false;return this.fire('close',{target:this});},click(){},remove(){}};
   elements.set(id,e);
  }return elements.get(id);
 }
 const url={createObjectURL(blob){const id='test-blob-'+blobs.size;blobs.set(id,blob);return id;},revokeObjectURL(){}};
 const document={getElementById:element,querySelector(selector){return selector==='.counter-actions'&&options.counterRect&&element(options.lab?'lab-app':'app').innerHTML.includes('class="counter-actions"')?{getBoundingClientRect:()=>bounds(options.counterRect)}:null;},addEventListener(name,cb){documentListeners.set(name,cb);},body:{appendChild(){}},createElement(tag){assert.equal(tag,'a');return {href:'',download:'',click(){downloads.push({name:this.download,blob:blobs.get(this.href)});},remove(){}};}};
 const localStorage={getItem(k){if(options.failGet)throw new Error('storage denied');return storage.get(k)||null;},setItem(k,v){if(options.failSet)throw new Error('storage full');storage.set(k,v);}};
 const window={Workshop:W,location:{href:'index.html'},innerWidth:options.width||1180,innerHeight:options.height||760,...(options.viewport?{visualViewport:{...options.viewport,addEventListener(name,cb){viewportListeners.set(name,cb);}}}:{}),addEventListener(name,cb){windowListeners.set(name,cb);}};
 const context=vm.createContext({window,document,localStorage,Blob,URL:url,performance:{now:options.now||(()=>Date.now())},setTimeout:fn=>{fn();return 0;}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../trait-tips.js'),'utf8'),context);
 if(options.lab){
  window.WorkshopLabScenarios=require('../lab-scenarios.js');
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../lab-core.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../lab-trial.js'),'utf8'),context);
  const trialCreate=window.WorkshopTrial.create;window.WorkshopTrial.create=(opts={})=>{window.testTrialRuntime=trialCreate({...opts,...(options.trialRandom?{random:options.trialRandom}:{})});return window.testTrialRuntime;};
  const original=window.WorkshopLab.create;window.WorkshopLab.create=(...args)=>{window.testRuntime=original(...args);return window.testRuntime;};
 }
 vm.runInContext(fs.readFileSync(path.join(__dirname,options.lab?'../lab.js':'../app.js'),'utf8'),context);
 const html=()=>options.lab?element('lab-controls').innerHTML+element('lab-app').innerHTML:element('app').innerHTML;
 const buttons=()=>[...html().matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const attr=m[1],data={};for(const a of attr.matchAll(/data-([a-z]+)="([^"]*)"/g))data[a[1]]=decode(a[2]);return {dataset:data,disabled:/\bdisabled\b/.test(attr),label:decode(m[2]),action:data.action?JSON.parse(data.action):null,attributes:{},setAttribute(k,v){this.attributes[k]=v;},closest(selector){return selector==='button'||selector==='[data-trait]'&&data.trait?this:null;},getBoundingClientRect(){return bounds(this.rect||options.anchorRect||{left:70,top:210,width:60,height:24});}};});
 // Legacy feature checks read the new receipt cards as setup; monthly tests set
 // autoReview:false and exercise the exact sequence without this convenience.
 const reviewAll=async()=>{let n=0,b;while((b=buttons().find(b=>b.action?.type==='review-next'))){assert(n++<20002,'receipt loop');await documentListeners.get('click')({target:{closest:()=>b}});}};
 const click=async b=>{assert(b,'missing button');await documentListeners.get('click')({target:{closest:()=>b}});if(options.autoReview!==false&&JSON.parse(b.dataset.action||'{}').type==='open')await reviewAll();};
 return {element,storage,downloads,options,html,buttons,window,lab:window.testRuntime,trial:window.testTrialRuntime,raw:()=>storage.get(KEY),state:()=>options.lab?window.testRuntime.state:W.importSave(storage.get(KEY)),notice:()=>element('notice').textContent,
  emit(name,target,props={}){let prevented=false;documentListeners.get(name)?.({target,preventDefault(){prevented=true;},stopPropagation(){},...props});return prevented;},windowEvent(name){windowListeners.get(name)?.();},viewportEvent(name){viewportListeners.get(name)?.();},trait(key){const b=buttons().find(b=>b.dataset.trait===key);assert(b,'missing trait '+key);return b;},
  reviewAll,button(type,props={}){const b=buttons().find(b=>b.action?.type===type&&Object.entries(props).every(([k,v])=>b.action[k]===v));assert(b,'missing '+type);return b;},
  click,async clickEvent(b,props={}){assert(b,'missing button');let prevented=false;await documentListeners.get('click')({target:{closest:()=>b},preventDefault(){prevented=true;},stopPropagation(){},...props});return prevented;},clickAction(type,props={}){return click(this.button(type,props));},clickTab(tab){return click(buttons().find(b=>b.dataset.tab===tab));},clickTool(tool){return click(buttons().find(b=>b.dataset.tool===tool));},
  async idle(){for(let n=0;n<8;n++)await Promise.resolve();},answer(yes){const d=element('confirm-dialog');assert(d.open,'confirmation not open');return d.close(yes?'yes':'cancel');},
  importFile(file){return element('import-file').fire('change',{target:{files:[file],value:'file.json'}});},
  importRaw(raw){return this.importFile({size:Buffer.byteLength(raw,'utf8'),async text(){return raw;}});},
  input(id,value){element(id).value=value;return documentListeners.get('input')({target:{id}});},change(id,value,dataset={}){element(id).value=value;return documentListeners.get('change')({target:{id,value,dataset}});},
  storageEvent(raw){if(raw!==null)storage.set(KEY,raw);else storage.delete(KEY);return windowListeners.get('storage')({key:KEY,newValue:raw});}
 };
}
module.exports={view,KEY,decode};
