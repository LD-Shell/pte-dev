/* DOM helpers, formatting and modals. */
const $ = (s,r=document)=>r.querySelector(s);
const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const el = (tag, attrs={}, ...kids)=>{
  const n = document.createElement(tag);
  for(const k in attrs){
    if(k==='class') n.className=attrs[k];
    else if(k==='html') n.innerHTML=attrs[k];
    else if(k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else if(attrs[k]!=null && attrs[k]!==false) n.setAttribute(k, attrs[k]);
  }
  kids.flat().forEach(c=> n.append(c && c.nodeType ? c : document.createTextNode(c==null?'':c)));
  return n;
};
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const mmss = s => { s=Math.max(0,Math.round(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
const words = t => (String(t||'').trim().match(/[A-Za-z0-9'’\-]+/g)||[]);
const norm = t => String(t||'').toLowerCase().replace(/[^a-z0-9\s']/g,' ').replace(/\s+/g,' ').trim();
const uid = ()=> Math.random().toString(36).slice(2,10);
const sum = a => a.reduce((x,y)=>x+y,0);
const avg = a => a.length ? sum(a)/a.length : 0;

let toastTimer;
function toast(msg, ms=3200){
  const t = document.getElementById('toast');
  t.innerHTML=''; t.append(el('div',{class:'toast'}, msg));
  clearTimeout(toastTimer); toastTimer = setTimeout(()=> t.innerHTML='', ms);
}
function modal(build){
  return new Promise(res=>{
    const close = v => { overlay.innerHTML=''; document.removeEventListener('keydown', onKey); res(v); };
    const onKey = e => { if(e.key==='Escape') close(null); };
    const sheet = el('div',{class:'sheet'});
    const wrap = el('div',{class:'modal', onclick:e=>{ if(e.target===wrap) close(null); }}, sheet);
    build(sheet, close);
    overlay.innerHTML=''; overlay.append(wrap);
    document.addEventListener('keydown', onKey);
    const f = sheet.querySelector('input,textarea,button'); if(f) f.focus();
  });
}
function confirmDialog(title, body, okLabel='Continue'){
  return modal((s,close)=>{
    s.append(el('h3',{},title), el('p',{class:'muted'},body),
      el('div',{class:'row', style:'justify-content:flex-end;margin-top:20px'},
        el('button',{class:'btn', onclick:()=>close(false)},'Cancel'),
        el('button',{class:'btn btn-primary', onclick:()=>close(true)},okLabel)));
  });
}

