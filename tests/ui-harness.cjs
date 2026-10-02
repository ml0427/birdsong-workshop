'use strict';
// Runs the unmodified app.js with in-memory DOM, file and storage doubles.
// It exercises browser event code, but cannot validate layout or OS downloads.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),W=require('../engine.js');
const KEY='birdsong-workshop-save-v1';
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function view(options={}){
 const elements=new Map(),documentListeners=new Map(),windowListeners=new Map(),downloads=[],blobs=new Map();
 const storage=options.storage||new Map();
 if(!options.storage){const raw=Object.hasOwn(options,'raw')?options.raw:W.exportSave(options.state||W.initialState());if(raw!==null)storage.set(KEY,raw);if(options.previous)storage.set(KEY+'-previous',options.previous);}
 function element(id){
  if(!elements.has(id)){
   const listeners=new Map();const e={innerHTML:'',textContent:'',value:'',open:false,returnValue:'',classList:{toggle(){}},scrollTo(){},focus(){},addEventListener(name,cb,opts={}){const list=listeners.get(name)||[];list.push({cb,once:opts.once});listeners.set(name,list);},fire(name,event){const list=listeners.get(name)||[];listeners.set(name,list.filter(x=>!x.once));return Promise.all(list.map(x=>x.cb(event)));},showModal(){this.open=true;},close(value){this.returnValue=value;this.open=false;return this.fire('close',{target:this});},click(){},remove(){}};
   elements.set(id,e);
  }return elements.get(id);
 }
 const url={createObjectURL(blob){const id='test-blob-'+blobs.size;blobs.set(id,blob);return id;},revokeObjectURL(){}};
 const document={getElementById:element,querySelector(){return null;},addEventListener(name,cb){documentListeners.set(name,cb);},body:{appendChild(){}},createElement(tag){assert.equal(tag,'a');return {href:'',download:'',click(){downloads.push({name:this.download,blob:blobs.get(this.href)});},remove(){}};}};
 const localStorage={getItem(k){if(options.failGet)throw new Error('storage denied');return storage.get(k)||null;},setItem(k,v){if(options.failSet)throw new Error('storage full');storage.set(k,v);}};
 const window={Workshop:W,addEventListener(name,cb){windowListeners.set(name,cb);}};
 const context=vm.createContext({window,document,localStorage,Blob,URL:url,setTimeout:fn=>{fn();return 0;}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),context);
 const html=()=>element('app').innerHTML;
 const buttons=()=>[...html().matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const attr=m[1],data={};for(const a of attr.matchAll(/data-([a-z]+)="([^"]*)"/g))data[a[1]]=decode(a[2]);return {dataset:data,disabled:/\bdisabled\b/.test(attr),label:decode(m[2]),action:data.action?JSON.parse(data.action):null};});
 // Legacy feature checks read the new receipt cards as setup; monthly tests set
 // autoReview:false and exercise the exact sequence without this convenience.
 const reviewAll=async()=>{let n=0,b;while((b=buttons().find(b=>b.action?.type==='review-next'))){assert(n++<20002,'receipt loop');await documentListeners.get('click')({target:{closest:()=>b}});}};
 const click=async b=>{assert(b,'missing button');await documentListeners.get('click')({target:{closest:()=>b}});if(options.autoReview!==false&&JSON.parse(b.dataset.action||'{}').type==='open')await reviewAll();};
 return {element,storage,downloads,options,html,buttons,raw:()=>storage.get(KEY),state:()=>W.importSave(storage.get(KEY)),notice:()=>element('notice').textContent,
  reviewAll,button(type,props={}){const b=buttons().find(b=>b.action?.type===type&&Object.entries(props).every(([k,v])=>b.action[k]===v));assert(b,'missing '+type);return b;},
  click,clickAction(type,props={}){return click(this.button(type,props));},clickTab(tab){return click(buttons().find(b=>b.dataset.tab===tab));},clickTool(tool){return click(buttons().find(b=>b.dataset.tool===tool));},
  async idle(){for(let n=0;n<8;n++)await Promise.resolve();},answer(yes){const d=element('confirm-dialog');assert(d.open,'confirmation not open');return d.close(yes?'yes':'cancel');},
  importFile(file){return element('import-file').fire('change',{target:{files:[file],value:'file.json'}});},
  importRaw(raw){return this.importFile({size:Buffer.byteLength(raw,'utf8'),async text(){return raw;}});},
  input(id,value){element(id).value=value;return documentListeners.get('input')({target:{id}});},change(id,value,dataset={}){element(id).value=value;return documentListeners.get('change')({target:{id,value,dataset}});},
  storageEvent(raw){if(raw!==null)storage.set(KEY,raw);else storage.delete(KEY);return windowListeners.get('storage')({key:KEY,newValue:raw});}
 };
}
module.exports={view,KEY,decode};
