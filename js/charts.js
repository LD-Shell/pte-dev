/* SVG chart rendering for Describe Image. */
const PAL = ['#1f4e79','#a15c07','#1a6b3c','#7a2e6d','#8a6d1f','#31708e'];

/* Rasterise an SVG node through a canvas. Resolves to base64 PNG, or null. */
function svgToPng(svgNode, scale=1.4){
  return new Promise(resolve=>{
    try{
      const clone = svgNode.cloneNode(true);
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
      const vb = (clone.getAttribute('viewBox')||'0 0 760 420').split(/\s+/).map(Number);
      const w = vb[2]||760, h = vb[3]||420;
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      const blob = new Blob([new XMLSerializer().serializeToString(clone)], {type:'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = ()=>{
        try{
          const c = document.createElement('canvas');
          c.width = Math.round(w*scale); c.height = Math.round(h*scale);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,c.width,c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/png').split(',')[1]);
        }catch(e){ URL.revokeObjectURL(url); resolve(null); }
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    }catch(e){ resolve(null); }
  });
}
function renderChart(c){
  const W=760, H=420, box = el('div',{style:'border:1px solid var(--rule);background:#fff;padding:18px'});
  box.append(el('div',{style:'font:600 15px var(--sans);margin-bottom:2px'}, c.title||''));
  if(c.unit) box.append(el('div',{class:'small muted', style:'margin-bottom:10px'}, c.unit));
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`); svg.setAttribute('width','100%');
  svg.setAttribute('role','img'); svg.setAttribute('aria-label', c.title||'chart');
  const ns = 'http://www.w3.org/2000/svg';
  const mk = (t,a={},txt)=>{ const n=document.createElementNS(ns,t); for(const k in a) n.setAttribute(k,a[k]); if(txt!=null) n.textContent=txt; svg.append(n); return n; };
  const L=64,R=W-24,T=26,B=H-64;
  const grid = (max)=>{
    for(let i=0;i<=4;i++){
      const y = B-(B-T)*i/4;
      mk('line',{x1:L,y1:y,x2:R,y2:y,stroke:'#e6e9ed'});
      mk('text',{x:L-9,y:y+4,'text-anchor':'end',fill:'#767d86','font-size':11}, Math.round(max*i/4));
    }
    mk('line',{x1:L,y1:B,x2:R,y2:B,stroke:'#d5d9df'});
  };
  const legend = (series)=>{
    let x=L;
    series.forEach((s,i)=>{
      mk('rect',{x,y:H-26,width:11,height:11,fill:PAL[i%PAL.length]});
      const t = mk('text',{x:x+16,y:H-16,'font-size':12,fill:'#4a5058'}, s.name||('Series '+(i+1)));
      x += 30 + (s.name||'').length*7;
    });
  };
  if(c.kind==='bar'||c.kind==='line'){
    const max = Math.ceil(Math.max(...c.series.flatMap(s=>s.values))*1.15/5)*5 || 10;
    grid(max);
    const n = c.categories.length, step=(R-L)/n;
    c.categories.forEach((cat,i)=> mk('text',{x:L+step*(i+.5),y:B+18,'text-anchor':'middle','font-size':11,fill:'#4a5058'}, cat));
    if(c.kind==='bar'){
      const gw = step*0.7, bw = gw/c.series.length;
      c.series.forEach((s,si)=> s.values.forEach((v,i)=>{
        const h=(B-T)*v/max;
        mk('rect',{x:L+step*i+(step-gw)/2+bw*si, y:B-h, width:bw-2, height:h, fill:PAL[si%PAL.length]});
      }));
    } else {
      c.series.forEach((s,si)=>{
        const pts = s.values.map((v,i)=> `${L+step*(i+.5)},${B-(B-T)*v/max}`).join(' ');
        mk('polyline',{points:pts, fill:'none', stroke:PAL[si%PAL.length], 'stroke-width':2.4});
        s.values.forEach((v,i)=> mk('circle',{cx:L+step*(i+.5), cy:B-(B-T)*v/max, r:3.2, fill:PAL[si%PAL.length]}));
      });
    }
    if(c.xLabel) mk('text',{x:(L+R)/2, y:B+40,'text-anchor':'middle','font-size':11.5,fill:'#767d86'}, c.xLabel);
    if(c.series.length>1) legend(c.series);
  }
  else if(c.kind==='pie'){
    const cx=250, cy=200, r=140, tot=sum(c.values);
    let a=-Math.PI/2;
    c.values.forEach((v,i)=>{
      const sw=2*Math.PI*v/tot, x1=cx+r*Math.cos(a), y1=cy+r*Math.sin(a);
      a+=sw; const x2=cx+r*Math.cos(a), y2=cy+r*Math.sin(a);
      mk('path',{d:`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${sw>Math.PI?1:0} 1 ${x2},${y2} Z`, fill:PAL[i%PAL.length], stroke:'#fff','stroke-width':2});
    });
    c.labels.forEach((lb,i)=>{
      mk('rect',{x:440,y:70+i*30,width:12,height:12,fill:PAL[i%PAL.length]});
      mk('text',{x:460,y:81+i*30,'font-size':13,fill:'#161a1f'}, `${lb} — ${Math.round(100*c.values[i]/tot)}%`);
    });
  }
  else if(c.kind==='map'){
    const pw = c.panels.length>1 ? (W-40)/2 : W-40;
    c.panels.forEach((p,pi)=>{
      const ox = 20 + pi*(pw+8), oy=30, ph=H-90;
      mk('text',{x:ox, y:20,'font-size':12.5,'font-weight':600,fill:'#161a1f'}, p.label);
      mk('rect',{x:ox,y:oy,width:pw,height:ph,fill:'#f7f8fa',stroke:'#d5d9df'});
      const fill = {water:'#c8dcea', park:'#cfe3cd', block:'#dfe3e8', road:'#e9e2d2'};
      p.features.forEach(f=>{
        const x=ox+pw*f.x/100, y=oy+ph*f.y/100, w=pw*f.w/100, h=ph*f.h/100;
        mk('rect',{x,y,width:w,height:h,fill:fill[f.t]||'#dfe3e8',stroke:'#b9c0c8'});
        mk('text',{x:x+w/2,y:y+h/2+4,'text-anchor':'middle','font-size':10.5,fill:'#4a5058'}, f.name);
      });
    });
    if(c.legend) mk('text',{x:20,y:H-14,'font-size':11.5,fill:'#767d86'}, c.legend);
  }
  else if(c.kind==='table'){
    const rows=[c.headers, ...c.rows], cw=(W-48)/c.headers.length;
    rows.forEach((r,ri)=> r.forEach((cell,ci)=>{
      const x=24+ci*cw, y=40+ri*32;
      if(ri===0) mk('rect',{x,y:y-20,width:cw,height:30,fill:'#eef0f3'});
      mk('text',{x:x+8,y,'font-size':12.5,'font-weight':ri===0?600:400,fill:'#161a1f'}, cell);
      mk('line',{x1:24,y1:y+10,x2:W-24,y2:y+10,stroke:'#e6e9ed'});
    }));
  }
  else if(c.kind==='process'){
    const n=c.steps.length, bw=(W-60-(n-1)*34)/n;
    c.steps.forEach((s,i)=>{
      const x=30+i*(bw+34);
      mk('rect',{x,y:150,width:bw,height:110,fill:'#eef3f7',stroke:'#1f4e79'});
      const lines = s.match(/.{1,18}(\s|$)/g)||[s];
      lines.forEach((ln,li)=> mk('text',{x:x+bw/2,y:190+li*16,'text-anchor':'middle','font-size':12,fill:'#161a1f'}, ln.trim()));
      if(i<n-1){ mk('line',{x1:x+bw+6,y1:205,x2:x+bw+28,y2:205,stroke:'#1f4e79','stroke-width':2});
        mk('polygon',{points:`${x+bw+28},205 ${x+bw+20},200 ${x+bw+20},210`,fill:'#1f4e79'}); }
    });
  }
  box.append(svg);
  if(c.source) box.append(el('div',{class:'small muted', style:'margin-top:10px'}, c.source));
  return box;
}

