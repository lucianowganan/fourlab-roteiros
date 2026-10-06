/* ============================================================
   CREATORS-SHARED.JS — Programa FourLab Creators
   Etapas, metas semanais, esportes e mensagens padrão.
   Usado por lpcreators.html (público), creators.html (portal do creator)
   e programa-creators.html (equipe). Carregar depois do shared.js.
   ============================================================ */

const MIGRACAO_CREATORS = 'migrations/2026-10-11_programa_creators.sql';
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

/* ---------- Mensagens padrão ---------- */
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
