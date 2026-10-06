/* ============================================================
   CREATORS-SHARED.JS — Programa FourLab Creators
   Etapas, metas semanais, esportes e mensagens padrão.
   Usado por lpcreators.html (público), creators.html (portal do creator)
   e programa-creators.html (equipe). Carregar depois do shared.js.
   ============================================================ */

const MIGRACAO_CREATORS = 'migrations/2026-10-11a_creators_tabelas.sql (e depois as partes b e c)';
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
  contato: { label:'Contato recebido', curto:'Contato', ic:'✉', bg:'#efebe6', fg:'var(--ink-2)' },
  etapa1: { label:'Etapa 01 · 30 dias', curto:'Etapa 01', nome:'Experiência', ic:'🔒', bg:'#fde0ea', fg:'var(--pink)', dias:30, semanas:4,
    guia:'assets/creators/guia-etapa-01.pdf',
    kit:'1x Display Energy Gel + 1x Caixa Na.K+ Hidratação',
    metas:[ {key:'video', label:'Vídeo (TikTok e Instagram)', curto:'Vídeo', qtd:1}, {key:'stories', label:'Stories (TikTok e Instagram)', curto:'Stories', qtd:3} ] },
  etapa2: { label:'Etapa 02 · 60 dias', curto:'Etapa 02', nome:'Evolução', ic:'♥', bg:'#fdebdc', fg:'var(--orange)', dias:60, semanas:8,
    guia:'assets/creators/guia-etapa-02.pdf',
    kit:'1x Display Energy Gel + 1x Energy Gel Refil 500g + 1x Squeeze FourLab Go + 2x Caixa Na.K+ Hidratação',
    metas:[ {key:'tiktok', label:'Vídeos TikTok (Carrinho Laranja)', curto:'TikTok', qtd:3}, {key:'instagram', label:'Vídeo Instagram', curto:'Instagram', qtd:1}, {key:'stories', label:'Stories (TikTok e Instagram)', curto:'Stories', qtd:3} ] },
  oficial: { label:'Creator Oficial', curto:'Oficial', ic:'⚡', bg:'#f1e3f0', fg:'var(--purple)' },
  recusado: { label:'Não aprovado', curto:'Recusado', ic:'✕', bg:'#f3eeee', fg:'var(--muted)' },
  encerrado: { label:'Encerrado', curto:'Encerrado', ic:'■', bg:'#f3eeee', fg:'var(--muted)' },
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
    senha: extra.senha || '(a mesma que você já usa)', link_portal: LINK_PORTAL_CREATORS, link_lp: LINK_LP_CREATORS,
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
