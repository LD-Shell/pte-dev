/* Model provider client.

   Structured responses are requested as tool calls with an input_schema, so the
   reply arrives as a parsed object rather than JSON embedded in prose. */
/* Supported providers. Prices are USD per million tokens, [input, output]. */
const PROVIDERS = {
  anthropic: {
    label:'Anthropic (Claude)',
    models:['claude-sonnet-5','claude-opus-5','claude-haiku-4-5-20251001'],
    defaults:{gen:'claude-sonnet-5', grade:'claude-sonnet-5', coach:'claude-opus-5'},
    price:{'claude-sonnet-5':[3,15], 'claude-opus-5':[5,25], 'claude-haiku-4-5-20251001':[1,5]},
    vision:true,
    console:'console.anthropic.com',
    keyHint:'sk-ant-...',
    endpoint:'https://api.anthropic.com/v1/messages',
    browserSafe:true,
    note:'Dearer, and the only one that can see the Describe Image charts. Supports being called straight from a web page, which is what this hosted version needs.'
  },
  deepseek: {
    label:'DeepSeek',
    models:['deepseek-v4-flash','deepseek-v4-pro'],
    defaults:{gen:'deepseek-v4-flash', grade:'deepseek-v4-flash', coach:'deepseek-v4-pro'},
    price:{'deepseek-v4-flash':[0.14,0.28], 'deepseek-v4-pro':[0.435,0.87]},
    vision:false,
    console:'platform.deepseek.com',
    keyHint:'sk-...',
    endpoint:'https://api.deepseek.com/chat/completions',
    browserSafe:false,
    note:'Roughly twenty times cheaper. It does not document whether browsers may call it directly, so it may or may not work on this hosted page \u2014 press Test connection to find out. If the browser blocks it, use the downloadable version with run.py.'
  }
};
const provider = ()=> PROVIDERS[S.provider] || PROVIDERS.anthropic;

/* Request shapes for OpenAI-compatible providers, ordered strictest first.
   Reasoning models reject a forced tool_choice, so the accepted shape is
   discovered at runtime and cached in S.dsMode. */
const DS_VARIANTS = [
  {id:'forced-nothink', label:'forced tool call, reasoning off',
   apply:(b,n)=>{ b.thinking={type:'disabled'}; b.tool_choice={type:'function', function:{name:n}}; }},
  {id:'forced', label:'forced tool call',
   apply:(b,n)=>{ b.tool_choice={type:'function', function:{name:n}}; }},
  {id:'auto-nothink', label:'tool offered, reasoning off',
   apply:(b,n)=>{ b.thinking={type:'disabled'}; b.tool_choice='auto'; }},
  {id:'auto', label:'tool offered',
   apply:(b,n)=>{ b.tool_choice='auto'; }},
  {id:'json', label:'plain JSON mode, no tools',
   apply:(b,n,tool)=>{
     delete b.tools; delete b.tool_choice; delete b.thinking;
     b.response_format = {type:'json_object'};
     const last = b.messages[b.messages.length-1];
     last.content += `\n\nReply with a single json object matching this schema exactly, and nothing else:\n`
                   + JSON.stringify(tool.input_schema);
   }}
];

const API = {
  lastRaw: null,          // last response, for the debug panel

  async raw(body){
    const pr = provider();
    if(!S.apiKey) throw new Error(`No ${pr.label} API key set. Open Settings to add one.`);
    if(S.spend.lifetime >= S.spend.cap)
      throw new Error(`Spend cap of $${S.spend.cap.toFixed(2)} reached. Raise it in Settings to continue.`);

    // Called directly from the page. Anthropic requires an explicit opt-in header;
    // providers without CORS headers are blocked by the browser.
    const headers = S.provider === 'anthropic'
      ? {'content-type':'application/json',
         'x-api-key': S.apiKey,
         'anthropic-version':'2023-06-01',
         'anthropic-dangerous-direct-browser-access':'true'}
      : {'content-type':'application/json',
         'authorization':'Bearer ' + S.apiKey};

    let res, data;
    try{
      res = await fetch(pr.endpoint, {method:'POST', headers, body: JSON.stringify(body)});
    }catch(e){
      throw new Error(pr.browserSafe
        ? `Could not reach ${pr.label}. Check your internet connection and try again.`
        : `${pr.label} refused the request from this page. It does not allow browsers to call it directly, which this hosted version has no way around. Switch to Anthropic in Settings, or download the offline version and run it with run.py.`);
    }
    try{ data = await res.json(); }
    catch(e){ throw new Error(`${pr.label} returned a reply that was not JSON (HTTP ${res.status}).`); }
    this.lastRaw = data;
    if(!res.ok || data.error){
      const msg = (data.error && (data.error.message || data.error.type)) || `API error ${res.status}.`;
      const hint = {
        401:' Check your key in Settings.',
        400:'',
        403:' This key does not have access to that model.',
        429:' Rate limited — wait a moment and retry.',
        529:' The API is overloaded — retry shortly.'
      }[res.status] || '';
      const err = new Error(msg + hint);
      err.status = res.status;
      err.apiMessage = msg;
      throw err;
    }
    const u = data.usage || {};
    const p = pr.price[body.model] || Object.values(pr.price)[0];
    // Anthropic reports input_tokens; the OpenAI-compatible shape reports prompt_tokens.
    const inTok  = (u.input_tokens||u.prompt_tokens||0)
                 + (u.cache_creation_input_tokens||0) + (u.cache_read_input_tokens||0);
    const outTok = (u.output_tokens||u.completion_tokens||0);
    const cost = (inTok/1e6)*p[0] + (outTok/1e6)*p[1];
    S.spend.session += cost; S.spend.lifetime += cost; saveSettings();
    document.dispatchEvent(new CustomEvent('spend'));
    return data;
  },

  /* Structured call. `tool` is {name, description, input_schema}. Returns the tool
     input object. `content` may be a string or an array of content blocks, so a chart
     image can travel alongside the text where the provider supports it. */
  async structured({model, system, content, tool, maxTokens=8000, label='request'}){
    if(S.provider === 'anthropic'){
      const body = {model, max_tokens:maxTokens,
        messages:[{role:'user', content}],
        tools:[tool],
        tool_choice:{type:'tool', name:tool.name}};
      if(system) body.system = [{type:'text', text:system, cache_control:{type:'ephemeral'}}];
      return this._runAnthropic(body, tool, label);
    }
    return this._runOpenAICompatible({model, system, content, tool, maxTokens, label});
  },

  async _runAnthropic(body, tool, label){
    for(let attempt=0; attempt<2; attempt++){
      const data = await this.raw(body);
      const blocks = data.content || [];
      const call = blocks.find(b=> b.type==='tool_use' && b.name===tool.name);
      if(call && call.input) return call.input;
      const parsed = this.extractJson(blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n'));
      if(parsed) return parsed;
      if(attempt===1) throw this._noResult(data, label, data.stop_reason);
    }
  },

  /* Tries each request shape until one is accepted, then caches it. */
  async _runOpenAICompatible({model, system, content, tool, maxTokens, label}){
    const text = typeof content==='string' ? content
               : content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
    const build = variant => {
      const msgs = [];
      if(system) msgs.push({role:'system', content:system});
      msgs.push({role:'user', content:text});
      const b = {model, max_tokens:maxTokens, stream:false, messages:msgs,
        tools:[{type:'function', function:{name:tool.name, description:tool.description,
                                           parameters:tool.input_schema}}]};
      variant.apply(b, tool.name, tool);
      return b;
    };

    const startAt = Math.max(0, DS_VARIANTS.findIndex(v=>v.id===S.dsMode));
    const order = [...DS_VARIANTS.slice(startAt), ...DS_VARIANTS.slice(0, startAt)];
    let lastErr = null;

    for(const variant of order){
      let data;
      try{
        data = await this.raw(build(variant));
      }catch(e){
        // 400 means the shape was rejected; anything else is not shape-related.
        if(e.status === 400){ lastErr = e; continue; }
        throw e;
      }
      const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
      const call = (msg.tool_calls || []).find(c=> c.function && c.function.name===tool.name);
      // Tool arguments are not guaranteed to be valid JSON.
      let out = call ? this.extractJson(call.function.arguments) : null;
      if(!out) out = this.extractJson(msg.content || msg.reasoning_content || '');
      if(out){
        if(S.dsMode !== variant.id){
          S.dsMode = variant.id;
          this.lastVariant = variant;
          try{ saveSettings(); }catch(e){}
        }
        return out;
      }
      lastErr = this._noResult(data, label,
        (data.choices && data.choices[0] && data.choices[0].finish_reason));
    }
    throw lastErr || new Error(`No usable ${label} from ${provider().label}.`);
  },

  _noResult(data, label, stop){
    const err = new Error(
      `The model did not return a usable ${label} (stop reason: ${stop||'unknown'}).` +
      ((stop==='max_tokens'||stop==='length') ? ' It ran out of output tokens; raise the limit in Settings.' : ''));
    err.raw = data;
    return err;
  },

  /* Plain text call, used only where free prose is genuinely wanted. */
  async text({model, system, content, maxTokens=4000, label='request'}){
    const anthropic = S.provider === 'anthropic';
    let body;
    if(anthropic){
      body = {model, max_tokens:maxTokens, messages:[{role:'user', content}]};
      if(system) body.system = system;
    } else {
      const msgs = []; if(system) msgs.push({role:'system', content:system});
      msgs.push({role:'user', content});
      body = {model, max_tokens:maxTokens, stream:false, messages:msgs};
    }
    const data = await this.raw(body);
    const t = anthropic
      ? (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim()
      : String(((data.choices||[{}])[0].message||{}).content || '').trim();
    if(!t) throw new Error(`The model returned nothing for the ${label}.`);
    return t;
  },

  /* Fallback for responses returned as text rather than a tool call. */
  extractJson(text){
    const s = String(text||'').replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim();
    if(!s) return null;
    try { return JSON.parse(s); } catch(e){}
    for(let i=0;i<s.length;i++){
      const open = s[i];
      if(open!=='{' && open!=='[') continue;
      const close = open==='{' ? '}' : ']';
      let depth=0, inStr=false, esc=false;
      for(let j=i;j<s.length;j++){
        const c = s[j];
        if(inStr){ if(esc) esc=false; else if(c==='\\') esc=true; else if(c==='"') inStr=false; continue; }
        if(c==='"'){ inStr=true; continue; }
        if(c===open) depth++;
        else if(c===close){ depth--;
          if(depth===0){ try { return JSON.parse(s.slice(i,j+1)); } catch(_){ break; } }
        }
      }
    }
    return null;
  },

  /* Speech-to-text against any OpenAI-compatible transcription endpoint.
     Returns '' when not configured. */
  async transcribe(blob, {prompt}={}){
    if(!S.stt.enabled || !S.stt.key) return '';
    if(!blob || blob.size < 2000) return '';
    const fd = new FormData();
    fd.append('file', blob, 'speech.webm');
    fd.append('model', S.stt.model || 'whisper-1');
    fd.append('language', 'en');
    fd.append('response_format', 'json');
    if(prompt) fd.append('prompt', prompt);
    let res;
    try{
      res = await fetch(S.stt.url, {method:'POST',
        headers:{'authorization':'Bearer ' + S.stt.key}, body: fd});
    }catch(e){
      throw new Error('The speech-to-text service refused the request from this page. Many of them do not allow browsers to call them directly; the offline version relays through run.py instead.');
    }
    let data;
    try{ data = await res.json(); }
    catch(e){ throw new Error(`Transcription service returned a non-JSON reply (HTTP ${res.status}).`); }
    if(!res.ok || data.error)
      throw new Error((data.error && (data.error.message||data.error)) || `Transcription error ${res.status}.`);
    return (data.text||'').trim();
  },

  /* Round-trip check used by the Test connection button. */
  async selfTest(){
    const out = await this.structured({
      model: S.models.grade, maxTokens: 400, label:'connection test',
      system: 'You are checking that a tool call round-trips correctly.',
      content: 'Return the word "ready" and the number 7.',
      tool: {name:'report', description:'Report the check result.',
        input_schema:{type:'object', properties:{status:{type:'string'}, number:{type:'integer'}},
                      required:['status','number']}}
    });
    return out;
  }
};
