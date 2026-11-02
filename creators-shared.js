/* ============================================================
   CREATORS-SHARED.JS — Programa FourLab Creators
   Etapas, metas semanais, esportes e mensagens padrão.
   Usado por lpcreators.html (público), creators.html (portal do creator)
   e programa-creators.html (equipe). Carregar depois do shared.js.
   ============================================================ */

const MIGRACAO_CREATORS = 'migrations/2026-10-11_creators_1_tabelas.sql até a parte 6';
const SITE_CREATORS = 'https://atleta.fourlabnutrition.com.br';
const LINK_PORTAL_CREATORS = SITE_CREATORS + '/creators';
const LINK_LP_CREATORS = SITE_CREATORS + '/lpcreators';
const DOMINIO_LOGIN_CREATORS = 'creators.fourlabnutri.internal';

const CREATOR_ESPORTES = [
  {id:'mtb', label:'MTB'}, {id:'ciclismo', label:'Ciclismo'}, {id:'corrida', label:'Corrida'},
  {id:'trail', label:'Trail'}, {id:'outro', label:'Outro'},
];
function esportesLabel(c){
  return (c.esportes||[]).map(e=> e==='outro' ? (c.esporte_outro ? c.esporte_outro : 'Outro') : (CREATOR_ESPORTES.find(x=>x.id===e)||{label:e}).label).join(' · ');
}

// Entregas mínimas por semana (iguais aos guias em PDF). A equipe marca semana a semana.
const CREATOR_ETAPAS = {
  contato: { label:'Contato recebido', curto:'Contato', ic:'email', bg:'#efebe6', fg:'var(--ink-2)' },
  etapa1: { label:'Etapa 01 · 30 dias', curto:'Etapa 01', nome:'Experiência', ic:'cadeado', bg:'#fde0ea', fg:'var(--pink)', dias:30, semanas:4,
    guia:'assets/creators/guia-etapa-01.pdf',
    kit:'1x Display Energy Gel + 1x Caixa Na.K+ Hidratação',
    metas:[ {key:'video', label:'Vídeo (TikTok e Instagram)', curto:'Vídeo', qtd:1}, {key:'stories', label:'Stories (TikTok e Instagram)', curto:'Stories', qtd:3} ] },
  etapa2: { label:'Etapa 02 · 60 dias', curto:'Etapa 02', nome:'Evolução', ic:'coracao', bg:'#fdebdc', fg:'var(--orange)', dias:60, semanas:8,
    guia:'assets/creators/guia-etapa-02.pdf',
    kit:'1x Display Energy Gel + 1x Energy Gel Refil 500g + 1x Squeeze FourLab Go + 2x Caixa Na.K+ Hidratação',
    metas:[ {key:'tiktok', label:'Vídeos TikTok (Carrinho Laranja)', curto:'TikTok', qtd:3}, {key:'instagram', label:'Vídeo Instagram', curto:'Instagram', qtd:1}, {key:'stories', label:'Stories (TikTok e Instagram)', curto:'Stories', qtd:3} ] },
  oficial: { label:'Creator Oficial', curto:'Oficial', ic:'raio', bg:'#f1e3f0', fg:'var(--purple)' },
  recusado: { label:'Não aprovado', curto:'Recusado', ic:'x', bg:'#f3eeee', fg:'var(--muted)' },
  encerrado: { label:'Encerrado', curto:'Encerrado', ic:'x', bg:'#f3eeee', fg:'var(--muted)' },
};
const CREATOR_FUNIL = ['contato','etapa1','etapa2','oficial'];
const CREATOR_ENVIO_STATUS = {
  preparando:{label:'Preparando', cor:'#b5680a', fundo:'#fff4c9'},
  enviado:{label:'Enviado', cor:'#1d4ed8', fundo:'#e3ecfd'},
  entregue:{label:'Entregue', cor:'var(--green)', fundo:'var(--green-soft)'},
};

function etapaInfo(id){ return CREATOR_ETAPAS[id] || CREATOR_ETAPAS.contato; }
function primeiroNome(nome){ return String(nome||'').trim().split(/\s+/)[0] || ''; }

// Dia atual da etapa (1..dias) e quantos faltam. null se a etapa não tem prazo.
function progressoEtapa(c){
  const et = etapaInfo(c.etapa);
  if(!et.dias || !c.etapa_inicio) return null;
  const inicio = new Date(c.etapa_inicio + 'T12:00:00');
  const dia = Math.floor((Date.now() - inicio) / 86400000) + 1;
  return { dia: Math.max(1, dia), dias: et.dias, faltam: et.dias - dia, semanaAtual: Math.min(et.semanas, Math.max(1, Math.ceil(dia / 7))),
    fim: new Date(inicio.getTime() + (et.dias - 1) * 86400000).toISOString().slice(0,10), vencida: dia > et.dias };
}
// Semana cumprida = todas as metas com a quantidade mínima
function semanaCumprida(etapaId, feito){
  const et = etapaInfo(etapaId); feito = feito || {};
  return !!et.metas && et.metas.every(m=> (Number(feito[m.key])||0) >= m.qtd);
}
function metasTexto(etapaId){
  const et = etapaInfo(etapaId);
  return (et.metas||[]).map(m=> `• ${m.qtd}x ${m.label} por semana`).join('\n');
}

/* ---------- Mensagens padrão ----------
   O app cadastra estas na tabela creator_mensagens quando faltarem (a equipe edita na aba "Mensagens padrão").
   Ficam aqui e não no SQL porque o SQL Editor do Supabase cortava os textos longos na colagem. */
const MENSAGENS_PADRAO = [
  {"id": "aprovado_etapa1", "titulo": "Aprovado · Etapa 01 (30 dias)", "assunto": "Você foi aprovado no FourLab Creators! 🧡", "corpo": "Oi, {primeiro_nome}! Tudo bem? 🧡\n\nRecebemos seu formulário e ficamos muito felizes em confirmar sua entrada na *Etapa 01 do programa FourLab Creators*!\n\nA partir de agora começa o seu primeiro desafio: *Experimente: 30 dias*.\n\n📘 Seu guia da etapa: {link_guia}\n\n🔐 Seu acesso à Plataforma Creators:\n{link_portal}\nUsuário: {usuario}\nSenha: {senha}\n\nLá você acompanha suas entregas da semana, o envio do seu kit e o calendário de conteúdo.\n\nNos próximos dias enviamos seu kit (Display Energy Gel + Caixa Na.K+ Hidratação). Qualquer dúvida, é só responder por aqui.\n\nBons treinos!\nEquipe de Marketing FourLab", "ordem": 10},
  {"id": "recusado", "titulo": "Inscrição não aprovada", "assunto": "Sua inscrição no FourLab Creators", "corpo": "Oi, {primeiro_nome}! Tudo bem?\n\nMuito obrigado pelo interesse em fazer parte do *FourLab Creators* e pelo tempo dedicado ao formulário. 🧡\n\nAvaliamos seu perfil com carinho e, neste momento, ele não se encaixa no que buscamos para o programa. Isso não é um \"não\" pra sempre: seguimos acompanhando e novas turmas podem abrir.\n\nContinue com a gente nas redes: @fourlabnutri\n\nBons treinos!\nEquipe de Marketing FourLab", "ordem": 20},
  {"id": "kit_enviado", "titulo": "Kit enviado (com rastreio)", "assunto": "Seu kit FourLab está a caminho! 📦", "corpo": "Oi, {primeiro_nome}! 📦\n\nSeu kit FourLab Creators saiu pra entrega!\n\nItens: {itens_envio}\nCódigo de rastreio: {rastreio}\n\nVocê também acompanha o envio na Plataforma Creators: {link_portal}\n\nQuando chegar, já pode começar a criar. Bons treinos!\nEquipe de Marketing FourLab", "ordem": 30},
  {"id": "lembrete_semana", "titulo": "Lembrete das entregas da semana", "assunto": "Suas entregas da semana · FourLab Creators", "corpo": "Oi, {primeiro_nome}! Passando pra lembrar das suas entregas mínimas desta semana no FourLab Creators:\n\n{metas_etapa}\n\nLembre de usar #creatorFourLab e #FourLabNutri e de identificar a parceria. Qualquer dúvida, chama a gente!\n\nEquipe de Marketing FourLab", "ordem": 40},
  {"id": "aprovado_etapa2", "titulo": "Aprovado · Etapa 02 (60 dias)", "assunto": "Parabéns! Você avançou para a Etapa 02 🚀", "corpo": "Parabéns, {primeiro_nome}! 🚀\n\nVocê concluiu a *Etapa 01* e avançou para a *Etapa 02 · Evolução (60 dias)* do FourLab Creators.\n\nO foco agora é *conteúdo + comunidade + resultado*.\n\n📘 Seu guia da etapa: {link_guia}\n\nNesta fase você recebe: Display Energy Gel, Energy Gel Refil 500g, Squeeze FourLab Go, 2 Caixas Na.K+, cupom de 30% para uso pessoal e cupom de 10% para seus seguidores com comissão nas vendas.\n\n👉 Entre na Plataforma Creators e escolha o nome do seu cupom de 10%: {link_portal}\n\nBons treinos!\nEquipe de Marketing FourLab", "ordem": 50},
  {"id": "cupons_criados", "titulo": "Cupons criados (etapa 02)", "assunto": "Seus cupons FourLab estão ativos 🎟️", "corpo": "Oi, {primeiro_nome}! 🎟️\n\nSeus cupons já estão ativos no site fourlabnutri.com.br:\n\n• *{cupom_desconto}* · 10% OFF para seus seguidores (você ganha {comissao_pct}% de comissão nas vendas, paga ao final da etapa)\n• *{cupom_pessoal}* · 30% OFF para seu uso pessoal ({cupom_pessoal_usos} usos)\n\nLembrete: não publique preços, condições ou comissões sem confirmar com o time.\n\nEquipe de Marketing FourLab", "ordem": 60},
  {"id": "nao_avancou", "titulo": "Não avançou de etapa", "assunto": "Resultado da sua etapa no FourLab Creators", "corpo": "Oi, {primeiro_nome}! Tudo bem?\n\nObrigado por ter participado do FourLab Creators e por todo o conteúdo que você criou com a gente. 🧡\n\nDepois da avaliação do período, decidimos não seguir para a próxima etapa neste momento. Seguimos acompanhando seu trabalho e torcendo por você nos treinos e provas!\n\nEquipe de Marketing FourLab", "ordem": 70},
  {"id": "creator_oficial", "titulo": "Virou Creator Oficial", "assunto": "Você agora é um Creator Oficial FourLab! ⚡", "corpo": "{primeiro_nome}, você se tornou um *Creator Oficial FourLab*! ⚡\n\nDepois desses 90 dias, a parceria passa a ser recorrente: campanhas mensais, metas de conteúdo e vendas, bonificações por performance, lançamentos antecipados e recompensas exclusivas.\n\nEm breve você recebe as próximas orientações e seu novo acesso.\n\nBem-vindo ao time!\nEquipe de Marketing FourLab", "ordem": 80},
];

/* ---------- Preenchimento das mensagens ---------- */
// Variáveis aceitas nos modelos: {nome} {primeiro_nome} {usuario} {senha} {link_portal} {link_guia} {link_lp}
// {itens_envio} {rastreio} {cupom_desconto} {cupom_pessoal} {cupom_pessoal_usos} {comissao_pct} {metas_etapa} {etapa}
const VARIAVEIS_MENSAGEM = ['primeiro_nome','nome','usuario','senha','link_portal','link_guia','link_lp','itens_envio','rastreio','cupom_desconto','cupom_pessoal','cupom_pessoal_usos','comissao_pct','metas_etapa','etapa'];
function preencherMensagem(texto, c, extra){
  extra = extra || {};
  const etapaGuia = extra.etapaGuia || (c.etapa === 'etapa2' ? 'etapa2' : 'etapa1');
  const vars = {
    nome: c.nome || '', primeiro_nome: primeiroNome(c.nome), usuario: c.username || extra.usuario || '',
    senha: extra.senha || '{senha}', link_portal: LINK_PORTAL_CREATORS, link_lp: LINK_LP_CREATORS,
    link_guia: SITE_CREATORS + '/' + etapaInfo(etapaGuia).guia,
    itens_envio: extra.itens || '', rastreio: extra.rastreio || '',
    cupom_desconto: c.cupom_desconto || '', cupom_pessoal: c.cupom_pessoal || '',
    cupom_pessoal_usos: c.cupom_pessoal_usos != null ? c.cupom_pessoal_usos : 6, comissao_pct: c.comissao_pct != null ? c.comissao_pct : 10,
    metas_etapa: metasTexto(c.etapa === 'etapa2' ? 'etapa2' : 'etapa1'), etapa: etapaInfo(c.etapa).label,
    ...extra.vars,
  };
  return String(texto||'').replace(/\{(\w+)\}/g, (m, k)=> k in vars ? String(vars[k]) : m);
}
// WhatsApp: número brasileiro sem DDI vira 55 + número
function linkWhatsApp(numero, texto){
  let d = String(numero||'').replace(/\D/g,'');
  if(d && !/^55\d{10,11}$/.test(d)) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto||'')}`;
}
function linkEmail(email, assunto, texto){
  // e-mail não tem negrito do WhatsApp: tira os *asteriscos*
  const corpo = String(texto||'').replace(/\*([^*\n]+)\*/g, '$1');
  return `mailto:${encodeURIComponent(email||'')}?subject=${encodeURIComponent(assunto||'')}&body=${encodeURIComponent(corpo)}`;
}

/* ---------- Calendário do mês (portal do creator e equipe) ----------
   eventos: [{id, data, data_fim, titulo, tipo, cor?}] · ym = 'AAAA-MM'
   Devolve o HTML da grade; cada página estiliza as classes .cal-* do seu jeito.
   Botões: [data-cal-nav="-1|1"] troca o mês · [data-cal-dia="AAAA-MM-DD"] clicou no dia · [data-cal-ev="id"] clicou no evento. */
const CAL_TIPOS = { campanha:{label:'Campanha', cor:'#ff6a4d'}, data:{label:'Data', cor:'#ffb13d'}, prova:{label:'Prova', cor:'#c13cff'}, etapa:{label:'Sua etapa', cor:'#3ddc84'} };
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function addDiasISO(iso, n){ const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }
function eventosDoDia(eventos, iso){ return eventos.filter(e=> e.data <= iso && (e.data_fim || e.data) >= iso); }
function calendarioMesHtml(eventos, ym, opts){
  opts = opts || {};
  const [a, m] = ym.split('-').map(Number), primeiro = new Date(a, m-1, 1, 12);
  const inicio = addDiasISO(`${ym}-01`, -primeiro.getDay());
  const hoje = todayISO();
  let celulas = '';
  for(let i = 0; i < 42; i++){
    const iso = addDiasISO(inicio, i);
    if(i === 35 && iso.slice(0,7) !== ym) break;          // 5 semanas bastam
    const evs = eventosDoDia(eventos, iso);
    celulas += `<div class="cal-day ${iso.slice(0,7)!==ym?'out':''} ${iso===hoje?'hoje':''} ${evs.length?'tem':''}" data-cal-dia="${iso}">
      <span class="cal-n">${Number(iso.slice(8))}</span>
      ${evs.slice(0, opts.max || 3).map(e=>{ const t = CAL_TIPOS[e.tipo] || CAL_TIPOS.data;
        return `<span class="cal-ev" data-cal-ev="${escHtml(e.id||'')}" style="--ev:${e.cor||t.cor};" title="${escHtml(e.titulo)}">${escHtml(e.titulo)}</span>`; }).join('')}
      ${evs.length > (opts.max || 3) ? `<span class="cal-mais">+${evs.length - (opts.max || 3)}</span>` : ''}
    </div>`;
  }
  return `<div class="cal">
    <div class="cal-head"><button class="cal-nav" data-cal-nav="-1" aria-label="Mês anterior">‹</button>
      <div class="cal-mes">${escHtml(fmtMonthLabel(ym))}</div>
      <button class="cal-nav" data-cal-nav="1" aria-label="Próximo mês">›</button></div>
    <div class="cal-grid">${DIAS_SEMANA.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${celulas}</div>
    <div class="cal-leg">${Object.entries(CAL_TIPOS).filter(([k])=> k!=='etapa' || opts.comEtapa).map(([k,t])=>`<span><i style="background:${t.cor}"></i>${t.label}</span>`).join('')}</div>
  </div>`;
}

/* ---------- Ícones desenhados do Programa Creators (no lugar de emojis) ----------
   Traço fino, herdam a cor do texto (currentColor). Uso: ci('caixa') ou ci('caixa', 20). */
const CR_ICONES = {
  guia:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
  caixa:'<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  caminhao:'<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  relogio:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  alerta:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  pin:'<path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9"/>',
  lampada:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  celular:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  parceria:'<path d="m3 12 4-4 5 2 5-2 4 4-7 7z"/><path d="m9 13 3 3"/>',
  email:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  raio:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  cadeado:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  coracao:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  brilho:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  chave:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  seta:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  seta_fora:'<path d="M7 17 17 7M8 7h9v9"/>',
  seta_desce:'<path d="M7 7l10 10M17 8v9H8"/>',
  ferramenta:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  filme:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  imagens:'<rect x="3" y="5" width="15" height="13" rx="2"/><path d="M21 8v12H7"/><path d="m3 15 4-4 4 4 3-3 4 4"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  musica:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  porcento:'<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  play:'<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
};
function ci(nome, tam){
  tam = tam || 16;
  return `<svg class="ci" viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-0.18em; flex:none;">${CR_ICONES[nome] || CR_ICONES.brilho}</svg>`;
}
// ícone de cada tipo de sugestão de conteúdo
const CR_ICONE_SUGESTAO = { reels:'filme', stories:'celular', carrossel:'imagens', post:'camera', tiktok:'musica', outro:'brilho' };
function iconeSugestao(tipo){ return ci(CR_ICONE_SUGESTAO[tipo] || 'brilho'); }
