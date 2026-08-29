/* Results page: score report, item breakdown and coaching report. */
const BANDS = [[79,'Highly proficient'],[65,'Proficient'],[50,'Competent'],[36,'Modest'],[0,'Limited']];
const bandName = s => (BANDS.find(b=> s>=b[0])||BANDS[4])[1];

function showResults(rep){
  const pad = el('div',{class:'pad pad-wide'});
  const head = el('div',{class:'scorehead'});
  head.append(el('div',{},
    el('div',{class:'eyebrow'},'Overall score'),
    el('div',{class:'bigscore'}, rep.overall||'—'),
    el('div',{class:'muted small'}, bandName(rep.overall)+' · scale 10-90')));
  const skills = el('div',{style:'flex:1'});
  skills.append(el('div',{class:'eyebrow', style:'margin-bottom:8px'},'Communicative skills'));
  ['listening','reading','speaking','writing'].forEach(k=>{
    const v = rep.communicative[k];
    skills.append(el('div',{class:'skillrow'}, el('b',{}, k[0].toUpperCase()+k.slice(1)),
      el('div',{class:'track'}, el('i',{style:`width:${v?clamp((v-10)/80*100,0,100):0}%`})),
      el('em',{}, v==null?'—':v)));
  });
  head.append(skills);
  pad.append(head);

  const enab = el('div',{class:'card'});
  enab.append(el('div',{class:'eyebrow', style:'margin-bottom:10px'},'Enabling skills'));
  Object.entries(rep.enabling).forEach(([k,v])=>{
    enab.append(el('div',{class:'skillrow'}, el('b',{},k),
      el('div',{class:'track'}, el('i',{style:`width:${v?clamp((v-10)/80*100,0,100):0}%`})),
      el('em',{}, v==null?'—':v)));
  });
  enab.append(el('div',{class:'small muted', style:'margin-top:10px'},
    'A dash means this test contained no item that measures the skill.'));
  if(rep.unscored) pad.append(el('div',{class:'card'},
    el('div',{class:'row'}, el('span',{class:'badge warn'}, rep.unscored+' item'+(rep.unscored>1?'s':'')+' not scored'),
      el('span',{class:'small muted'},'Speaking and writing tasks need a model to mark them, so they were left out of the score above rather than counted as zero. Everything with a definite answer was marked normally, and the item review below is complete either way.'))));
  pad.append(enab);

  if(rep.coach && rep.coach.raw){
    const c = el('div',{class:'coach'});
    c.append(el('div',{class:'eyebrow', style:'margin-bottom:10px'},'Coaching report'));
    String(rep.coach.raw).split(/\n{2,}/).forEach(par=> c.append(el('p',{}, par.trim())));
    pad.append(c, el('div',{style:'height:16px'}));
  } else if(rep.coach){
    const c = el('div',{class:'coach'});
    c.append(el('div',{class:'eyebrow', style:'margin-bottom:10px'},'Coaching report'));
    c.append(el('p',{style:'font-size:16px;color:var(--ink)'}, rep.coach.headline||''));
    (rep.coach.weaknesses||[]).forEach((w,i)=>{
      c.append(el('h4',{}, `${i+1}. ${w.title}`));
      c.append(el('p',{}, w.cost));
      c.append(el('p',{}, el('b',{},'Drill: '), w.drill));
    });
    if(rep.coach.strength){ c.append(el('h4',{},'What is already working')); c.append(el('p',{}, rep.coach.strength)); }
    if(rep.coach.target){ c.append(el('h4',{},'Next attempt')); c.append(el('p',{}, rep.coach.target)); }
    pad.append(c, el('div',{style:'height:16px'}));
  } else if(rep.coachError){
    const box = el('div',{class:'card'});
    const render = ()=>{
      box.innerHTML='';
      box.append(el('b',{},'Coaching report unavailable'),
        el('p',{class:'muted small'}, rep.coachError),
        el('div',{class:'row'},
          el('button',{class:'btn btn-sm btn-primary', onclick:async e=>{
            e.target.disabled = true; e.target.textContent = 'Retrying…';
            try{
              rep.coach = await AIGrade.coach({mode:rep.mode, overall:rep.overall,
                communicative:rep.communicative, enabling:rep.enabling,
                items:rep.rows.map(r=>({task:r.label, earned:Math.round(r.earned*10)/10,
                  max:r.max, feedback:r.feedback||''}))});
              rep.coachError = null;
              showResults(rep);
            }catch(err){ rep.coachError = err.message; render(); }
          }},'Retry'),
          el('button',{class:'btn btn-sm', onclick:()=>{
            modal((sh,close)=>{
              sh.append(el('h3',{},'Last API response'),
                el('pre',{style:'background:var(--surface-2);border:1px solid var(--rule);padding:12px;font-size:11.5px;overflow:auto;max-height:50vh'},
                  JSON.stringify(API.lastRaw, null, 1) || '(nothing recorded)'),
                el('div',{class:'row', style:'justify-content:flex-end;margin-top:14px'},
                  el('button',{class:'btn btn-sm', onclick:()=>close(null)},'Close')));
            });
          }},'Show the raw response')));
    };
    render();
    pad.append(box);
  }

  pad.append(el('div',{class:'eyebrow', style:'margin:22px 0 10px'},'Item by item'));
  rep.rows.forEach((r,i)=>{
    const d = el('details',{class:'itemres'});
    const pct = r.max ? r.earned/r.max : 0;
    d.append(el('summary',{},
      el('span',{class:'badge '+(pct>=.75?'ok':pct>=.4?'warn':'')}, r.label),
      el('span',{class:'small muted'}, `Item ${i+1}`),
      el('span',{class:'pts'}, r.notScored ? '\u2014' : `${Math.round(r.earned*10)/10} / ${r.max}`)));
    const b = el('div',{class:'body'});
    if(r.error) b.append(el('div',{class:'kv'}, el('b',{},'Grading error'), el('div',{}, r.error)));
    if(r.feedback) b.append(el('div',{class:'kv'}, el('b',{},'Examiner comment'), el('div',{}, r.feedback)));
    if(r.tnote) b.append(el('div',{class:'kv'}, el('b',{},'Allowed for as a recognition error'), el('div',{class:'muted'}, r.tnote)));
    if(r.subscores) Object.entries(r.subscores).forEach(([k,v])=>
      b.append(el('div',{class:'small muted'}, `${k}: ${v}`)));
    const dd = r.detail||{};
    if(dd.note) b.append(el('div',{class:'kv'}, el('b',{},'How this was scored'), el('div',{class:'muted'}, dd.note)));
    if(dd.want)  b.append(el('div',{class:'kv'}, el('b',{},'Target'), el('div',{}, dd.want)));
    if(dd.heard) b.append(el('div',{class:'kv'}, el('b',{},'Recognised from your speech'), el('div',{}, dd.heard)));
    const ans = rep.answers[i] || {};
    if(ans.browserTranscript && ans.browserTranscript !== ans.transcript){
      b.append(el('div',{class:'kv'}, el('b',{},'What '+(ans.transcribedBy||'speech-to-text')+' heard'), el('div',{}, ans.transcript||'—')));
      b.append(el('div',{class:'kv'}, el('b',{},'What Chrome heard (not used)'), el('div',{class:'muted'}, ans.browserTranscript)));
    }
    if(dd.typed!=null) b.append(el('div',{class:'kv'}, el('b',{},'You typed'), el('div',{}, dd.typed||'—')));
    if(dd.got!=null && typeof dd.got==='string') b.append(el('div',{class:'kv'}, el('b',{},'You typed'), el('div',{}, dd.got||'—')));
    if(r.corrected && dd.typed) b.append(el('div',{class:'kv'}, el('b',{},'Corrected'), el('div',{html:diffHtml(dd.typed, r.corrected)})));
    if(dd.per){
      const tb = el('table',{class:'data'});
      tb.append(el('tr',{}, el('th',{},'Gap'), el('th',{},'Your answer'), el('th',{},'Correct')));
      dd.per.forEach((p,j)=> tb.append(el('tr',{}, el('td',{}, j+1),
        el('td',{style:p.ok?'':'color:var(--danger)'}, p.got), el('td',{}, p.want))));
      b.append(tb);
    }
    if(dd.words_per_minute!=null) b.append(el('div',{class:'small muted', style:'margin-top:8px'},
      `${dd.words_per_minute} words per minute · ${Math.round((dd.silence_ratio||0)*100)}% silence` +
      (dd.recogniser_confidence!=null?` · recogniser confidence ${dd.recogniser_confidence}`:'') +
      (dd.recognised_word_overlap?` · word overlap ${dd.recognised_word_overlap}`:'')));
    const rv = reviewBlock(rep.items && rep.items[i], rep.rawAnswers && rep.rawAnswers[i], dd, r);
    if(rv) b.append(el('hr',{class:'hr', style:'margin:14px 0 4px'}), rv);
    if(rep.answers[i] && rep.answers[i].audio){
      const a = el('audio',{controls:'', src:rep.answers[i].audio, style:'width:100%;margin-top:10px'});
      b.append(a);
    }
    d.append(b); pad.append(d);
  });

  pad.append(el('div',{class:'row', style:'margin-top:26px'},
    el('button',{class:'btn btn-primary', onclick:()=>home()},'Back to practice'),
    el('button',{class:'btn', onclick:()=>{
      const blob = new Blob([JSON.stringify(rep,null,2)],{type:'application/json'});
      const a = el('a',{href:URL.createObjectURL(blob), download:`pte-result-${new Date(rep.when).toISOString().slice(0,10)}.json`});
      a.click();
    }},'Download this result')));
  app.innerHTML=''; app.append(el('div',{class:'screen'}, pad));
  window.scrollTo(0,0);
}

/* Per-item review: the question, the response given, the correct answer,
   and how the score was reached. */
function reviewBlock(item, ans, d, r){
  if(!item) return null;
  const box = el('div');
  const sec = (title, ...kids)=>{ box.append(el('div',{class:'rev'}, el('h5',{},title), ...kids)); };

  switch(item.type){
    case 'ro': {
      const order = (d.order && d.order.length) ? d.order : [];
      const links = d.links || [];
      sec('The paragraphs, in the correct order',
        ...item.paras.map((t,i)=> el('div',{class:'para'},
          el('div',{class:'pos'}, i+1), el('div',{}, t))));

      if(order.length){
        const chain = el('div',{class:'chain'});
        order.forEach((p,i)=>{
          chain.append(el('b',{}, p+1));
          if(i<order.length-1) chain.append(el('i',{class:links[i]?'y':'n'}, links[i]?'\u2192':'\u2717'));
        });
        sec('Your sequence, and which joins scored', chain,
          el('div',{class:'small muted'},
            'Each arrow is one point. A tick means those two paragraphs ended up next to each other in the right order; a cross means they did not.'));

        sec('Where you placed them',
          ...order.map((p,i)=>{
            const before = i>0 && links[i-1], after = i<links.length && links[i];
            const cls = (before||after) ? 'para good' : 'para bad';
            return el('div',{class:cls}, el('div',{class:'pos'}, p+1), el('div',{}, item.paras[p]));
          }));
      }
      box.append(el('div',{class:'small muted', style:'margin-top:10px'},
        'How to find the order: the opening paragraph is the only one that makes complete sense on its own \u2014 it introduces its subject by full name and contains no words like this, that, such, the resulting, or he. Every other paragraph will contain a reference back to something. Chain those references and the sequence assembles itself.'));
      break;
    }

    case 'rmcma': case 'lmcma': case 'rmcsa': case 'lmcsa': case 'hcs': case 'smw': {
      const multi = item.type==='rmcma' || item.type==='lmcma';
      const correct = multi ? (item.answers||[]) : [item.answer];
      const picked  = multi ? (ans||[]) : (ans==null?[]:[ans]);
      if(item.q) sec('The question', el('div',{}, item.q));
      const list = el('div',{class:'opts'});
      item.options.forEach((o,i)=>{
        const isC = correct.includes(i), isP = picked.includes(i);
        const cls = isC && isP ? 'optrow both' : isC ? 'optrow correct' : isP ? 'optrow chosen' : 'optrow';
        const mark = isC && isP ? 'You \u2713' : isC ? 'Answer' : isP ? 'You \u2717' : '';
        list.append(el('div',{class:cls}, el('div',{class:'mk'}, mark), el('div',{}, o)));
      });
      sec('The options', list);
      if(multi) box.append(el('div',{class:'small muted'},
        'Every wrong selection cancels a right one, so guessing an extra option costs you the mark you already had.'));
      break;
    }

    case 'hiw': {
      const {display} = hiwWords(item);
      const wrongSet = new Set(Object.keys(item.swaps||{}).map(Number));
      const marked = new Set(ans||[]);
      const map = el('div',{class:'wordmap'});
      display.forEach((w,i)=>{
        const cls = marked.has(i) && wrongSet.has(i) ? 'hit'
                  : marked.has(i) ? 'false'
                  : wrongSet.has(i) ? 'miss' : '';
        map.append(el('w',{class:cls}, w), document.createTextNode(' '));
      });
      sec('The transcript you were shown', map,
        el('div',{class:'legend'},
          el('span',{}, el('em',{style:'background:#d8ecdf'}), 'found correctly'),
          el('span',{}, el('em',{style:'background:#f7dedb'}), 'altered, but you missed it'),
          el('span',{}, el('em',{style:'background:#f5d98e'}), 'you marked it, but it was correct')));
      if((d.misses||[]).length) sec('What the speaker actually said',
        ...d.misses.map(x=> el('div',{class:'small'},
          el('b',{}, x.shown), ' \u2192 ', el('span',{style:'color:var(--ok)'}, x.heard))));
      break;
    }

    case 'rwfib': case 'rfib': case 'lfib': {
      const src = item.text || item.transcript || '';
      const keys = item.type==='rwfib' ? (item.blanks||[]).map(b=>b.options[b.answer])
                 : item.type==='rfib'  ? (item.answers||[])
                 : (src.match(/\[([^\]]+)\]/g)||[]).map(x=>x.slice(1,-1));
      let k=0;
      const filled = src.replace(/___\d+___|\[[^\]]+\]/g, ()=> '\u2039'+(keys[k++]||'?')+'\u203a');
      sec('The passage with the correct words', el('div',{class:'passage', style:'font-size:15px'}, filled));
      break;
    }

    case 'wfd': {
      sec('The sentence', el('div',{class:'passage', style:'font-size:15px'}, item.text));
      if(d.typed!=null) sec('Yours, compared word by word',
        el('div',{html:diffHtml(String(d.typed||''), item.text)}));
      break;
    }

    case 'asq': {
      sec('The question', el('div',{}, item.q));
      sec('Accepted answers', el('div',{}, (item.a||[]).join('  /  ')));
      break;
    }

    case 'ra': case 'rs':
      sec('The text you were given', el('div',{class:'passage', style:'font-size:15px'}, item.text));
      break;

    case 'di':
      if(item.chart && item.chart.summary)
        sec('What a strong answer covers', el('div',{class:'muted'}, item.chart.summary));
      break;

    case 'rl': case 'sgd': case 'rts': case 'sst': case 'swt':
      if(item.key && item.key.length)
        sec('The points a full answer needs', el('ul',{style:'margin:0;padding-left:18px'},
          ...item.key.map(k=> el('li',{class:'muted'}, k))));
      break;

    case 'we':
      sec('The prompt', el('div',{class:'passage', style:'font-size:15px'}, item.prompt));
      break;
  }
  return box.childNodes.length ? box : null;
}

function diffHtml(a,b){ // word-level diff, used to annotate corrections
  const A=a.split(/(\s+)/), B=b.split(/(\s+)/);
  const m=A.length,n=B.length, dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j] = A[i-1]===B[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
  let i=m,j=n,out=[];
  while(i>0&&j>0){
    if(A[i-1]===B[j-1]){ out.unshift(esc(A[i-1])); i--; j--; }
    else if(dp[i-1][j]>=dp[i][j-1]){ out.unshift('<del>'+esc(A[i-1])+'</del>'); i--; }
    else { out.unshift('<ins>'+esc(B[j-1])+'</ins>'); j--; }
  }
  while(i>0){ out.unshift('<del>'+esc(A[--i])+'</del>'); }
  while(j>0){ out.unshift('<ins>'+esc(B[--j])+'</ins>'); }
  return out.join('');
}

