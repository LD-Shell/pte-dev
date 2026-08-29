/* Test generation.

   Tests are JSON files in tests/, listed in tests/manifest.json. Ten are
   included; further tests are generated on demand and stored locally until
   exported. */
const SHAPE = {
 1:`{"speaking":[{"type":"ra","text":"<55-70 words>"} x6],
"repeat":[{"type":"rs","text":"<8-12 words>"} x10],
"images":[{"type":"di","chart":<CHART>} x3],
"lecture":[{"type":"rl","transcript":"<250-320 words, three clear points>","key":["<4-6 points a strong answer must cover>"]} x2],
"short":[{"type":"asq","q":"<one-sentence general-knowledge question>","a":["<accepted answers>"]} x5],
"discussion":[{"type":"sgd","turns":[{"speaker":"<first name>","text":"<what they say>"} x6-8],"key":["<4-5 points, including who argued what>"]} x2],
"situation":[{"type":"rts","situation":"<2-3 sentences setting up an everyday academic or social situation>","task":"<one sentence telling the candidate who to speak to and about what>","key":["<4-5 things a strong response does>"]} x2],
"swt":[{"type":"swt","passage":"<200-260 words>","key":["<4-5 key points>"]} x2],
"essay":[{"type":"we","prompt":"<arguable prompt ending 'Write 200-300 words.'>"} x1]}
CHART is exactly one of:
{"kind":"bar","title":"","unit":"","xLabel":"","categories":["..."],"series":[{"name":"","values":[<numbers>]}],"summary":"<what a strong spoken answer covers, with the actual figures>"}
{"kind":"line", same fields as bar}
{"kind":"pie","title":"","labels":["..."],"values":[<numbers>],"summary":""}
{"kind":"table","title":"","headers":["..."],"rows":[["..."]],"summary":""}
{"kind":"process","title":"","steps":["<under 40 chars each>"],"summary":""}
{"kind":"map","title":"","legend":"","panels":[{"label":"","features":[{"t":"block|water|park|road","x":0,"y":0,"w":20,"h":20,"name":""}]}],"summary":""}
For map, x/y/w/h are percentages of the panel, 0-100, and must not overlap confusingly.`,
 2:`{"reading":[
{"type":"rwfib","text":"<90-130 words containing ___0___ ___1___ ___2___ ___3___>","blanks":[{"options":["<4 options>"],"answer":<index>}] x4} x5,
{"type":"rmcma","passage":"<150-200 words>","q":"","options":["<5 options>"],"answers":[<2-3 indices>]} x1,
{"type":"ro","paras":["<5 paragraphs IN CORRECT ORDER>"]} x2,
{"type":"rfib","text":"<100-140 words containing ___0___ through ___4___>","bank":["<the 5 answers plus 5 distractors, shuffled>"],"answers":["<5 correct words in gap order>"]} x4,
{"type":"rmcsa","passage":"<150-200 words>","q":"","options":["<4 options>"],"answer":<index>} x2]}`,
 3:`{"listening":[
{"type":"sst","transcript":"<300-380 words>","key":["<4-5 key points>"]} x1,
{"type":"lmcma","transcript":"<130-180 words>","q":"","options":["<5 options>"],"answers":[<2-3 indices>]} x1,
{"type":"lfib","transcript":"<90-130 words with EXACTLY 5 words wrapped in [square brackets]>"} x2,
{"type":"hcs","transcript":"<140-180 words>","options":["<4 summary paragraphs of 35-55 words>"],"answer":<index>} x1,
{"type":"lmcsa","transcript":"<130-180 words>","q":"","options":["<4 options>"],"answer":<index>} x1,
{"type":"smw","transcript":"<80-120 words ending with [BEEP] in place of the final word>","options":["<4 options>"],"answer":<index>} x1,
{"type":"hiw","spoken":"<60-90 words, the TRUE version>","swaps":{"<0-based word index>":"<plausible wrong word>"}} x2 with EXACTLY 5 swaps each,
{"type":"wfd","text":"<10-14 words>"} x3]}`
};
const GEN_SYS = `You write PTE Academic practice material to the 2025 revision of the format.

Rules:
- Original, academically neutral, formal British English at undergraduate lecture register.
- Never repeat a topic within a request. Range widely across sciences, social sciences, history, arts, engineering, environment.
- No politics, religion, named living people, or culturally specific content that would advantage some candidates.
- Distractors must be genuinely plausible and defensible as wrong. Never absurd.
- Every "key" array states what a strong answer must contain; the grader relies on it.
- Return only valid json. No prose, no markdown fences.`;

async function generatePart(no, part, difficulty){
  return API.json({model:S.models.gen, system:GEN_SYS, maxTokens:16000, label:`test ${no} part ${part}`,
    user:`Produce part ${part} of PTE Academic practice test ${no}${difficulty?` at ${difficulty} difficulty`:''}, as json.

Use exactly this shape, honouring the "xN" counts:
${SHAPE[part]}

Return only the json object.`});
}
function validPart(o, part){
  if(!o || typeof o!=='object') return false;
  const need = {1:['speaking','repeat','images','lecture','short','discussion','situation','swt','essay'],
                2:['reading'], 3:['listening']}[part];
  if(!need.every(k=> Array.isArray(o[k]) && o[k].length)) return false;
  const all = need.flatMap(k=>o[k]);
  if(!all.every(i=> i && META[i.type])) return false;
  return all.every(i=>{
    if(i.type==='rwfib') return (i.text.match(/___\d+___/g)||[]).length === (i.blanks||[]).length;
    if(i.type==='rfib')  return (i.text.match(/___\d+___/g)||[]).length === (i.answers||[]).length
                             && i.answers.every(a=> (i.bank||[]).includes(a));
    if(i.type==='lfib')  return (i.transcript.match(/\[[^\]]+\]/g)||[]).length >= 3;
    if(i.type==='hiw')   return Object.keys(i.swaps||{}).every(k=> +k < i.spoken.split(/\s+/).length);
    if(i.type==='smw')   return /\[BEEP\]/.test(i.transcript);
    if(i.type==='sgd')   return Array.isArray(i.turns) && i.turns.length>=4;
    if(i.type==='rts')   return !!(i.situation && i.task);
    return true;
  });
}
async function ensureTest(no){
  if(S.cache[no]) return S.cache[no];
  const ok = await confirmDialog('Generate test '+no+'?',
    `This test is not on disk yet. Generating it takes a minute or two and costs roughly $0.25 with ${S.models.gen}. It is then stored in this browser only \u2014 use Export in Settings if you want to keep the file.`,
    'Generate');
  if(!ok) return null;
  const test = {no, title:'Practice Test '+no, source:'generated', format:'PTE Academic, 2025 revision (22 task types)'};
  for(const part of [1,2,3]){
    screenBusy(`Generating test ${no}`, `Part ${part} of 3 — ${S.models.gen}.`);
    let got=null, err=null;
    for(let a=0;a<2 && !got;a++){
      try{ const r = await generatePart(no, part); if(validPart(r, part)) got = r; }
      catch(e){ err = e; }
    }
    if(!got){ toast(err ? 'Generation failed: '+err.message : `Part ${part} did not validate. Try again.`, 7000); home(); return null; }
    Object.assign(test, got);
  }
  await saveTest(no, test);
  toast(`Test ${no} ready — ${countItems(test)} items.`, 4000);
  return test;
}
