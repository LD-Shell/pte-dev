/* Entry point. */
(async function boot(){
  const isChrome = !!window.chrome && /Chrome|Chromium|Edg/.test(navigator.userAgent);
  if(!isChrome){
    document.body.append(el('div',{class:'blocker'}, el('div',{style:'max-width:460px'},
      el('h2',{style:'margin:0 0 8px;font-size:20px'},'Open this in Google Chrome'),
      el('p',{class:'muted'},'The speaking tasks use Chrome\u2019s microphone recording and speech recognition, and the listening audio uses its speech synthesis.'))));
    return;
  }
  if(location.protocol === 'file:'){
    document.body.append(el('div',{class:'blocker'}, el('div',{style:'max-width:540px'},
      el('h2',{style:'margin:0 0 8px;font-size:20px'},'Open this over http, not from the file system'),
      el('p',{class:'muted'},'Opening the files directly means the tests cannot be loaded and Chrome asks for the microphone on every single item.'),
      el('p',{class:'muted'},'Either visit the GitHub Pages link, or serve the folder locally:'),
      el('pre',{style:'background:var(--surface-2);border:1px solid var(--rule);padding:12px;font-size:13px'},'python3 -m http.server 8000'),
      el('p',{class:'muted'},'then open http://localhost:8000'))));
    return;
  }
  Speech.init();
  await loadState();
  home();
  if(!S.apiKey) setTimeout(()=> toast('All ten tests are ready to sit. Reading and Listening are scored and reviewed with no key at all; add your own key in Settings to have speaking and writing graded too.', 9000), 800);
})();
