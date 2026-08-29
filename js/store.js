/* Persistence. IndexedDB where available, in-memory otherwise. */
const Store = (()=>{
  const mem = new Map();
  let db = null, persistent = false;
  const open = ()=> new Promise(res=>{
    let req;
    try { req = indexedDB.open('pte-trainer', 1); }
    catch(e){ return res(null); }
    req.onupgradeneeded = e => { const d=e.target.result; if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); };
    req.onsuccess = e => res(e.target.result);
    req.onerror = ()=> res(null);
    setTimeout(()=>res(null), 2500);
  });
  async function init(){ db = await open(); persistent = !!db; return persistent; }
  function tx(mode){ return db.transaction('kv', mode).objectStore('kv'); }
  async function get(key){
    if(!db) return mem.has(key) ? mem.get(key) : null;
    return new Promise(res=>{ const r = tx('readonly').get(key); r.onsuccess=()=>res(r.result??null); r.onerror=()=>res(null); });
  }
  async function set(key, val){
    mem.set(key,val);
    if(!db) return;
    return new Promise(res=>{ const r = tx('readwrite').put(val,key); r.onsuccess=()=>res(); r.onerror=()=>res(); });
  }
  async function del(key){ mem.delete(key); if(db) tx('readwrite').delete(key); }
  async function keys(){
    if(!db) return [...mem.keys()];
    return new Promise(res=>{ const r = tx('readonly').getAllKeys(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>res([]); });
  }
  async function clearAll(){ mem.clear(); if(db) return new Promise(res=>{ const r=tx('readwrite').clear(); r.onsuccess=()=>res(); r.onerror=()=>res(); }); }
  return { init, get, set, del, keys, clearAll, get persistent(){ return persistent; } };
})();

