/* Renderers for each item type. Each returns {node, answer()}; `hold` blocks
   Next until the task sequence completes. */
function beep(ms=350){
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.18, ac.currentTime); o.start();
    o.stop(ac.currentTime + ms/1000);
    setTimeout(()=>ac.close(), ms+200);
  }catch(e){}
}
function audioPanel(text, {lead=7, onDone, beepAfter=false}={}){
  const node = el('div',{class:'player'});
  const st = el('div',{class:'status'});
  const lbl = el('span',{},'Audio begins in'), num = el('span',{class:'mono'}, mmss(lead));
  st.append(lbl, num); node.append(st);
  const bar = el('div',{class:'bar'}), fill = el('i'); bar.append(fill); node.append(bar);
  node.append(el('div',{class:'small muted', style:'margin-top:9px'},'The recording plays once. There is no replay, as in the real test.'));
  let t = lead, dur = 0, started=false, timer;
  const play = ()=>{
    started = true; lbl.textContent='Playing';
    const spoken = text.replace(/\[BEEP\]/g,'').replace(/\[([^\]]+)\]/g,'$1');
    const est = Math.max(4, words(spoken).length/2.6/S.rate);
    let e=0;
    const tick = setInterval(()=>{ e+=0.2; fill.style.width = clamp(100*e/est,0,100)+'%'; num.textContent = mmss(Math.max(0,est-e)); }, 200);
    Speech.speak(spoken, {onEnd:()=>{
      clearInterval(tick); fill.style.width='100%'; lbl.textContent='Completed'; num.textContent='';
      if(beepAfter) beep();
      onDone && onDone();
    }});
  };
  timer = setInterval(()=>{
    if(started) return;
    t--; num.textContent = mmss(t);
    if(t<=0){ clearInterval(timer); play(); }
  }, 1000);
  node._cleanup = ()=>{ clearInterval(timer); Speech.stop(); };
  return node;
}
function recorderPanel({prep, rec, onFinish}){
  const node = el('div',{class:'rec'});
  const head = el('div',{class:'row'}, el('span',{class:'dot idle'}), el('b',{},'Recorded answer'));
  const state = el('div',{class:'small muted', style:'margin-top:6px'},'');
  const meter = el('div',{class:'meter'}), lvl = el('i'); meter.append(lvl);
  const live = el('div',{class:'live'},'');
  node.append(head, state, meter, live);
  const dot = head.querySelector('.dot');
  let r = null, timer, phase='prep', left=prep;
  const finish = async ()=>{
    clearInterval(timer);
    dot.classList.add('idle'); state.textContent='Recording complete.';
    const out = r ? await r.stop() : null;
    node._result = out; onFinish && onFinish(out);
  };
  const startRec = async ()=>{
    phase='rec'; left=rec; dot.classList.remove('idle');
    state.textContent='Recording. Speak now.';
    r = new Recorder();
    try{ await r.start(v=> lvl.style.width = clamp(v*180,0,100)+'%', tx=> live.textContent = tx); }
    catch(e){ state.textContent='Microphone unavailable. Allow microphone access in Chrome and reload.'; return; }
    timer = setInterval(()=>{ left--; state.textContent=`Recording — ${mmss(left)} left`; if(left<=0) finish(); },1000);
  };
  if(prep>0){
    state.textContent=`Recording starts in ${mmss(left)}`;
    timer = setInterval(()=>{ left--; state.textContent=`Recording starts in ${mmss(left)}`;
      if(left<=0){ clearInterval(timer); startRec(); } },1000);
  } else startRec();
  node._cleanup = ()=>{ clearInterval(timer); try{ r && r.stop(); }catch(e){} };
  node._force = finish;
  return node;
}

function renderItem(item, run){
  const t = item.type, m = META[t];
  const wrap = el('div');
  let getAnswer = ()=>null;
  const prompt = txt => wrap.append(el('div',{class:'prompt'}, txt));

  if(t==='ra'){
    prompt('Look at the text below. In 35 seconds you must read this text aloud as naturally and clearly as possible.');
    wrap.append(el('div',{class:'passage'}, el('p',{},item.text)));
    const rp = recorderPanel({prep:m.prep, rec:m.rec, onFinish:()=>run.advanceReady()});
    wrap.append(rp); run.hold = rp; getAnswer = ()=> rp._result;
  }
  else if(t==='rs'){
    prompt('You will hear a sentence. Please repeat the sentence exactly as you hear it. You will hear the sentence only once.');
    let rp;
    const ap = audioPanel(item.text, {lead:3, onDone:()=>{
      rp = recorderPanel({prep:0, rec:m.rec, onFinish:()=>run.advanceReady()});
      wrap.append(rp); run.hold = rp;
    }});
    wrap.append(ap); run.hold = ap; getAnswer = ()=> rp && rp._result;
  }
  else if(t==='di'){
    prompt('Look at the image below. In 25 seconds, please speak into the microphone and describe in detail what the image is showing. You will have 40 seconds to give your response.');
    const chartBox = renderChart(item.chart);
    wrap.append(chartBox);
    // keep a raster of the chart for grading
    const svgEl = chartBox.querySelector('svg');
    if(svgEl){ run.charts = run.charts || {};
      const at = run.idx;
      svgToPng(svgEl).then(png=>{ if(png) run.charts[at] = png; }); }
    const rp = recorderPanel({prep:m.prep, rec:m.rec, onFinish:()=>run.advanceReady()});
    wrap.append(el('div',{style:'height:18px'}), rp); run.hold = rp; getAnswer = ()=> rp._result;
  }
  else if(t==='rl'){
    prompt('You will hear a lecture. After listening, you will have 10 seconds to prepare, then 40 seconds to re-tell the lecture in your own words.');
    let rp;
    const ap = audioPanel(item.transcript, {lead:5, onDone:()=>{
      rp = recorderPanel({prep:m.prep, rec:m.rec, onFinish:()=>run.advanceReady()});
      wrap.append(rp); run.hold = rp;
    }});
    wrap.append(ap, el('div',{class:'small muted'},'Take notes while you listen. Nothing you write here is scored.'),
      el('textarea',{class:'field', rows:4, placeholder:'Notes', style:'margin-top:8px'}));
    run.hold = ap; getAnswer = ()=> rp && rp._result;
  }
  else if(t==='asq'){
    prompt('You will hear a question. Please give a simple and short answer. Often just one or a few words is enough.');
    let rp;
    const ap = audioPanel(item.q, {lead:3, onDone:()=>{
      rp = recorderPanel({prep:0, rec:m.rec, onFinish:()=>run.advanceReady()});
      wrap.append(rp); run.hold = rp;
    }});
    wrap.append(ap); run.hold = ap; getAnswer = ()=> rp && rp._result;
  }
  else if(t==='swt' || t==='sst'){
    const isS = t==='sst';
    prompt(isS
      ? 'You will hear a short lecture. Write a summary for a fellow student who was not present. Write 50-70 words. You have 10 minutes.'
      : 'Read the passage below and summarise it using one sentence. Type your response in the box. You have 10 minutes. Your response will be judged on the quality of your writing and on how well it presents the key points.');
    if(isS){ wrap.append(audioPanel(item.transcript,{lead:6})); }
    else { const p = el('div',{class:'passage'}); item.passage.split(/\n\n/).forEach(x=>p.append(el('p',{},x))); wrap.append(p); }
    const ta = el('textarea',{class:'field', rows:isS?6:4, placeholder:'Type your response here'});
    const wc = el('div',{class:'wc'},'');
    const upd = ()=>{ const n=words(ta.value).length;
      wc.textContent = `Word count: ${n}   (required: ${m.wmin}-${m.wmax})`;
      wc.classList.toggle('bad', n>0 && (n<m.wmin || n>m.wmax)); };
    ta.addEventListener('input', upd); upd();
    wrap.append(ta, wc); getAnswer = ()=> ta.value;
  }
  else if(t==='we'){
    prompt('You have 20 minutes to plan, write and revise an essay. Your response will be judged on how well you develop a position, organise your ideas, present supporting details, and control the elements of standard written English.');
    wrap.append(el('div',{class:'passage'}, el('p',{}, item.prompt)));
    const ta = el('textarea',{class:'field', rows:14, placeholder:'Write your essay here'});
    const wc = el('div',{class:'wc'},'');
    const upd = ()=>{ const n=words(ta.value).length;
      wc.textContent = `Word count: ${n}   (required: 200-300)`;
      wc.classList.toggle('bad', n>0 && (n<200||n>300)); };
    ta.addEventListener('input', upd); upd();
    wrap.append(ta, wc); getAnswer = ()=> ta.value;
  }
  else if(t==='rwfib'){
    prompt('Below is a text with blanks. Click on each blank, a list of choices will appear. Select the appropriate answer for each blank.');
    const box = el('div',{class:'passage fib'});
    const picks = new Array(item.blanks.length).fill(null);
    item.text.split(/(___\d+___)/).forEach(seg=>{
      const mm = seg.match(/^___(\d+)___$/);
      if(!mm){ box.append(document.createTextNode(seg)); return; }
      const i = +mm[1], sel = el('select');
      sel.append(el('option',{value:''},'Select'));
      item.blanks[i].options.forEach((o,oi)=> sel.append(el('option',{value:oi}, o)));
      sel.addEventListener('change', ()=> picks[i] = sel.value===''?null:+sel.value);
      box.append(sel);
    });
    wrap.append(box); getAnswer = ()=> picks;
  }
  else if(t==='rfib'){
    prompt('In the text below some words are missing. Drag words from the box below to the appropriate place in the text.');
    const box = el('div',{class:'passage fib'});
    const picks = new Array(item.answers.length).fill(null);
    const zones = [];
    item.text.split(/(___\d+___)/).forEach(seg=>{
      const mm = seg.match(/^___(\d+)___$/);
      if(!mm){ box.append(document.createTextNode(seg)); return; }
      const i=+mm[1];
      const z = el('span',{class:'dropzone', 'data-i':i, tabindex:0},'          ');
      z.addEventListener('dragover', e=>{e.preventDefault(); z.classList.add('over');});
      z.addEventListener('dragleave', ()=> z.classList.remove('over'));
      z.addEventListener('drop', e=>{
        e.preventDefault(); z.classList.remove('over');
        const w = e.dataTransfer.getData('text'); place(i, w);
      });
      z.addEventListener('click', ()=>{ if(picks[i]){ release(i); } });
      zones[i]=z; box.append(z);
    });
    const bank = el('div',{class:'wordbank'});
    const chips = item.bank.map(w=>{
      const c = el('div',{class:'chip', draggable:'true'}, w);
      c.addEventListener('dragstart', e=> e.dataTransfer.setData('text', w));
      c.addEventListener('click', ()=>{ const free = picks.findIndex(p=>p==null); if(free>=0) place(free, w); });
      bank.append(c); return c;
    });
    function place(i,w){
      if(picks[i]) release(i);
      const chip = chips.find(c=> c.textContent===w && !c.classList.contains('used'));
      if(!chip) return;
      chip.classList.add('used'); picks[i]=w; zones[i].textContent=w;
    }
    function release(i){
      const w = picks[i]; if(!w) return;
      const chip = chips.find(c=> c.textContent===w && c.classList.contains('used'));
      if(chip) chip.classList.remove('used');
      picks[i]=null; zones[i].textContent='          ';
    }
    wrap.append(box, bank, el('div',{class:'small muted',style:'margin-top:8px'},'Drag a word into a gap, or click a word then a gap. Click a filled gap to clear it.'));
    getAnswer = ()=> picks;
  }
  else if(t==='rmcma' || t==='lmcma'){
    prompt(t==='lmcma'
      ? 'Listen to the recording and answer the question by selecting all the correct responses. More than one response is correct.'
      : 'Read the text and answer the question by selecting all the correct responses. More than one response is correct.');
    if(t==='lmcma') wrap.append(audioPanel(item.transcript,{lead:5}));
    else { const p=el('div',{class:'passage'}); p.append(el('p',{},item.passage)); wrap.append(p); }
    wrap.append(el('div',{class:'qtext'}, item.q));
    const chosen = new Set();
    item.options.forEach((o,i)=>{
      const cb = el('input',{type:'checkbox'});
      const row = el('label',{class:'opt'}, cb, el('span',{},o));
      cb.addEventListener('change', ()=>{ cb.checked?chosen.add(i):chosen.delete(i); row.classList.toggle('sel',cb.checked); });
      wrap.append(row);
    });
    wrap.append(el('div',{class:'small muted',style:'margin-top:6px'},'Incorrect selections subtract a point.'));
    getAnswer = ()=> [...chosen].sort((a,b)=>a-b);
  }
  else if(t==='rmcsa' || t==='lmcsa' || t==='hcs' || t==='smw'){
    const label = {rmcsa:'Read the text and answer the multiple-choice question by selecting the correct response. Only one response is correct.',
      lmcsa:'Listen to the recording and answer the question by selecting the correct response. Only one response is correct.',
      hcs:'You will hear a recording. Click on the paragraph that best relates to the recording.',
      smw:'You will hear a recording. At the end of the recording the last word or group of words has been replaced by a beep. Select the correct option to complete the recording.'}[t];
    prompt(label);
    if(t==='rmcsa'){ const p=el('div',{class:'passage'}); p.append(el('p',{},item.passage)); wrap.append(p); }
    else wrap.append(audioPanel(item.transcript,{lead:5, beepAfter:t==='smw'}));
    if(item.q) wrap.append(el('div',{class:'qtext'}, item.q));
    let pick=null;
    item.options.forEach((o,i)=>{
      const rb = el('input',{type:'radio', name:'o'+run.idx});
      const row = el('label',{class:'opt'}, rb, el('span',{},o));
      rb.addEventListener('change', ()=>{ pick=i; [...wrap.querySelectorAll('.opt')].forEach(x=>x.classList.remove('sel')); row.classList.add('sel'); });
      wrap.append(row);
    });
    getAnswer = ()=> pick;
  }
  else if(t==='ro'){
    prompt('The text boxes in the left panel have been placed in a random order. Restore the original order by dragging them into the right panel.');
    const order = item.paras.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; }
    const src = el('div',{class:'rbox'}, el('h4',{},'Source'));
    const dst = el('div',{class:'rbox'}, el('h4',{},'Target — correct order'));
    let dragged=null;
    order.forEach(i=>{
      const n = el('div',{class:'ritem', draggable:'true', 'data-i':i}, item.paras[i]);
      n.addEventListener('dragstart', ()=>{ dragged=n; n.classList.add('drag'); });
      n.addEventListener('dragend', ()=> n.classList.remove('drag'));
      src.append(n);
    });
    [src,dst].forEach(zone=>{
      zone.addEventListener('dragover', e=>{
        e.preventDefault();
        const after = [...zone.querySelectorAll('.ritem:not(.drag)')].find(c=> e.clientY < c.getBoundingClientRect().top + c.offsetHeight/2);
        if(after) zone.insertBefore(dragged, after); else zone.append(dragged);
      });
    });
    wrap.append(el('div',{class:'reorder'}, src, dst));
    getAnswer = ()=> [...dst.querySelectorAll('.ritem')].map(n=>+n.dataset.i);
  }
  else if(t==='lfib'){
    prompt('You will hear a recording. Type the missing words in each blank.');
    wrap.append(audioPanel(item.transcript,{lead:6}));
    const box = el('div',{class:'passage fib'});
    const inputs=[];
    item.transcript.split(/(\[[^\]]+\])/).forEach(seg=>{
      if(seg.startsWith('[')){ const inp=el('input',{type:'text'}); inputs.push(inp); box.append(inp); }
      else box.append(document.createTextNode(seg));
    });
    wrap.append(box); getAnswer = ()=> inputs.map(i=>i.value);
  }
  else if(t==='hiw'){
    prompt('You will hear a recording. Below is a transcription of it. Some words in the transcription differ from what the speaker said. Click on the words that are different.');
    const {display} = hiwWords(item);
    wrap.append(audioPanel(item.spoken,{lead:5}));
    const box = el('div',{class:'passage hiw'});
    const marked = new Set();
    display.forEach((w,i)=>{
      const n = el('w',{tabindex:0}, w);
      const tog = ()=>{ marked.has(i)?marked.delete(i):marked.add(i); n.classList.toggle('marked'); };
      n.addEventListener('click', tog);
      n.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault(); tog();} });
      box.append(n, document.createTextNode(' '));
    });
    wrap.append(box, el('div',{class:'small muted',style:'margin-top:8px'},'Each word marked that was in fact correct costs a point.'));
    getAnswer = ()=> [...marked];
  }
  else if(t==='wfd'){
    prompt('You will hear a sentence. Type the sentence in the box below exactly as you hear it. You will hear the sentence only once.');
    wrap.append(audioPanel(item.text,{lead:4}));
    const ta = el('textarea',{class:'field', rows:3, placeholder:'Type the sentence'});
    wrap.append(ta); getAnswer = ()=> ta.value;
  }

  else if(t==='sgd'){
    prompt('You will hear a group of students discussing a topic. After the discussion you will have 10 seconds to prepare, then 60 seconds to summarise what was said, making clear who argued what.');
    let rp;
    const script = item.turns.map(x=>`${x.speaker} said. ${x.text}`).join(' ');
    const ap = audioPanel(script, {lead:5, onDone:()=>{
      rp = recorderPanel({prep:m.prep, rec:m.rec, onFinish:()=>run.advanceReady()});
      wrap.append(rp); run.hold = rp;
    }});
    const names = el('div',{class:'small muted', style:'margin-bottom:14px'},
      'Speakers: ' + item.turns.map(x=>x.speaker).filter((v,i,a)=>a.indexOf(v)===i).join(', '));
    wrap.append(names, ap,
      el('div',{class:'small muted', style:'margin-top:12px'},'Take notes while you listen. Notes are not scored.'),
      el('textarea',{class:'field', rows:4, placeholder:'Notes', style:'margin-top:8px'}));
    run.hold = ap; getAnswer = ()=> rp && rp._result;
  }
  else if(t==='rts'){
    prompt('You will hear a description of a situation. You have 20 seconds to think about your answer, then 40 seconds to respond. Speak as you would to the person described.');
    let rp;
    const ap = audioPanel(item.situation + ' ' + item.task, {lead:4, onDone:()=>{
      rp = recorderPanel({prep:m.prep, rec:m.rec, onFinish:()=>run.advanceReady()});
      wrap.append(rp); run.hold = rp;
    }});
    wrap.append(ap, el('div',{class:'passage', style:'margin-top:16px'},
      el('p',{}, item.situation), el('p',{}, el('b',{}, item.task))));
    run.hold = ap; getAnswer = ()=> rp && rp._result;
  }
  return {node:wrap, answer:()=>getAnswer()};
}

