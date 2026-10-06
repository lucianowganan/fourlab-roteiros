/* ============================================================
   CREATORS-MOTION.JS — movimento das páginas do Programa Creators
   - anéis de luz ao longo da página inteira (flutuando + parallax ao rolar)
   - [data-rev]: aparece ao entrar na tela · .palavras: título sobe palavra por palavra
   - [data-digitar]: os .item de dentro são "escritos" letra a letra
   - luz que segue o mouse · confete (CrMotion.confete())
   Respeita "reduzir movimento" do sistema.
   ============================================================ */
const CrMotion = (function(){
  const calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Títulos palavra por palavra ---------- */
  function quebrarPalavras(el){
    if(el.dataset.quebrado) return; el.dataset.quebrado = '1';
    let i = 0;
    const walk = (node)=>{
      [...node.childNodes].forEach(n=>{
        if(n.nodeType === 3){
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p=>{
            if(!p) return;
            if(/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'pw';
            const s = document.createElement('span'); s.style.setProperty('--i', i++); s.textContent = p;
            w.appendChild(s); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if(n.nodeType === 1 && !n.classList.contains('pw')){
          // elemento inteiro (ex.: a seta) vira uma "palavra"
          if(!n.children.length && n.textContent.trim().length <= 2){
            const w = document.createElement('span'); w.className = 'pw'; n.style.setProperty('--i', i++);
            n.replaceWith(w); w.appendChild(n);
          } else walk(n);
        }
      });
    };
    walk(el);
  }

  /* ---------- Escrever letra a letra ---------- */
  function prepararDigitacao(item){
    const nos = []; const tw = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
    while(tw.nextNode()) nos.push(tw.currentNode);
    const textos = nos.map(n=> n.textContent);
    nos.forEach(n=> n.textContent = '');
    return { nos, textos };
  }
  async function digitar(item, d, velocidade){
    item.classList.add('vivo', 'digitando');
    for(let k = 0; k < d.nos.length; k++){
      const t = d.textos[k];
      for(let c = 1; c <= t.length; c++){ d.nos[k].textContent = t.slice(0, c); if(t[c-1] !== ' ') await esperar(velocidade); }
    }
    item.classList.remove('digitando'); item.classList.add('feito');
  }
  const esperar = (ms)=> new Promise(r=> setTimeout(r, ms));
  async function digitarBloco(bloco){
    const itens = [...bloco.querySelectorAll('.item')];
    if(calmo){ itens.forEach(i=> i.classList.add('vivo','feito')); return; }
    const dados = itens.map(prepararDigitacao);
    await esperar(350);
    for(let i = 0; i < itens.length; i++) await digitar(itens[i], dados[i], 22);
  }

  /* ---------- Aparecer ao rolar ---------- */
  let obs = null;
  function observar(el){
    if(!obs){
      obs = 'IntersectionObserver' in window ? new IntersectionObserver((ents)=> ents.forEach(e=>{
        if(!e.isIntersecting) return;
        e.target.classList.add('in'); obs.unobserve(e.target);
        if(e.target.hasAttribute('data-digitar')) digitarBloco(e.target);
      }), { threshold:0.18, rootMargin:'0px 0px -6% 0px' }) : null;
    }
    if(!obs){ el.classList.add('in'); if(el.hasAttribute('data-digitar')) digitarBloco(el); return; }
    obs.observe(el);
  }
  function revelar(raiz){
    raiz = raiz || document;
    raiz.querySelectorAll('.palavras').forEach(el=>{ quebrarPalavras(el); observar(el); });
    raiz.querySelectorAll('[data-rev]').forEach(observar);
    // blocos que digitam mas não têm data-rev
    raiz.querySelectorAll('[data-digitar]:not([data-rev])').forEach(observar);
  }

  /* ---------- Anéis de luz ao longo da página ---------- */
  let aneis = [];
  function montarAneis(){
    const camada = document.getElementById('aneis'); if(!camada) return;
    const altura = document.documentElement.scrollHeight, larg = innerWidth, passo = larg < 700 ? 560 : 720;
    const n = Math.max(3, Math.ceil(altura / passo));
    if(camada.childElementCount === n) return;
    camada.innerHTML = ''; aneis = [];
    for(let i = 0; i < n; i++){
      const dir = i % 2 === 0;                                   // alterna direita/esquerda, como nos PDFs
      const base = larg < 700 ? 200 : 300, tam = base + ((i * 97) % 170);
      const w = document.createElement('div'); w.className = 'anel-w';
      w.style.width = tam + 'px';
      w.style.top = (60 + i * passo + ((i * 131) % 160)) + 'px';
      w.style[dir ? 'right' : 'left'] = (-tam * (0.42 + ((i * 37) % 20) / 100)) + 'px';
      w.style.opacity = (0.55 + ((i * 53) % 40) / 100).toFixed(2);
      w.innerHTML = `<img src="assets/creators/anel.webp" alt="" style="--dur:${10 + (i * 3) % 7}s; --atraso:-${(i * 2.3).toFixed(1)}s;">`;
      camada.appendChild(w);
      aneis.push({ el:w, fator: 0.06 + ((i * 29) % 10) / 100 });
    }
    parallax();
  }
  function parallax(){
    if(calmo) return;
    const y = scrollY;
    aneis.forEach(a=> a.el.style.transform = `translate3d(0, ${(-y * a.fator).toFixed(1)}px, 0)`);
  }
  let raf = 0;
  addEventListener('scroll', ()=>{ if(!raf) raf = requestAnimationFrame(()=>{ raf = 0; parallax(); }); }, { passive:true });

  /* ---------- Luz que segue o mouse ---------- */
  function luzCursor(){
    const luz = document.getElementById('luzCursor');
    if(!luz || calmo || !matchMedia('(pointer:fine)').matches) return;
    addEventListener('pointermove', (e)=>{ luz.style.opacity = '1'; luz.style.left = e.clientX + 'px'; luz.style.top = e.clientY + 'px'; }, { passive:true });
    document.addEventListener('pointerleave', ()=> luz.style.opacity = '0');
  }

  /* ---------- Confete nas cores da marca ---------- */
  function confete(){
    if(calmo) return;
    const cv = document.createElement('canvas'); cv.className = 'confete'; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const cores = ['#ffa53d','#ff6a4d','#ff3b6b','#e3055f','#ffc53d','#ffffff'];
    // três "canhões": centro e as duas laterais de baixo
    const origens = [ {x:innerWidth/2, y:innerHeight*0.45, vx:0}, {x:0, y:innerHeight*0.85, vx:9}, {x:innerWidth, y:innerHeight*0.85, vx:-9} ];
    const ps = Array.from({length: innerWidth < 700 ? 150 : 240}, (_, k)=>{ const o = origens[k % 3]; return {
      x: o.x + (Math.random() - 0.5) * 60, y: o.y,
      vx: o.vx + (Math.random() - 0.5) * (o.vx ? 8 : 16), vy: -Math.random() * (o.vx ? 19 : 15) - 6, g: 0.32 + Math.random() * 0.12,
      w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35,
      c: cores[(Math.random() * cores.length) | 0] }; });
    const inicio = performance.now();
    (function quadro(t){
      const dt = t - inicio; ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p=>{ p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - dt / 3200); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore(); });
      if(dt < 3300) requestAnimationFrame(quadro); else cv.remove();
    })(inicio);
  }

  function iniciar(){
    revelar(document);
    montarAneis(); luzCursor();
    // a página muda de altura (fontes, formulário → sucesso): refaz os anéis
    if('ResizeObserver' in window) new ResizeObserver(()=> montarAneis()).observe(document.body);
    addEventListener('resize', montarAneis);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  return { revelar, confete, montarAneis };
})();
