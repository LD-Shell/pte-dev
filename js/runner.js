/* Exam runner: item flow, timers and irreversible advance. */
function startRun({items, modeName, testNo, budget}){
  const run = {
    items, idx:0, answers:[], scores:[], modeName, testNo,
    budget: budget||null, left: budget||null, hold:null, node:null, current:null,
    confirmedOnce:false
  };
  S.run = run;
  run.advanceReady = ()=>{
    run.hold = null; renderFoot();
    setTimeout(()=>{ if(S.run===run && run.idx<items.length) next(true); }, 1200);
  };
  let itemLeft = null, tick;

  function shell(){
    const bar = el('div',{class:'shell'});
    const cand = el('input',{class:'cand', placeholder:'Candidate name', value:S.candidate});
    cand.addEventListener('input', ()=>{ S.candidate=cand.value; saveSettings(); });
    const clock = el('div',{class:'clock mono'},'--:--');
    bar.append(el('div',{class:'brand'},'PTE Academic'), cand, el('div',{class:'spacer'}),
      el('div',{class:'meta'}, `${modeName}${testNo?' · Test '+testNo:''}`),
      el('div',{class:'meta'}, `Item ${run.idx+1} of ${items.length}`), clock);
    run.clock = clock;
    return bar;
  }
  const foot = el('div',{class:'footbar'});
  function renderFoot(){
    foot.innerHTML='';
    const it = items[run.idx], m = META[it.type];
    foot.append(el('div',{class:'small muted'}, m.label));
    foot.append(el('div',{class:'spacer'}));
    if(run.hold) foot.append(el('div',{class:'small muted'},'This task advances on its own when the recording ends.'));
    const btn = el('button',{class:'btn btn-primary', onclick:()=>next(false)}, run.idx===items.length-1?'Finish':'Next');
    btn.disabled = !!run.hold;
    foot.append(btn);
  }
  async function next(auto){
    if(!auto && !run.confirmedOnce){
      const ok = await confirmDialog('Move on?',
        'Once you continue you cannot return to this item. The real test works the same way, so this confirmation only appears once.',
        'Continue');
      if(!ok) return;
      run.confirmedOnce = true;
    }
    commit();
    if(run.idx >= items.length-1) return finish();
    run.idx++; paint();
  }
  function commit(){
    try{ run.answers[run.idx] = run.current ? run.current.answer() : null; }catch(e){ run.answers[run.idx]=null; }
    if(run.node && run.node._cleanupAll) run.node._cleanupAll();
    Speech.stop();
  }
  function paint(){
    clearInterval(tick);
    const it = items[run.idx], m = META[it.type];
    run.hold = null;
    const body = el('div',{class:'exam-body'});
    const inner = el('div',{class:'exam-inner'});
    run.current = renderItem(it, run);
    inner.append(run.current.node); body.append(inner);
    const s = shell();
    const screen = el('div',{class:'screen'}, s, body, foot);
    screen._cleanupAll = ()=> screen.querySelectorAll('.player,.rec').forEach(n=> n._cleanup && n._cleanup());
    run.node = screen;
    app.innerHTML=''; app.append(screen);
    renderFoot();
    itemLeft = m.sec || null;
    if(run.budget!=null && itemLeft!=null) itemLeft = Math.min(itemLeft, run.left);
    tick = setInterval(()=>{
      if(run.budget!=null){ run.left--; if(run.left<=0){ commit(); return finish(); } }
      if(itemLeft!=null) itemLeft--;
      const show = itemLeft!=null ? itemLeft : run.left;
      if(show!=null){
        run.clock.textContent = mmss(show);
        run.clock.classList.toggle('low', show<=30);
      } else run.clock.textContent = '—';
      if(itemLeft!=null && itemLeft<=0){ clearInterval(tick); next(true); }
    },1000);
    const show0 = itemLeft!=null ? itemLeft : run.left;
    run.clock.textContent = show0!=null ? mmss(show0) : '—';
  }
  async function finish(){
    clearInterval(tick); Speech.stop();
    if(run.node && run.node._cleanupAll) run.node._cleanupAll();
    await grade(run);
  }
  paint();
}

async function grade(run){
  await transcribeRun(run);
  screenBusy('Scoring your responses', 'Every response goes to '+S.models.grade+', batched one request per part.');
  await gradeRun(run);
  const report = buildReport(run);
  report.items = run.items;
  report.rawAnswers = run.answers;
  report.answers = run.items.map((it,i)=>{
    const a = run.answers[i] || {};
    return {type:it.type, audio: a.url || null, transcript: a.transcript || null,
            browserTranscript: a.browserTranscript || null, transcribedBy: a.transcribedBy || null};
  });
  if(S.apiKey){
    try{
      screenBusy('Writing your coaching report', 'One pass with '+S.models.coach+'.');
      report.coach = await AIGrade.coach({mode:report.mode, overall:report.overall,
        communicative:report.communicative, enabling:report.enabling,
        items:report.rows.map(r=>({task:r.label, earned:Math.round(r.earned*10)/10, max:r.max,
          feedback:r.feedback||''}))});
    }catch(e){ report.coachError = e.message; }
  }
  S.history.push({when:report.when, mode:report.mode, testNo:report.testNo, overall:report.overall,
    communicative:report.communicative, enabling:report.enabling});
  saveHistory(); S.run = null;
  showResults(report);
}

/* Re-transcribe recordings with the configured speech-to-text service.
   The browser transcript is retained for comparison in the results. */
async function transcribeRun(run){
  if(!S.stt.enabled || !S.stt.key) return;
  const jobs = run.answers
    .map((a,i)=>({a,i}))
    .filter(x=> x.a && x.a.blob && x.a.blob.size > 2000);
  if(!jobs.length) return;
  let done = 0, failed = 0;
  for(const {a,i} of jobs){
    screenBusy('Transcribing your recordings',
      `${done+1} of ${jobs.length} — ${S.stt.model}. This replaces Chrome's rough live transcript.`);
    try{
      const text = await API.transcribe(a.blob, {prompt:'A spoken response in an academic English speaking test.'});
      if(text){ a.browserTranscript = a.transcript; a.transcript = text; a.transcribedBy = S.stt.model; }
    }catch(e){
      failed++;
      if(failed === 1) toast('Transcription failed: '+e.message+' Falling back to the browser transcript.', 7000);
    }
    done++;
  }
}

function screenBusy(title, sub){
  app.innerHTML='';
  app.append(el('div',{class:'screen'}, el('div',{class:'pad', style:'padding-top:120px;text-align:center'},
    el('div',{class:'spin', style:'width:22px;height:22px;margin-bottom:16px'}),
    el('h2',{style:'margin:0 0 6px;font-size:19px'}, title),
    el('p',{class:'muted'}, sub||''))));
}

