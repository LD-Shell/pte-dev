/* Application state. Keys and model choices are stored per provider;
   S.apiKey and S.models are getters onto the active one. */
const S = {
  provider:'anthropic',
  keys:{ anthropic:'', deepseek:'' },
  modelsBy:{
    anthropic:{ gen:'claude-sonnet-5',    grade:'claude-sonnet-5',    coach:'claude-opus-5' },
    deepseek: { gen:'deepseek-v4-flash',  grade:'deepseek-v4-flash',  coach:'deepseek-v4-pro' }
  },
  candidate:'', voice:'', rate:1,
  gradeMode:'assisted',   // 'assisted' | 'full'
  dsMode:'',              // cached OpenAI-compatible request shape
  stt:{ enabled:false, key:'', url:'https://api.openai.com/v1/audio/transcriptions', model:'whisper-1' },
  spend:{ session:0, lifetime:0, cap:15 },
  cache:{}, history:[], run:null, manifest:[]
};
Object.defineProperty(S, 'apiKey', {
  get(){ return S.keys[S.provider] || ''; },
  set(v){ S.keys[S.provider] = v || ''; }
});
Object.defineProperty(S, 'models', {
  get(){ return S.modelsBy[S.provider]; }
});

async function loadState(){
  await Store.init();
  const s = await Store.get('settings');
  if(s){
    if(s.provider && S.modelsBy[s.provider]) S.provider = s.provider;
    // migrate flat settings from earlier versions
    if(s.keys) Object.assign(S.keys, s.keys);
    else if(s.apiKey) S.keys[S.provider] = s.apiKey;
    if(s.modelsBy){
      for(const p in S.modelsBy) Object.assign(S.modelsBy[p], s.modelsBy[p] || {});
    } else if(s.models){
      Object.assign(S.modelsBy[S.provider], s.models);
    }
    S.candidate = s.candidate || '';
    S.voice = s.voice || '';
    S.rate = s.rate || 1;
    S.gradeMode = s.gradeMode || 'assisted';
    S.dsMode = s.dsMode || '';
    Object.assign(S.stt, s.stt || {});
    Object.assign(S.spend, s.spend || {});
  }
  // drop any model no longer offered by its provider
  for(const p in S.modelsBy){
    const list = (PROVIDERS[p] || {}).models || [];
    for(const job of ['gen','grade','coach'])
      if(!list.includes(S.modelsBy[p][job])) S.modelsBy[p][job] = PROVIDERS[p].defaults[job];
  }
  S.history = (await Store.get('history')) || [];
  for(const k of await Store.keys())
    if(typeof k==='string' && k.startsWith('test:')) S.cache[k.slice(5)] = await Store.get(k);
  try{
    const man = await (await fetch('tests/manifest.json')).json();
    S.manifest = man.tests || [];
    for(const entry of S.manifest){
      if(S.cache[entry.no]) continue;
      try{ S.cache[entry.no] = await (await fetch('tests/'+entry.file)).json(); }catch(e){}
    }
  }catch(e){ S.manifest = []; }
}

const saveSettings = ()=> Store.set('settings', {
  provider:S.provider, keys:S.keys, modelsBy:S.modelsBy,
  candidate:S.candidate, voice:S.voice, rate:S.rate,
  gradeMode:S.gradeMode, dsMode:S.dsMode, stt:S.stt, spend:S.spend
});
const saveHistory = ()=> Store.set('history', S.history.slice(-200));
const saveTest    = (no,t)=>{ S.cache[no]=t; return Store.set('test:'+no, t); };
