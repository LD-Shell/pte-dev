/* Home screen, mode pickers, settings and progress. */
function nav(){
  const bar = el('div',{class:'shell'});
  const spend = el('div',{class:'meta mono'},'');
  const upd = ()=> spend.textContent = `Session $${S.spend.session.toFixed(3)} · total $${S.spend.lifetime.toFixed(2)}`;
  upd(); document.addEventListener('spend', upd);
  bar.append(el('div',{class:'brand'},'PTE Academic Practice'), el('div',{class:'spacer'}), spend,
    el('button',{class:'btn btn-sm', onclick:dashboard},'Progress'),
    el('button',{class:'btn btn-sm', onclick:settings},'Settings'));
  return bar;
}
function home(){
  const pad = el('div',{class:'pad pad-wide'});
  const hero = el('div',{},
    el('h1',{},'Choose how you want to practise'),
    el('p',{class:'muted'},'Twenty full tests, each 52-64 items to the 2025 PTE format. Test 1 ships with the app; the rest are generated once and kept.'));
  pad.append(hero);
  const modes = el('div',{class:'modes'});
  modes.append(
    el('button',{class:'mode', onclick:pickTest}, el('b',{},'Full mock test'), el('span',{},'All three parts, about two hours, no going back. The closest thing to the real sitting.')),
    el('button',{class:'mode', onclick:pickFocus}, el('b',{},'Focus on one skill'), el('span',{},'Speaking, Writing, Reading or Listening on its own, with authentic section timing.')),
    el('button',{class:'mode', onclick:pickDrill}, el('b',{},'Drill one task type'), el('span',{},'A single item type at your chosen difficulty, with feedback after every attempt.')));
  pad.append(modes);

  if(!S.apiKey) pad.append(el('div',{class:'card'},
    el('div',{class:'row'}, el('span',{class:'badge warn'},'No Anthropic key'),
      el('span',{class:'small muted'},'You can sit any test you have on disk, but nothing will be graded and no new tests can be generated.')),
    el('div',{style:'margin-top:12px'}, el('button',{class:'btn btn-primary btn-sm', onclick:settings},'Add a key'))));
  if(!Mic.granted) pad.append(el('div',{class:'card'},
    el('div',{class:'row'}, el('span',{class:'badge'},'Microphone'),
      el('span',{class:'small muted'},'Grant access once here and every speaking item in this session reuses the same stream, so Chrome will not ask again.')),
    el('div',{style:'margin-top:12px'}, el('button',{class:'btn btn-sm', onclick:async e=>{
      const ok = await Mic.test();
      toast(ok ? 'Microphone ready. Chrome will remember this for localhost.' : 'Chrome refused access. Check the padlock icon in the address bar.', 5000);
      if(ok) home();
    }},'Test the microphone'))));

  if(S.history.length){
    const last = S.history[S.history.length-1];
    pad.append(el('div',{class:'card'},
      el('div',{class:'eyebrow'},'Most recent attempt'),
      el('div',{class:'row', style:'margin-top:6px'},
        el('div',{style:'font:600 30px/1 var(--sans)'}, last.overall),
        el('div',{class:'small muted'}, `${last.mode}${last.testNo?' · Test '+last.testNo:''} · ${new Date(last.when).toLocaleDateString()}`),
        el('div',{class:'spacer'}),
        el('button',{class:'btn btn-sm', onclick:dashboard},'See progress'))));
  }
  paint(el('div',{class:'screen'}, nav(), pad));
}
function paint(node){ app.innerHTML=''; app.append(node); window.scrollTo(0,0); }

function pickTest(){
  const pad = el('div',{class:'pad pad-wide'});
  pad.append(el('button',{class:'btn-quiet btn', onclick:home},'← Back'),
    el('h1',{style:'margin:18px 0 4px;font-size:22px'},'Full mock test'),
    el('p',{class:'muted'},'Roughly two hours. Once you start an item you cannot return to it.'));
  const g = el('div',{class:'grid g5', style:'margin-top:20px'});
  for(let n=1;n<=20;n++){
    const ready = !!S.cache[n];
    g.append(el('button',{class:'tile'+(ready?' ready':''), onclick:async ()=>{
      const t = await ensureTest(n); if(!t) return home();
      startRun({items:flatten(t), modeName:'Full mock test', testNo:n});
    }}, el('b',{},'Test '+n), el('em',{}, ready ? `${countItems(S.cache[n])} items` : 'Generates on start')));
  }
  pad.append(g);
  paint(el('div',{class:'screen'}, nav(), pad));
}
function pickFocus(){
  const pad = el('div',{class:'pad pad-wide'});
  pad.append(el('button',{class:'btn-quiet btn', onclick:home},'← Back'),
    el('h1',{style:'margin:18px 0 4px;font-size:22px'},'Focus on one skill'),
    el('p',{class:'muted'},'Only the item types that feed the skill you choose, timed as they are in the real section.'));
  const g = el('div',{class:'grid g4', style:'margin-top:20px'});
  Object.entries(FOCUS).forEach(([k,f])=>{
    const t1 = S.cache[1] || {};
    const types = [...new Set(f.groups.flatMap(gr=> (t1[gr]||[]).map(i=>i.type)))]
      .filter(ty=> !f.skill || META[ty].skills.includes(f.skill));
    g.append(el('button',{class:'tile', onclick:()=>focusPick(k)},
      el('b',{}, f.name),
      el('em',{}, types.map(t=>META[t].label).join(' · '))));
  });
  pad.append(g);
  paint(el('div',{class:'screen'}, nav(), pad));
}
function focusPick(key){
  const f = FOCUS[key];
  const pad = el('div',{class:'pad pad-wide'});
  pad.append(el('button',{class:'btn-quiet btn', onclick:pickFocus},'← Back'),
    el('h1',{style:'margin:18px 0 4px;font-size:22px'}, f.name+' — choose a test to draw from'));
  const g = el('div',{class:'grid g5', style:'margin-top:20px'});
  for(let n=1;n<=20;n++){
    const ready = !!S.cache[n];
    g.append(el('button',{class:'tile'+(ready?' ready':''), onclick:async ()=>{
      const t = await ensureTest(n); if(!t) return home();
      const items = f.groups.flatMap(gr => (t[gr]||[])).filter(i=> !f.skill || META[i.type].skills.includes(f.skill));
      if(!items.length) return toast('That test has no items for this skill.');
      startRun({items, modeName:f.name+' focus', testNo:n, budget:f.budget||null});
    }}, el('b',{},'Test '+n), el('em',{}, ready?'Ready':'Generates on start')));
  }
  pad.append(g);
  paint(el('div',{class:'screen'}, nav(), pad));
}
function pickDrill(){
  const pad = el('div',{class:'pad pad-wide'});
  pad.append(el('button',{class:'btn-quiet btn', onclick:home},'← Back'),
    el('h1',{style:'margin:18px 0 4px;font-size:22px'},'Drill one task type'),
    el('p',{class:'muted'},'Pulls every example of that task from the tests you already have, then generates more if you run out.'));
  let diff='Standard';
  const dsel = el('select',{class:'field', style:'max-width:200px'});
  ['Easy','Standard','Hard'].forEach(d=> dsel.append(el('option',{selected:d===diff?'':false}, d)));
  dsel.addEventListener('change',()=> diff=dsel.value);
  pad.append(el('div',{class:'row', style:'margin:18px 0'}, el('span',{class:'small muted'},'Difficulty'), dsel));
  const g = el('div',{class:'grid g4'});
  Object.entries(META).forEach(([t,m])=>{
    g.append(el('button',{class:'tile', onclick:()=>runDrill(t, diff)},
      el('b',{}, m.label), el('em',{}, 'Part '+m.part)));
  });
  pad.append(g);
  paint(el('div',{class:'screen'}, nav(), pad));
}
function runDrill(type, diff){
  const pool = [];
  Object.values(S.cache).forEach(t=> flatten(t).filter(i=>i.type===type).forEach(i=>pool.push(i)));
  if(!pool.length) return toast('No items of that type on disk yet. Generate a test first.');
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  startRun({items:pool.slice(0,6), modeName:`${META[type].label} drill (${diff})`});
}

function dashboard(){
  const pad = el('div',{class:'pad pad-wide'});
  pad.append(el('button',{class:'btn-quiet btn', onclick:home},'← Back'), el('h1',{style:'margin:18px 0 14px;font-size:22px'},'Progress'));
  if(!S.history.length){ pad.append(el('p',{class:'muted'},'Nothing recorded yet. Finish a test and your scores will appear here.')); }
  else {
    const h = S.history;
    // trend
    const W=760,H=200, max=90, min=10;
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`); svg.setAttribute('width','100%');
    const ns='http://www.w3.org/2000/svg';
    const mk=(t,a,txt)=>{const n=document.createElementNS(ns,t);for(const k in a)n.setAttribute(k,a[k]);if(txt!=null)n.textContent=txt;svg.append(n);return n;};
    [10,30,50,70,90].forEach(v=>{ const y=H-20-(H-40)*(v-min)/(max-min);
      mk('line',{x1:40,y1:y,x2:W-10,y2:y,stroke:'#e6e9ed'}); mk('text',{x:32,y:y+4,'text-anchor':'end','font-size':11,fill:'#767d86'},v); });
    const step = h.length>1 ? (W-60)/(h.length-1) : 0;
    const pts = h.map((r,i)=>`${45+step*i},${H-20-(H-40)*(r.overall-min)/(max-min)}`).join(' ');
    if(h.length>1) mk('polyline',{points:pts,fill:'none',stroke:'#1f4e79','stroke-width':2.4});
    h.forEach((r,i)=> mk('circle',{cx:45+step*i, cy:H-20-(H-40)*(r.overall-min)/(max-min), r:4, fill:'#1f4e79'}));
    const card = el('div',{class:'card'}); card.append(el('div',{class:'eyebrow',style:'margin-bottom:8px'},'Overall score by attempt'), svg);
    pad.append(card);
    const tb = el('table',{class:'data'});
    tb.append(el('tr',{}, el('th',{},'Date'), el('th',{},'Mode'), el('th',{},'Overall'),
      el('th',{},'L'), el('th',{},'R'), el('th',{},'S'), el('th',{},'W')));
    [...h].reverse().forEach(r=> tb.append(el('tr',{},
      el('td',{}, new Date(r.when).toLocaleDateString()),
      el('td',{}, r.mode + (r.testNo?' · '+r.testNo:'')),
      el('td',{class:'n'}, r.overall),
      ...['listening','reading','speaking','writing'].map(k=> el('td',{class:'n'}, r.communicative[k]??'—')))));
    pad.append(el('div',{class:'card'}, el('div',{class:'eyebrow',style:'margin-bottom:8px'},'All attempts'), tb));
  }
  pad.append(el('div',{class:'card'},
    el('div',{class:'eyebrow',style:'margin-bottom:8px'},'Spend'),
    el('p',{class:'muted small'},`This session $${S.spend.session.toFixed(3)}. Lifetime $${S.spend.lifetime.toFixed(2)} against a cap of $${S.spend.cap.toFixed(2)}. Tests stored on this device: ${Object.keys(S.cache).length}.`)));
  paint(el('div',{class:'screen'}, nav(), pad));
}

function settings(){
  const pad = el('div',{class:'pad'});
  pad.append(el('button',{class:'btn-quiet btn', onclick:home},'← Back'), el('h1',{style:'margin:18px 0 14px;font-size:22px'},'Settings'));
  // ---- provider + key ----
  const c1 = el('div',{class:'card'});
  const buildProviderCard = ()=>{
    const pr = PROVIDERS[S.provider];
    c1.innerHTML='';
    const psel = el('select',{class:'field', style:'margin-bottom:4px'});
    Object.entries(PROVIDERS).forEach(([id,info])=>
      psel.append(el('option',{value:id, selected:S.provider===id?'':false}, info.label)));
    psel.addEventListener('change', ()=>{
      S.provider = psel.value; saveSettings();
      buildProviderCard(); buildModelCard();
      toast('Switched to '+PROVIDERS[S.provider].label+'.');
    });
    const key = el('input',{class:'field', type:'password', value:S.apiKey, placeholder:pr.keyHint});
    c1.append(
      el('h3',{},'Model provider'),
      el('p',{class:'muted small'},'Keys and model choices are kept separately for each provider, so switching back and forth does not lose anything.'),
      psel,
      el('p',{class:'muted small', style:'margin:6px 0 10px'}, pr.note),
      pr.browserSafe ? el('span',{class:'badge ok'},'Documented to work from a browser')
                     : el('div',{class:'row', style:'margin-bottom:12px'},
                         el('span',{class:'badge warn'},'May be blocked here'),
                         el('span',{class:'small muted'},'Press Test connection to find out in a second.')),
      el('div',{class:'small muted', style:'margin-bottom:3px'}, pr.label+' API key \u2014 from '+pr.console),
      key,
      el('p',{class:'muted small', style:'margin-top:8px'},'Your key is stored only in this browser, on this device, and is sent only to '+pr.console.replace('console.','api.').replace('platform.','api.')+' when you are being graded. It is never uploaded to the site hosting this page and nobody else who opens this link can see it.'),
      el('div',{class:'row', style:'margin-top:12px'},
        el('button',{class:'btn btn-primary btn-sm', onclick:()=>{ S.apiKey=key.value.trim(); saveSettings(); toast('Key saved for '+PROVIDERS[S.provider].label+'.'); }},'Save key'),
        el('button',{class:'btn btn-sm', onclick:()=>{ S.apiKey=''; key.value=''; saveSettings(); toast('Key removed.'); }},'Forget key'),
        el('button',{class:'btn btn-sm', onclick:async e=>{
          const b=e.target, was=b.textContent; b.disabled=true; b.textContent='Testing\u2026';
          try{
            const r = await API.selfTest();
            const how = API.lastVariant ? ' Using: '+API.lastVariant.label+'.' : '';
            toast(r && r.status
              ? PROVIDERS[S.provider].label+' works. Key and structured output both round-tripped.'+how
              : 'Reached the API but the reply was unexpected. Check Settings.', 8000);
          }catch(err){ toast('Test failed: '+err.message, 9000); }
          b.disabled=false; b.textContent=was;
        }},'Test connection')));
  };
  buildProviderCard();

  const voices = el('select',{class:'field'});
  const fill = ()=>{ voices.innerHTML=''; voices.append(el('option',{value:''},'Best available (recommended)'));
    Speech.voices.forEach(v=>{
      const q = Speech.quality(v);
      const mark = q>=100 ? ' — neural, best' : q>=60 ? ' — good' : q<0 ? ' — robotic, avoid' : '';
      voices.append(el('option',{value:v.name, selected:v.name===S.voice?'':false}, `${v.name} (${v.lang})${mark}`));
    }); };
  fill(); setTimeout(fill,600);
  voices.addEventListener('change',()=>{ S.voice=voices.value; saveSettings(); });
  const rate = el('input',{class:'field', type:'range', min:'0.7', max:'1.3', step:'0.05', value:S.rate});
  const rateL = el('span',{class:'small muted mono'}, S.rate.toFixed(2)+'×');
  rate.addEventListener('input',()=>{ S.rate=+rate.value; rateL.textContent=S.rate.toFixed(2)+'×'; saveSettings(); });
  const c2 = el('div',{class:'card'}, el('h3',{},'Listening audio'),
    el('p',{class:'muted small'},'Chrome can only use voices your operating system has installed, and it defaults to the oldest one, which is why it sounds robotic. The list below is sorted best first. If nothing is marked neural, install better voices: on Windows, Settings \u2192 Time & language \u2192 Speech \u2192 Manage voices and add a Natural voice; on macOS, System Settings \u2192 Accessibility \u2192 Spoken Content \u2192 System Voice \u2192 Manage Voices and download an English (Enhanced or Premium) voice. Then reload this page.'),
    voices, el('div',{class:'row',style:'margin-top:12px'}, el('span',{class:'small muted'},'Speed'), rate, rateL),
    el('div',{style:'margin-top:12px'}, el('button',{class:'btn btn-sm', onclick:()=>Speech.speak('This is how the listening recordings will sound during your test.')},'Play a sample')));
  const sttOn = el('input',{type:'checkbox'});
  sttOn.checked = !!S.stt.enabled;
  const sttKey = el('input',{class:'field', type:'password', value:S.stt.key, placeholder:'sk-...'});
  const sttUrl = el('input',{class:'field', value:S.stt.url, placeholder:'https://.../v1/audio/transcriptions'});
  const sttMod = el('input',{class:'field', value:S.stt.model, placeholder:'whisper-1'});
  const saveStt = ()=>{ S.stt = {enabled:sttOn.checked, key:sttKey.value.trim(),
                                 url:sttUrl.value.trim(), model:sttMod.value.trim()||'whisper-1'};
                        saveSettings(); };
  [sttOn,sttKey,sttUrl,sttMod].forEach(n=> n.addEventListener('change', saveStt));
  const cS = el('div',{class:'card'}, el('h3',{},'Speech-to-text for spoken answers'),
    el('p',{class:'muted small'},'Chrome\u2019s built-in recogniser is built for short voice commands and mishears connected speech constantly, which drags your spoken scores down for reasons that are not your fault. Turning this on sends the recording itself to a transcription model instead. Note that many transcription services refuse requests made directly from a web page; if it fails here, the downloadable version relays through a small local server and will work.'),
    el('label',{class:'row', style:'margin:10px 0'}, sttOn,
      el('span',{class:'small'},'Transcribe recordings with a speech-to-text model')),
    el('div',{class:'small muted', style:'margin:8px 0 3px'},'API key'), sttKey,
    el('div',{class:'small muted', style:'margin:10px 0 3px'},'Endpoint \u2014 any OpenAI-compatible /audio/transcriptions URL'), sttUrl,
    el('div',{class:'small muted', style:'margin:10px 0 3px'},'Model'), sttMod,
    el('p',{class:'muted small', style:'margin-top:12px'},'Neither model provider accepts audio, so this is necessarily a separate service with its own key. A full mock test is roughly twenty short recordings, so the cost per test is small, but it is billed by whoever provides the endpoint.'));

  const c3 = el('div',{class:'card'}, el('h3',{},'Grading'));
  const gm = el('select',{class:'field', style:'margin-bottom:6px'});
  [['assisted','Assisted — model grades everything it can judge'],['full','Full — model grades every item, including multiple choice']]
    .forEach(([v,l])=> gm.append(el('option',{value:v, selected:S.gradeMode===v?'':false}, l)));
  gm.addEventListener('change',()=>{ S.gradeMode=gm.value; saveSettings(); });
  c3.append(gm, el('p',{class:'muted small', style:'margin:8px 0 18px'},
    'In assisted mode multiple choice, re-order and both blank-filling tasks are decided by exact comparison and the model only writes the feedback, because a language model cannot improve on an index match but can get it wrong. Everything spoken or typed is decided by the model, which sees the target text, your transcript and the acoustic measurements so it can tell a misheard word from a real mistake.'));
  const modelWrap = el('div');
  const buildModelCard = ()=>{
    modelWrap.innerHTML='';
    modelWrap.append(el('h3',{style:'margin-top:6px'}, 'Models \u2014 '+PROVIDERS[S.provider].label));
    [['gen','Generating tests'],['grade','Grading responses'],['coach','Coaching report']].forEach(([k,lbl])=>{
      const sel = el('select',{class:'field', style:'margin-bottom:10px'});
      PROVIDERS[S.provider].models.forEach(m=>{
        const p = PROVIDERS[S.provider].price[m];
        sel.append(el('option',{value:m, selected:S.models[k]===m?'':false},
          `${m}  \u2014  $${p[0]} in / $${p[1]} out per 1M`));
      });
      sel.addEventListener('change',()=>{ S.models[k]=sel.value; saveSettings(); });
      modelWrap.append(el('div',{class:'small muted', style:'margin-bottom:3px'}, lbl), sel);
    });
  };
  buildModelCard();
  c3.append(modelWrap);
  const cap = el('input',{class:'field', type:'number', min:'1', step:'1', value:S.spend.cap});
  cap.addEventListener('change',()=>{ S.spend.cap=+cap.value||15; saveSettings(); });
  c3.append(el('div',{class:'small muted', style:'margin:10px 0 3px'},'Spend ceiling in US dollars — API calls stop when lifetime spend reaches this'), cap);
  const c4 = el('div',{class:'card'}, el('h3',{},'Stored data'),
    el('p',{class:'muted small'}, Store.persistent
      ? `${Object.keys(S.cache).length} test(s) loaded, ${S.history.length} attempt(s) recorded.`
      : 'This browser is blocking persistent storage, so attempts will be lost when the tab closes.'),
    el('p',{class:'muted small'},'The ten built-in tests come from the site itself. Anything you generate lives only in this browser \u2014 export it and commit the file into the tests folder if you want it to stay.'),
    el('div',{class:'row', style:'margin-top:10px'},
      el('button',{class:'btn btn-sm', onclick:()=>{
        const gen = Object.values(S.cache).filter(t=>t.source==='generated');
        if(!gen.length) return toast('Nothing generated in this browser yet.');
        gen.forEach(t=>{
          const a = el('a',{href:URL.createObjectURL(new Blob([JSON.stringify(t,null,1)],{type:'application/json'})),
            download:`test-${String(t.no).padStart(2,'0')}.json`});
          a.click();
        });
        toast(`Exported ${gen.length} test file(s). Move them into the tests folder and list them in manifest.json.`, 7000);
      }},'Export generated tests')),
    el('div',{class:'row', style:'margin-top:12px'},
      el('button',{class:'btn btn-sm', onclick:()=>{
        const blob = new Blob([JSON.stringify({history:S.history, cache:S.cache},null,2)],{type:'application/json'});
        el('a',{href:URL.createObjectURL(blob), download:'pte-data.json'}).click();
      }},'Export everything'),
      el('button',{class:'btn btn-sm', style:'color:var(--danger)', onclick:async ()=>{
        if(await confirmDialog('Reset all data?','This deletes every generated test, every attempt and your API key from this browser. It cannot be undone.','Delete everything')){
          await Store.clearAll(); location.reload();
        }
      }},'Reset all data')));
  pad.append(c1,c2,cS,c3,c4);
  paint(el('div',{class:'screen'}, nav(), pad));
}

