
/* ---------- Dashboard de vendas Yampi (compartilhado equipe/atleta) ---------- */
function dashboardVendasHtml(data){
  const esc = (s)=> (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `
  <div class="grid-2">
    <div class="panel" style="text-align:center; background:linear-gradient(135deg, var(--purple), #501142);">
      <div style="font-family:var(--font-display); font-size:34px; color:#fff;">R$ ${data.valorVendido.toFixed(2)}</div>
      <div style="font-size:11px; color:rgba(255,255,255,0.75); font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Você vendeu</div>
    </div>
    <div class="panel" style="text-align:center; background:linear-gradient(135deg, var(--orange), #b5480a);">
      <div style="font-family:var(--font-display); font-size:34px; color:#fff;">R$ ${data.comissaoMes.toFixed(2)}</div>
      <div style="font-size:11px; color:rgba(255,255,255,0.9); font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Você vai receber</div>
    </div>
  </div>
  <div class="panel">
    <h2>Pedidos (${data.numeroPedidos})</h2>
    <table><thead><tr><th>Cliente</th><th>Data</th><th>Nº pedido</th><th style="text-align:right;">Valor</th></tr></thead><tbody>
      ${(data.pedidos||[]).map(p=>`<tr>
        <td>${esc(p.cliente)}</td>
        <td>${p.data.split('-').reverse().join('/')}</td>
        <td>#${p.numero}</td>
        <td style="text-align:right; font-weight:700;">R$ ${Number(p.valor).toFixed(2)}</td>
      </tr>`).join('')}
      ${!(data.pedidos||[]).length ? '<tr><td colspan="4" style="color:var(--muted);">Nenhum pedido neste mês.</td></tr>' : ''}
    </tbody></table>
  </div>`;
}

async function carregarDashboardVendas(cupomCode, ym, descontoCupomPct, comissaoPct, containerId){
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="panel"><div style="color:var(--muted); font-size:12px;"><span class="loader" style="border-top-color:var(--orange); border-color:rgba(0,0,0,0.1);"></span> Carregando pedidos da Yampi...</div></div>`;
  try{
    const { data, error } = await sb.functions.invoke('yampi-sync-atleta', {
      body: { alias: YAMPI_ALIAS, cupomCode, ym, descontoCupomPct: descontoCupomPct||10, comissaoPct: comissaoPct||10 }
    });
    if(error) throw error;
    if(data.error){ container.innerHTML = `<div class="panel"><div style="color:#c0392b; font-size:12.5px;">Erro: ${data.error}</div></div>`; return; }
    container.innerHTML = dashboardVendasHtml(data);
  }catch(err){
    console.error(err);
    container.innerHTML = `<div class="panel"><div style="color:#c0392b; font-size:12.5px;">Falhou: ${err.message||err}</div></div>`;
  }
}
