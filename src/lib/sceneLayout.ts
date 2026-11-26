/** Same self-contained layout protection in preview, HTML export and server renders. */
export function prepareSceneHtml(html: string, width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("Formato de vídeo inválido.");
  if (html.includes('id="motion-layout-runtime"')) return html;
  const runtime = `<script id="motion-layout-runtime">
(() => {
 const W=${width}, H=${height};
 const body=document.body, original=getComputedStyle(body);
 const layout={display:original.display,flexDirection:original.flexDirection,alignItems:original.alignItems,justifyContent:original.justifyContent,gap:original.gap,gridTemplateColumns:original.gridTemplateColumns};
 let content=document.getElementById('motion-content');
 if(!content){content=document.createElement('div');content.id='motion-content';Object.assign(content.style,layout);
  for(const node of Array.from(body.childNodes)) if(node!==document.currentScript) content.appendChild(node);
  body.appendChild(content);
 }
 const stage=document.createElement('div');stage.id='motion-viewport';body.appendChild(stage);stage.appendChild(content);
 Object.assign(body.style,{margin:'0',padding:'0',width:'100vw',height:'100vh',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',overflow:'hidden',display:'block'});
 Object.assign(document.documentElement.style,{margin:'0',width:'100%',height:'100%',overflow:'hidden'});
 Object.assign(stage.style,{position:'absolute',left:'0',top:'0',width:W+'px',height:H+'px',transformOrigin:'0 0',overflow:'visible'});
 Object.assign(content.style,{position:'absolute',inset:'0',width:W+'px',height:H+'px',maxWidth:'none',maxHeight:'none',minWidth:'0',minHeight:'0',boxSizing:'border-box',transformOrigin:'0 0'});
 const viewport=()=>{const s=Math.min(innerWidth/W,innerHeight/H);stage.style.transform='translate('+((innerWidth-W*s)/2)+'px,'+((innerHeight-H*s)/2)+'px) scale('+s+')';};
 viewport();addEventListener('resize',viewport);
 const texts=()=>Array.from(content.querySelectorAll('*')).filter(el=>!el.closest('svg')&&!['SCRIPT','STYLE','CANVAS'].includes(el.tagName)&&Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent.trim()));
 const fit=()=>{
  viewport();stage.style.transform='none';content.style.transform='none';
  for(const el of texts()){
   el.style.minWidth='0';el.style.overflowWrap='anywhere';el.style.whiteSpace='normal';
   for(let i=0;i<24&&(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1);i++){
    const size=parseFloat(getComputedStyle(el).fontSize);if(!el.clientWidth||!el.clientHeight||size<=12)break;el.style.fontSize=(size*.94)+'px';
   }
  }
  const tl=window.__tl, time=tl?.time(), paused=tl?.paused();
  const duration=tl?.duration()||0;
  let left=0,top=0,right=W,bottom=H, count=0;
  const issues=[];
  const nodes=[...texts(),...content.querySelectorAll('svg,img,[data-motion-essential]')];
  const samples=duration?[.2,.35,.5,.65,.8]:[0];
  for(const fraction of samples){
   if(tl)tl.seek(duration*fraction,true);
   const visibleTexts=texts().filter(el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.5;});
   for(let a=0;a<visibleTexts.length;a++)for(let b=a+1;b<visibleTexts.length;b++){
    const first=visibleTexts[a],second=visibleTexts[b];if(first.contains(second)||second.contains(first))continue;
    const r=first.getBoundingClientRect(),s=second.getBoundingClientRect();
    const overlapW=Math.min(r.right,s.right)-Math.max(r.left,s.left),overlapH=Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top);
    if(overlapW>4&&overlapH>Math.min(r.height,s.height)*.3)issues.push('Blocos de texto sobrepostos: '+first.textContent.slice(0,60)+' / '+second.textContent.slice(0,60));
   }
   for(const el of nodes){
    const style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;
    const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
    // Large decorative SVG backgrounds may intentionally bleed outside the frame.
    if(el.tagName.toLowerCase()==='svg'&&r.width>=W*.9&&r.height>=H*.9&&!el.hasAttribute('data-motion-essential'))continue;
    count++;left=Math.min(left,r.left);top=Math.min(top,r.top);right=Math.max(right,r.right);bottom=Math.max(bottom,r.bottom);
   }
  }
  const margin=Math.min(W,H)*.035;
  const over=left<-.5||top<-.5||right>W+.5||bottom>H+.5;
  const scale=over?Math.min((W-2*margin)/(right-left),(H-2*margin)/(bottom-top)):1;
  const x=over?(W-(right-left)*scale)/2-left*scale:0,y=over?(H-(bottom-top)*scale)/2-top*scale:0;
  content.style.transform='translate('+x+'px,'+y+'px) scale('+scale+')';
  if(tl){tl.seek(time||0,true);tl.paused(paused);}
  viewport();
  if(!count)issues.push('Nenhum conteúdo visível no quadro.');
  if(scale<.55)issues.push('Composição excede muito o formato e fica pequena após ajuste. Refaça o layout no formato solicitado.');
  for(const el of texts())if(el.clientWidth&&el.clientHeight&&(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2))issues.push('Texto não cabe no próprio bloco: '+el.textContent.slice(0,100));
  for(const img of document.images)if(!img.naturalWidth)issues.push('Imagem não carregou; use SVG ou imagem autocontida válida.');
  window.__motionLayout={width:W,height:H,scale,issues:[...new Set(issues)],samples:samples.length};
  return window.__motionLayout;
 };
 window.__motionLayoutReady=(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(img=>img.decode().catch(()=>{})));return fit();})();
})();
</script>`;
  return html.replace(/<\/body\s*>/i, `${runtime}</body>`);
}

export async function validateSceneLayout(html: string, width: number, height: number): Promise<string[]> {
  if (typeof document === "undefined") return ["Validação visual indisponível."];
  if (!/<\/body\s*>/i.test(html) || !/<\/html\s*>/i.test(html)) return ["Documento HTML incompleto."];
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    const id = crypto.randomUUID();
    frame.setAttribute("sandbox", "allow-scripts");
    Object.assign(frame.style, { position: "fixed", left: "-20000px", top: "0", width: `${width}px`, height: `${height}px`, border: "0", pointerEvents: "none" });
    const finish = (issues: string[]) => { clearTimeout(timer); window.removeEventListener("message", receive); frame.remove(); resolve(issues); };
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.data?.id !== id) return;
      finish(Array.isArray(event.data.issues) ? event.data.issues.filter((x: unknown): x is string => typeof x === "string") : ["Validação visual inválida."]);
    };
    const timer = setTimeout(() => finish(["A cena não carregou para validação. Confira sua conexão e tente novamente."]), 20000);
    window.addEventListener("message", receive);
    const report = `<script>addEventListener('load',async()=>{try{const report=await window.__motionLayoutReady;parent.postMessage({id:${JSON.stringify(id)},issues:report?.issues||['Enquadramento não verificado.']},'*')}catch(e){parent.postMessage({id:${JSON.stringify(id)},issues:['Erro ao verificar a cena.']},'*')}})</script>`;
    frame.srcdoc = prepareSceneHtml(html, width, height).replace(/<\/body\s*>/i, `${report}</body>`);
    document.body.appendChild(frame);
  });
}