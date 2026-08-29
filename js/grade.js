/* Grading.

   Selection items (multiple choice, re-order, both blank types) are scored by
   exact comparison and the model supplies feedback only. Spoken and typed
   responses are scored by the model, which receives the target text, the
   transcript and the acoustic measurements.

   gradeMode 'full' routes selection items to the model as well. */
/* Maximum score per item type. Must match the scales given in RUBRIC. */
const MAXSCORE = {ra:9, rs:3, di:15, rl:15, asq:1, sgd:15, rts:15, swt:7, we:15, sst:10};

function lcs(a,b){
  const m=a.length,n=b.length; if(!m||!n) return 0;
  let prev=new Array(n+1).fill(0), cur=new Array(n+1).fill(0);
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++) cur[j] = a[i-1]===b[j-1] ? prev[j-1]+1 : Math.max(prev[j],cur[j-1]);
    [prev,cur]=[cur,prev]; cur.fill(0);
  }
  return prev[n];
}
function hiwWords(item){
  const w = item.spoken.split(/\s+/), wrong=new Set(), disp=w.slice();
  for(const k in item.swaps){ disp[+k]=item.swaps[k]; wrong.add(+k); }
  return {display:disp, wrong};
}
function chartSummary(c){
  const bits = [`Chart type: ${c.kind}.`, `Title: ${c.title}.`];
  if(c.unit) bits.push(`Unit: ${c.unit}.`);
  if(c.categories && c.series) c.series.forEach(s=>
    bits.push(`${s.name||'Series'}: ` + c.categories.map((k,i)=>`${k} ${s.values[i]}`).join(', ') + '.'));
  if(c.labels && c.values) bits.push(c.labels.map((l,i)=>`${l} ${c.values[i]}`).join(', ') + '.');
  if(c.headers && c.rows) bits.push([c.headers.join(' | '), ...c.rows.map(r=>r.join(' | '))].join(' ;; '));
  if(c.steps) bits.push('Stages: ' + c.steps.join(' -> ') + '.');
  if(c.panels) c.panels.forEach(p=> bits.push(`${p.label}: ` + p.features.map(f=>f.name).join(', ') + '.'));
  if(c.summary) bits.push('What a strong answer covers: ' + c.summary);
  return bits.join(' ');
}

/* Deterministic check. Used as the score for exact items, as evidence otherwise. */
function machineCheck(item, ans){
  const t=item.type;
  switch(t){
    case 'rmcma': case 'lmcma': {
      const picked = ans||[], right = item.answers;
      const good = picked.filter(i=>right.includes(i)).length, bad = picked.filter(i=>!right.includes(i)).length;
      return {exact:true, earned:clamp(good-bad,0,right.length), max:right.length,
        picked:picked.map(i=>item.options[i]), correct:right.map(i=>item.options[i]),
        note:`${good} correct, ${bad} incorrect; wrong choices subtract a point each.`};
    }
    case 'rmcsa': case 'lmcsa': case 'hcs': case 'smw':
      return {exact:true, earned: ans===item.answer?1:0, max:1,
        picked: ans!=null?item.options[ans]:'no answer', correct:item.options[item.answer]};
    case 'ro': {
      const order=ans||[]; const links=[];
      for(let i=0;i<order.length-1;i++) links.push(order[i+1]===order[i]+1);
      return {exact:true, earned:links.filter(Boolean).length, max:item.paras.length-1,
        order, links,
        note:'Scored on adjacent pairs in the correct sequence, not absolute position. '+
             `You placed ${order.length} paragraphs and ${links.filter(Boolean).length} of the ${links.length} joins between them were right.`};
    }
    case 'rwfib': {
      const picks=ans||[]; const per=item.blanks.map((b,i)=>({got:picks[i]!=null?b.options[picks[i]]:'—', want:b.options[b.answer], ok:picks[i]===b.answer}));
      return {exact:true, earned:per.filter(p=>p.ok).length, max:per.length, per};
    }
    case 'rfib': {
      const picks=ans||[]; const per=item.answers.map((k,i)=>({got:picks[i]||'—', want:k, ok:norm(picks[i])===norm(k)}));
      return {exact:true, earned:per.filter(p=>p.ok).length, max:per.length, per};
    }
    case 'lfib': {
      const keys=(item.transcript.match(/\[([^\]]+)\]/g)||[]).map(s=>s.slice(1,-1));
      const picks=ans||[]; const per=keys.map((k,i)=>({got:picks[i]||'—', want:k, ok:norm(picks[i])===norm(k)}));
      return {exact:false, earned:per.filter(p=>p.ok).length, max:keys.length, per,
        note:'Exact match shown; the model decides whether a near miss is a spelling error or a typo.'};
    }
    case 'hiw': {
      const {display,wrong}=hiwWords(item), marked=new Set(ans||[]);
      const spoken=item.spoken.split(/\s+/);
      const hits=[],falseAlarms=[],misses=[];
      marked.forEach(i=> wrong.has(i)
        ? hits.push({shown:display[i], heard:spoken[i]})
        : falseAlarms.push(display[i]));
      wrong.forEach(i=>{ if(!marked.has(i)) misses.push({shown:display[i], heard:spoken[i]}); });
      return {exact:true, earned:clamp(hits.length-falseAlarms.length,0,wrong.size), max:wrong.size,
        hits, falseAlarms, misses,
        note:`${hits.length} of ${wrong.size} altered words found, ${falseAlarms.length} correct words wrongly marked.`};
    }
    case 'wfd': {
      const want=words(item.text).map(w=>w.toLowerCase()), got=words(ans).map(w=>w.toLowerCase());
      const hit=lcs(want,got);
      return {exact:false, earned:hit, max:want.length, typed:ans||'',
        note:`${hit} of ${want.length} words matched exactly and in sequence.`};
    }
    case 'ra': case 'rs': {
      const want=words(item.text).map(w=>w.toLowerCase());
      const got=words(ans&&ans.transcript).map(w=>w.toLowerCase());
      const hit=lcs(want,got);
      return {exact:false, earned:0, max:t==='ra'?9:3,
        recognised_word_overlap:`${hit}/${want.length}`,
        words_per_minute: Math.round((ans&&ans.wpm)||0),
        silence_ratio: Math.round(((ans&&ans.silenceRatio)||0)*100)/100,
        recogniser_confidence: ans&&ans.confidence!=null ? Math.round(ans.confidence*100)/100 : null,
        speech_duration_sec: Math.round((ans&&ans.duration)||0)};
    }
    default: {
      const spoken = ans && ans.transcript!=null;
      return {exact:false, earned:0, max: MAXSCORE[t] || 5,
        words_per_minute: spoken?Math.round(ans.wpm||0):undefined,
        silence_ratio: spoken?Math.round((ans.silenceRatio||0)*100)/100:undefined,
        recogniser_confidence: spoken&&ans.confidence!=null?Math.round(ans.confidence*100)/100:undefined,
        speech_duration_sec: spoken?Math.round(ans.duration||0):undefined};
    }
  }
}

/* Reference answer supplied to the model. */
function modelAnswer(item){
  switch(item.type){
    case 'ra': case 'rs': return {printed_text: item.text};
    case 'wfd': return {target_sentence: item.text};
    case 'asq': return {accepted_answers: item.a};
    case 'di':  return {chart_contents: chartSummary(item.chart)};
    case 'rl':  return {source_lecture: item.transcript, must_cover: item.key||[]};
    case 'sgd': return {discussion: item.turns.map(t=>`${t.speaker}: ${t.text}`).join('\n'), must_cover: item.key||[]};
    case 'rts': return {situation: item.situation, task: item.task, must_cover: item.key||[]};
    case 'swt': return {source_passage: item.passage, key_points: item.key||[]};
    case 'sst': return {source_transcript: item.transcript, key_points: item.key||[]};
    case 'we':  return {prompt: item.prompt};
    case 'lfib': return {gap_words: (item.transcript.match(/\[([^\]]+)\]/g)||[]).map(s=>s.slice(1,-1))};
    case 'ro':  return {correct_order: item.paras,
      scoring:'One point per pair of paragraphs that end up adjacent in the correct order. Absolute position earns nothing.'};
    case 'hiw': return {spoken_text: item.spoken,
      altered_words: Object.entries(item.swaps||{}).map(([i,w])=>({position:+i, heard:item.spoken.split(/\s+/)[+i], shown:w}))};
    case 'rmcma': case 'lmcma':
      return {question:item.q, options:item.options, correct_options:(item.answers||[]).map(i=>item.options[i])};
    case 'rmcsa': case 'lmcsa': case 'hcs': case 'smw':
      return {question:item.q||'Select the correct option', options:item.options, correct_option:item.options[item.answer]};
    case 'rwfib': return {gaps: (item.blanks||[]).map(b=>({correct:b.options[b.answer], distractors:b.options.filter((_,i)=>i!==b.answer)}))};
    case 'rfib': return {gap_words: item.answers, word_bank: item.bank};
    default: return {};
  }
}
function candidateResponse(item, ans){
  if(ans && ans.transcript!=null){
    // Tell the grader which transcriber produced the text; it affects how much
    // allowance should be made for apparent errors.
    return ans.transcribedBy
      ? {transcript: ans.transcript || '(silence)', transcribed_by: ans.transcribedBy,
         transcript_quality: 'professional speech-to-text model; treat apparent errors as real unless clearly acoustic'}
      : {speech_recognition_transcript: ans.transcript || '(nothing recognised)',
         transcript_quality: 'browser speech recognition; unreliable, allow generously for mishearings'};
  }
  if(typeof ans === 'string') return {typed: ans, word_count: words(ans).length};
  return {selection: ans};
}

const RUBRIC = `You are a certified PTE Academic examiner working to Pearson's published scoring guides. You are exacting and you do not inflate scores.

CRITICAL — speech recognition. Spoken responses reach you as a browser transcript, not as audio. The recogniser drops words, merges them, and mangles proper nouns even when the candidate spoke perfectly. Never deduct for something that looks like a recognition artefact: a homophone, a missing article, absent punctuation, a plausible mishearing. Deduct only where the transcript shows a real content failure — a point not made, an idea reversed, a sentence abandoned. When a transcript is empty or nearly empty but the acoustic data shows sustained speech, say so and score conservatively rather than giving zero.

Scoring guides:
- Read Aloud (max 9): content 0-3 against the printed text, oral fluency 0-3 from pace and pausing, pronunciation 0-3. Judge fluency from words_per_minute (natural is 130-170) and silence_ratio. Judge pronunciation from recogniser_confidence and how cleanly the transcript matches.
- Repeat Sentence (max 3): all words in order 3; most 2; about half 1; little or none 0.
- Describe Image (max 15): content 0-5 against the chart contents supplied, oral fluency 0-5, pronunciation 0-5. A fluent answer that omits the data scores low on content; a complete answer delivered in fragments scores low on fluency.
- Re-tell Lecture (max 15): content 0-5 on main points and relationships rather than wording, oral fluency 0-5, pronunciation 0-5.
- Answer Short Question (max 1): 1 if the answer matches any accepted answer in meaning, else 0. One word is enough.
- Summarize Group Discussion (max 15): content 0-5, which must attribute positions to the right speakers and capture the disagreement rather than list topics, plus oral fluency 0-5 and pronunciation 0-5.
- Respond to a Situation (max 15): content 0-5 on appropriateness, register and whether the task set was addressed, plus oral fluency 0-5 and pronunciation 0-5.
- Summarize Written Text (max 7): content 0-2, form 0-1 (one sentence, 5-75 words, else 0), grammar 0-2, vocabulary 0-2.
- Summarize Spoken Text (max 10): content 0-2, form 0-2 (50-70 words), grammar 0-2, vocabulary 0-2, spelling 0-2.
- Write Essay (max 15): content 0-3, form 0-2 (200-300 words), development 0-2, grammar 0-2, linguistic range 0-2, vocabulary 0-2, spelling 0-2.
- Write from Dictation: one point per word correct and in order. Accept a clear typo only where the intended word is unambiguous; do not accept a different word.
- Fill in the Blanks (listening): one point per gap. Spelling must be correct.

SUBSCORES. For every spoken item you must return subscores named exactly "content", "oral_fluency" and "pronunciation". Judge oral_fluency from words_per_minute (natural is 130-170), silence_ratio and whether the transcript reads as continuous speech or as restarted fragments. Judge pronunciation from recogniser_confidence together with how cleanly the transcript resolves into real words; where a professional transcriber produced the transcript, confidence will be absent, so judge pronunciation from word clarity alone and say so in the feedback. For written items return "content", "form", "grammar", "vocabulary" and, where the guide lists it, "spelling" and "development".

AUTHORITY. Each item carries an "authority" field. Where it is "machine", the supplied machine.earned is a literal comparison and is final: return it unchanged as earned and write only the feedback. Where it is "model", you decide the score yourself.

Feedback must name the specific omission, sentence or word responsible. Never write generic advice.`;

const GRADE_TOOL = {
  name: 'submit_scores',
  description: 'Return one score object for each item supplied.',
  input_schema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {type:'integer', description:'The item id from the input.'},
            earned: {type:'number', description:'Score awarded, never above max_score.'},
            max: {type:'number', description:'The max_score given for this item.'},
            subscores: {
              type:'object',
              description:'Named sub-scores. Spoken items must include content, oral_fluency and pronunciation.',
              additionalProperties:{type:'number'}
            },
            feedback: {type:'string', description:'Two to four sentences naming the exact problem. Never generic.'},
            corrected: {type:'string', description:'Typed responses only: the response with minimal corrections. Empty string otherwise.'},
            transcription_note: {type:'string', description:'Only if something was judged a recognition artefact rather than a mistake. Empty string otherwise.'}
          },
          required:['id','earned','max','feedback']
        }
      }
    },
    required:['results']
  }
};

const COACH_TOOL = {
  name: 'submit_coaching_report',
  description: 'Return a personalised coaching report for the student.',
  input_schema: {
    type:'object',
    properties:{
      headline:{type:'string', description:'One sentence on where the student stands.'},
      weaknesses:{
        type:'array', minItems:3, maxItems:3,
        description:'Exactly three, ordered by points lost.',
        items:{type:'object', properties:{
          title:{type:'string'},
          cost:{type:'string', description:'What it cost, citing the actual items.'},
          drill:{type:'string', description:'A concrete exercise naming the PTE task type.'}
        }, required:['title','cost','drill']}
      },
      strength:{type:'string', description:'One real strength, cited from the data.'},
      target:{type:'string', description:'A realistic next-attempt target and what must change.'}
    },
    required:['headline','weaknesses','strength','target']
  }
};

const AIGrade = {
  async batch(entries, run){
    const payload = entries.map(x=>{
      const m = machineCheck(x.item, x.answer);
      const authority = (S.gradeMode==='full') ? 'model' : (m.exact ? 'machine' : 'model');
      return {id:x.idx, task:META[x.type].label, max_score:m.max, authority,
              model_answer:modelAnswer(x.item), candidate_response:candidateResponse(x.item,x.answer),
              machine:m};
    });

    // Attach the rendered chart for Describe Image where the provider accepts images.
    const content = [];
    const images = provider().vision
      ? entries.filter(x=> x.type==='di' && run && run.charts && run.charts[x.idx]).slice(0, 6)
      : [];
    images.forEach(x=>{
      content.push({type:'text', text:`Image for item ${x.idx} (Describe Image):`});
      content.push({type:'image', source:{type:'base64', media_type:'image/png', data:run.charts[x.idx]}});
    });
    content.push({type:'text', text:
`Score every response below and call submit_scores.

${JSON.stringify(payload, null, 1)}` +
(images.length ? `

The images above are the charts the candidate was actually looking at. Judge Describe Image content against the image itself, not only against the written description supplied.` : '')});

    const out = await API.structured({
      model: S.models.grade, system: RUBRIC, content,
      tool: GRADE_TOOL, maxTokens: 8000, label: 'grading batch'
    });
    const map = {};
    (out.results || []).forEach(r=>{ if(r && r.id!=null) map[r.id]=r; });
    return map;
  },

  async coach(report){
    return API.structured({
      model: S.models.coach, maxTokens: 3000, label: 'coaching report',
      system: 'You are an experienced PTE Academic tutor: direct, specific, encouraging, never generic.',
      content: `A student has just finished a PTE Academic ${report.mode}. Here is the result.

${JSON.stringify(report, null, 1)}

Write their coaching report and call submit_coaching_report. Cite real items. No generic advice such as "practise more".`,
      tool: COACH_TOOL
    });
  }
};

async function gradeRun(run){
  const entries = run.items.map((it,i)=>({idx:i, type:it.type, item:it, answer:run.answers[i]}));
  run.scores = new Array(entries.length);
  const fallback = e => {
    const m = machineCheck(e.item, e.answer);
    return {earned:m.exact?m.earned:0, max:m.max, detail:m, ai:false,
            feedback: m.exact ? '' : 'Not graded — no model response available.'};
  };
  if(!S.apiKey){
    entries.forEach(e=>{ const f=fallback(e);
      if(!f.detail.exact){
        f.notScored = true;   // excluded from the rollup rather than scored zero
        f.feedback = 'Not scored \u2014 this task needs a model. Everything with a definite answer was still marked, and the review below is complete.';
      }
      run.scores[e.idx]=f; });
    return;
  }
  // batch by part so no single request gets unwieldy
  const byPart = {1:[],2:[],3:[]};
  entries.forEach(e=> byPart[META[e.type].part].push(e));
  for(const part of [1,2,3]){
    const group = byPart[part]; if(!group.length) continue;
    screenBusy('Grading part '+part, `${group.length} responses in one request to ${S.models.grade}.`);
    let map = null;
    for(let a=0;a<2 && !map;a++){
      try{ map = await AIGrade.batch(group, run); }
      catch(err){ if(a===1){ toast('Grading failed for part '+part+': '+err.message, 7000); } }
    }
    group.forEach(e=>{
      const r = map && map[e.idx];
      const m = machineCheck(e.item, e.answer);
      if(!r){ run.scores[e.idx] = fallback(e); return; }
      const earned = (S.gradeMode!=='full' && m.exact) ? m.earned : clamp(+r.earned||0, 0, m.max);
      run.scores[e.idx] = {earned, max:m.max, ai:true, subscores:r.subscores||{},
        feedback:r.feedback||'', corrected:r.corrected||'', tnote:r.transcription_note||'', detail:m};
    });
  }
}

/* Roll item scores up to the 10-90 scale. */
const SUBMAX = {content:5, form:2, grammar:2, vocabulary:2, spelling:2, development:2,
                linguistic_range:2, oral_fluency:5, pronunciation:5, structure:2};
function buildReport(run){
  const rows = run.items.map((x,i)=>{
    const r = run.scores[i] || {earned:0,max:1,detail:{}};
    return {i, type:x.type, label:META[x.type].label, skills:META[x.type].skills, ...r};
  });
  const band = p => Math.round(clamp(10 + 80*p, 10, 90));
  const bySkill = {listening:[],reading:[],speaking:[],writing:[]};
  rows.forEach(r=>{ if(r.notScored) return;
    r.skills.forEach(s=> bySkill[s] && bySkill[s].push(r.max ? r.earned/r.max : 0)); });
  const comm = {}; for(const k in bySkill) comm[k] = bySkill[k].length ? band(avg(bySkill[k])) : null;

  /* Approximate a missing spoken sub-score from the acoustic measurements. */
  const acoustic = (rows, kind) => {
    const d = rows.map(r=>r.detail).filter(x=> x && x.words_per_minute!=null);
    if(!d.length) return null;
    if(kind==='fluency'){
      return clamp(avg(d.map(x=>
        clamp(1 - Math.abs((x.words_per_minute||0)-150)/150, 0, 1) *
        clamp(1 - (x.silence_ratio||0)*1.4, 0, 1))), 0, 1);
    }
    const c = d.map(x=>x.recogniser_confidence).filter(x=>typeof x==='number');
    return c.length ? clamp(avg(c), 0, 1) : null;
  };
  const subAvg = key => {
    const v = rows.map(r=>r.subscores && r.subscores[key]).filter(x=>typeof x==='number');
    return v.length ? clamp(avg(v)/(SUBMAX[key]||2),0,1) : null;
  };
  const pct = types => { const rs = rows.filter(r=>types.includes(r.type) && !r.notScored);
    return rs.length ? avg(rs.map(r=>r.max?r.earned/r.max:0)) : null; };
  const raw = {
    'Grammar':          subAvg('grammar'),
    'Oral fluency':     subAvg('oral_fluency') ?? subAvg('fluency') ?? acoustic(rows,'fluency'),
    'Pronunciation':    subAvg('pronunciation') ?? acoustic(rows,'pron'),
    'Spelling':         subAvg('spelling') ?? pct(['wfd','lfib','rfib']),
    'Vocabulary':       subAvg('vocabulary') ?? pct(['rwfib']),
    'Written discourse':subAvg('development') ?? subAvg('structure') ?? pct(['we','swt'])
  };
  const enab = {}; for(const k in raw) enab[k] = raw[k]==null ? null : band(raw[k]);
  const active = Object.values(comm).filter(v=>v!=null);
  return {mode:run.modeName, testNo:run.testNo, when:Date.now(),
    overall: active.length ? Math.round(avg(active)) : 0,
    communicative:comm, enabling:enab, rows,
    unscored: rows.filter(r=>r.notScored).length,
    totals:{earned:sum(rows.filter(r=>!r.notScored).map(r=>r.earned)),
            max:sum(rows.filter(r=>!r.notScored).map(r=>r.max))}};
}
