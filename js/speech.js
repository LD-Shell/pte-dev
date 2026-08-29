/* Speech synthesis for listening audio, and a single microphone stream shared
   across every speaking item so the permission is requested once per session. */
const Speech = {
  voices:[],
  /* Rank installed voices by likely quality; neural and network voices first. */
  quality(v){
    let q = 0;
    if(/natural|neural|premium|enhanced|siri/i.test(v.name)) q += 100;
    if(/^Google/i.test(v.name)) q += 60;
    if(v.localService === false) q += 30;          // network voice
    if(/^Microsoft/i.test(v.name) && !/desktop/i.test(v.name)) q += 20;
    if(/desktop|compact|espeak|pico/i.test(v.name)) q -= 60;
    if(v.lang === 'en-GB') q += 6;
    return q;
  },
  init(){
    const load = ()=>{
      this.voices = speechSynthesis.getVoices()
        .filter(v=>v.lang && v.lang.startsWith('en'))
        .sort((a,b)=> this.quality(b) - this.quality(a));
    };
    load(); speechSynthesis.onvoiceschanged = load;
  },
  pick(){ return this.voices.find(v=>v.name===S.voice) || this.voices[0] || null; },
  speak(text,{onEnd}={}){
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pick(); if(v){ u.voice=v; u.lang=v.lang; }
    u.rate = S.rate;
    if(onEnd) u.onend = onEnd;
    speechSynthesis.speak(u); return u;
  },
  stop(){ try{ speechSynthesis.cancel(); }catch(e){} }
};

const Mic = {
  stream:null, ac:null, granted:false,
  async get(){
    if(this.stream && this.stream.active) return this.stream;
    this.stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true}});
    this.granted = true;
    if(!this.ac) this.ac = new (window.AudioContext||window.webkitAudioContext)();
    if(this.ac.state==='suspended') await this.ac.resume();
    return this.stream;
  },
  async test(){ try{ await this.get(); return true; }catch(e){ return false; } },
  release(){
    try{ this.stream && this.stream.getTracks().forEach(t=>t.stop()); }catch(e){}
    try{ this.ac && this.ac.close(); }catch(e){}
    this.stream=null; this.ac=null;
  }
};
window.addEventListener('pagehide', ()=> Mic.release());

class Recorder {
  constructor(){ this.chunks=[]; this.transcript=''; this.confs=[]; }
  async start(onLevel, onPartial){
    const stream = await Mic.get();                 // shared — no new permission prompt
    this.mr = new MediaRecorder(stream);
    this.chunks=[]; this.mr.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.mr.start(); this.t0 = performance.now();

    const an = Mic.ac.createAnalyser(); an.fftSize = 512;
    this.src = Mic.ac.createMediaStreamSource(stream); this.src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    this.silence = 0; this.frames = 0;
    const tick = ()=>{
      if(!this.mr || this.mr.state!=='recording') return;
      an.getByteTimeDomainData(buf);
      let peak=0; for(let i=0;i<buf.length;i++) peak = Math.max(peak, Math.abs(buf[i]-128));
      const lvl = peak/128;
      this.frames++; if(lvl < 0.035) this.silence++;
      onLevel && onLevel(lvl);
      this.raf = requestAnimationFrame(tick);
    };
    tick();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(SR){
      this.rec = new SR();
      this.rec.continuous = true; this.rec.interimResults = true; this.rec.lang = 'en-GB';
      this.rec.onresult = e => {
        let interim='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const r = e.results[i];
          if(r.isFinal){ this.transcript += r[0].transcript + ' '; this.confs.push(r[0].confidence||0.8); }
          else interim += r[0].transcript;
        }
        onPartial && onPartial((this.transcript+interim).trim());
      };
      this.rec.onerror = ()=>{};
      try{ this.rec.start(); }catch(e){}
    }
  }
  stop(){
    return new Promise(res=>{
      cancelAnimationFrame(this.raf);
      const done = ()=>{
        const dur = (performance.now()-this.t0)/1000;
        const blob = new Blob(this.chunks,{type:'audio/webm'});
        try{ this.rec && this.rec.stop(); }catch(e){}
        try{ this.src && this.src.disconnect(); }catch(e){}
        // the stream is reused across items and is not stopped here
        res({ blob, url:(()=>{ try{ return URL.createObjectURL(blob); }catch(e){ return null; } })(),
              duration:dur, transcript:this.transcript.trim(),
              confidence: this.confs.length ? this.confs.reduce((a,b)=>a+b,0)/this.confs.length : null,
              silenceRatio: this.frames ? this.silence/this.frames : 0,
              wpm: dur>0 ? words(this.transcript).length/(dur/60) : 0 });
      };
      if(this.mr && this.mr.state==='recording'){ this.mr.onstop = done; this.mr.stop(); }
      else done();
    });
  }
}
