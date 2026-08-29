/* Item metadata for the PTE Academic format revised 7 August 2025:
   22 task types across three parts, 52-64 scored items per form.

   sec  working time limit
   prep countdown before recording starts
   rec  recording window
   ai   scored by the model rather than by exact comparison */
const META = {
 ra:  {label:'Read Aloud',                 part:1, skills:['speaking','reading'],   prep:35, rec:40, ai:true},
 rs:  {label:'Repeat Sentence',            part:1, skills:['speaking','listening'], prep:0,  rec:15, ai:true},
 di:  {label:'Describe Image',             part:1, skills:['speaking'],             prep:25, rec:40, ai:true},
 rl:  {label:'Re-tell Lecture',            part:1, skills:['speaking','listening'], prep:10, rec:40, ai:true},
 asq: {label:'Answer Short Question',      part:1, skills:['speaking','listening'], prep:0,  rec:10, ai:true},
 sgd: {label:'Summarize Group Discussion', part:1, skills:['speaking','listening'], prep:10, rec:60, ai:true},
 rts: {label:'Respond to a Situation',     part:1, skills:['speaking','listening'], prep:20, rec:40, ai:true},
 swt: {label:'Summarize Written Text',     part:1, skills:['writing','reading'],  sec:600,  wmin:5,   wmax:75,  ai:true},
 we:  {label:'Write Essay',                part:1, skills:['writing'],            sec:1200, wmin:200, wmax:300, ai:true},
 rwfib:{label:'Fill in the Blanks (Dropdown)', part:2, skills:['reading','writing'], sec:150},
 rmcma:{label:'Multiple Choice, Multiple Answers', part:2, skills:['reading'], sec:180},
 ro:  {label:'Re-order Paragraphs',        part:2, skills:['reading'], sec:180},
 rfib:{label:'Reading: Fill in the Blanks',part:2, skills:['reading'], sec:150},
 rmcsa:{label:'Multiple Choice, Single Answer', part:2, skills:['reading'], sec:150},
 sst: {label:'Summarize Spoken Text',      part:3, skills:['listening','writing'], sec:600, wmin:50, wmax:70, ai:true},
 lmcma:{label:'Multiple Choice, Multiple Answers', part:3, skills:['listening'], sec:150},
 lfib:{label:'Fill in the Blanks',         part:3, skills:['listening'], sec:180, ai:true},
 hcs: {label:'Highlight Correct Summary',  part:3, skills:['listening','reading'], sec:150},
 lmcsa:{label:'Multiple Choice, Single Answer', part:3, skills:['listening'], sec:120},
 smw: {label:'Select Missing Word',        part:3, skills:['listening'], sec:90},
 hiw: {label:'Highlight Incorrect Words',  part:3, skills:['listening','reading'], sec:120},
 wfd: {label:'Write from Dictation',       part:3, skills:['listening','writing'], sec:60, ai:true}
};
const GROUPS = ['speaking','repeat','images','lecture','short','discussion','situation','swt','essay','reading','listening'];
const SECTIONS = [
 {key:'sw',        part:1, name:'Part 1 — Speaking & Writing', groups:['speaking','repeat','images','lecture','short','discussion','situation','swt','essay']},
 {key:'reading',   part:2, name:'Part 2 — Reading',   groups:['reading'],   budget:1800},
 {key:'listening', part:3, name:'Part 3 — Listening', groups:['listening'], budget:2400}
];
const FOCUS = {
 speaking:{name:'Speaking',  groups:['speaking','repeat','images','lecture','short','discussion','situation'], skill:'speaking'},
 writing: {name:'Writing',   groups:['swt','essay','listening','reading'], skill:'writing'},
 reading: {name:'Reading',   groups:['reading'], skill:'reading', budget:1800},
 listening:{name:'Listening',groups:['listening'], skill:'listening', budget:2400}
};
const flatten = t => SECTIONS.flatMap(s=> s.groups.flatMap(g => (t[g]||[]).map(it=>({...it, group:g}))));
const countItems = t => flatten(t).length;
