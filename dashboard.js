(function () {
  'use strict';

  const app = document.getElementById('app');
  const PALETA = ['#ff9900', '#232f3e', '#2563eb', '#0f9d58', '#e11d48', '#7c3aed', '#0891b2', '#a16207', '#64748b'];
  const TODAS = '__todas__';

  const Q = window.QUESTIONS.perguntas;
  let dados = [];
  let autenticado = false;
  let KEY = sessionStorage.getItem('kiroAdminKey') || '';

  /* ---------- utilitários ---------- */
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
  const fmtNota = (n) => n.toFixed(2).replace('.', ',');
  const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const fmtDur = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
  const normalizar = (s) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  /* ---------- agrupamento por empresa ---------- */
  function agrupar(lista) {
    const mapa = new Map();
    for (const r of lista) {
      const k = normalizar(r.empresa);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(r);
    }
    return [...mapa.entries()]
      .map(([chave, itens]) => {
        const freq = {};
        itens.forEach((r) => (freq[r.empresa] = (freq[r.empresa] || 0) + 1));
        const nome = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
        return { chave, nome, itens };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function resumo(itens) {
    const n = itens.length;
    const tempos = itens.map((r) => r.duracaoSeg).filter((x) => x != null);
    const notas = itens.map((r) => r.respostas.q4).filter((x) => Number.isInteger(x));
    const datas = itens.map((r) => new Date(r.criadoEm).getTime());
    const ultima = n ? new Date(Math.max(...datas)).toISOString() : null;
    return {
      n,
      tempoMedio: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null,
      notaMedia: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
      dias: n ? Math.max(1, Math.ceil((Math.max(...datas) - Math.min(...datas)) / 86400000)) : 0,
      ultima,
    };
  }

  /* ---------- componentes visuais ---------- */
  const kpi = (titulo, valor, sub) =>
    `<div class="kpi"><div class="t">${esc(titulo)}</div><div class="v">${esc(valor)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;

  function donut(contagens, total) {
    const R = 48, C = 2 * Math.PI * R;
    let acc = 0;
    const arcos = contagens
      .map((n, i) => {
        if (!n) return '';
        const len = (C * n) / total;
        const seg = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${PALETA[i % PALETA.length]}" stroke-width="20" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" />`;
        acc += len;
        return seg;
      })
      .join('');
    return `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Gráfico de distribuição">
      <g transform="rotate(-90 70 70)"><circle r="${R}" cx="70" cy="70" fill="none" stroke="#eef0f3" stroke-width="20"/>${arcos}</g>
      <text x="70" y="68" font-size="24" font-weight="700" fill="#232f3e">${total}</text>
      <text x="70" y="84" font-size="9" fill="#6b7280">${total === 1 ? 'resposta' : 'respostas'}</text></svg>`;
  }

  function legenda(opcoes, contagens, total) {
    return `<ul class="leg">${opcoes
      .map(
        (o, i) =>
          `<li><i style="background:${PALETA[i % PALETA.length]}"></i><span>${esc(o)}</span><b>${contagens[i]}</b><em>${pct(contagens[i], total)}%</em></li>`
      )
      .join('')}</ul>`;
  }

  function citacoes(itens) {
    if (!itens.length) return '<p class="mut">Nenhum texto informado.</p>';
    const li = itens.map((c) => `<li>${esc(c.texto)}<small>${esc(c.autor)}</small></li>`);
    const topo = li.slice(0, 4).join('');
    const resto = li.slice(4);
    return (
      `<ul class="citacoes">${topo}</ul>` +
      (resto.length
        ? `<details class="mais"><summary>Ver mais ${resto.length}</summary><ul class="citacoes" style="margin-top:8px">${resto.join('')}</ul></details>`
        : '')
    );
  }

  /* ---------- uma questão ---------- */
  function questao(q, i, itens) {
    // Em perguntas de escolha, conta só quem respondeu (respostas antigas podem não ter a pergunta).
    const respondeu = (r) => {
      const v = r.respostas[q.id];
      return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '';
    };
    const n = q.tipo === 'unica' || q.tipo === 'multipla' ? itens.filter(respondeu).length : itens.length;
    let corpo = '';

    if (q.tipo === 'unica') {
      const cont = q.opcoes.map((o) => itens.filter((r) => r.respostas[q.id] === o).length);
      corpo = `<div class="questao"><div>${legenda(q.opcoes, cont, n)}</div><div>${donut(cont, n)}</div></div>`;
    } else if (q.tipo === 'multipla') {
      const cont = q.opcoes.map((o) => itens.filter((r) => (r.respostas[q.id] || []).includes(o)).length);
      corpo =
        `<div class="barras">${q.opcoes
          .map(
            (o, j) =>
              `<div class="linha-barra"><span>${esc(o)}</span><div class="trilho"><span style="width:${pct(cont[j], n)}%;background:${PALETA[j % PALETA.length]}"></span></div><span class="n"><b>${cont[j]}</b> · ${pct(cont[j], n)}%</span></div>`
          )
          .join('')}</div>`;
      if (q.outro) {
        const extras = itens
          .filter((r) => r.outros && r.outros[q.id])
          .map((r) => ({ texto: r.outros[q.id], autor: `${r.nome} · ${r.empresa}` }));
        if (extras.length) corpo += `<div class="sep">Detalhes de “${esc(q.outro)}”</div>${citacoes(extras)}`;
      }
    } else if (q.tipo === 'nota') {
      const notas = itens.map((r) => r.respostas[q.id]).filter((x) => Number.isInteger(x));
      const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
      const niveis = [5, 4, 3, 2, 1].map((nv) => ({ nv, c: notas.filter((x) => x === nv).length }));
      const cheias = Math.round(media);
      const estrelas = [1, 2, 3, 4, 5].map((k) => (k <= cheias ? '★' : `<span class="off">★</span>`)).join('');
      corpo = `<div class="questao"><div class="media-nota"><div class="big">${notas.length ? fmtNota(media) : '—'}</div><div class="est">${estrelas}</div><div class="mut">Classificação média</div></div>
        <div class="barras">${niveis
          .map(
            (x) =>
              `<div class="linha-barra" style="grid-template-columns:60px 1fr 40px"><span>Nível ${x.nv}</span><div class="trilho"><span style="width:${pct(x.c, notas.length)}%;background:var(--orange)"></span></div><span class="n"><b>${x.c}</b></span></div>`
          )
          .join('')}</div></div>`;
    } else if (q.tipo === 'texto') {
      const textos = itens
        .filter((r) => r.respostas[q.id])
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .map((r) => ({ texto: r.respostas[q.id], autor: `${r.nome} · ${fmtData(r.criadoEm)}` }));
      corpo = `<p class="mut">${textos.length} ${textos.length === 1 ? 'resposta' : 'respostas'} (mais recentes primeiro)</p>${citacoes(textos)}`;
    }

    return `<section class="card"><h2><span style="color:var(--orange)">${i + 1}.</span> ${esc(q.texto)}</h2>${corpo}</section>`;
  }

  /* ---------- telas ---------- */
  function telaLogin(msg) {
    app.innerHTML = `<section class="card" style="max-width:420px;margin:40px auto">
      <h2>Acesso ao painel</h2>
      <form id="login"><label class="campo">Chave de administrador
        <input type="password" id="chave" autocomplete="current-password" required></label>
        ${msg ? `<p class="aviso" role="alert">${esc(msg)}</p>` : ''}
        <button type="submit">Entrar</button></form>
      <p class="mut" style="margin-top:12px">Use a chave que você definiu no supabase.sql.</p></section>`;
    document.getElementById('login').addEventListener('submit', (e) => {
      e.preventDefault();
      KEY = document.getElementById('chave').value;
      sessionStorage.setItem('kiroAdminKey', KEY);
      iniciar();
    });
  }

  function telaEmpresas() {
    const grupos = agrupar(dados);
    const geral = resumo(dados);
    const cartao = (href, nome, r, extra) =>
      `<a class="empresa ${extra || ''}" href="${href}" data-nome="${esc(normalizar(nome))}"><h3>${esc(nome)}</h3><dl>
        <dt>Respostas</dt><dd>${r.n}</dd>
        <dt>Nota média</dt><dd>${r.notaMedia == null ? '—' : fmtNota(r.notaMedia)}</dd>
        <dt>Última resposta</dt><dd>${r.ultima ? fmtData(r.ultima) : '—'}</dd></dl></a>`;

    app.innerHTML = `
      <div class="kpis">
        ${kpi('Empresas', grupos.length)}
        ${kpi('Respostas', geral.n)}
        ${kpi('Nota média geral', geral.notaMedia == null ? '—' : fmtNota(geral.notaMedia), 'de 5,00')}
        ${kpi('Tempo médio', fmtDur(geral.tempoMedio), 'min:seg')}
      </div>
      <div class="barra-busca"><input type="text" id="busca" placeholder="Buscar empresa..." aria-label="Buscar empresa"></div>
      ${
        dados.length
          ? `<div class="empresas" id="lista">${cartao('#/empresa/' + TODAS, 'Todas as empresas (consolidado)', geral, 'todas')}${grupos
              .map((g) => cartao('#/empresa/' + encodeURIComponent(g.chave), g.nome, resumo(g.itens)))
              .join('')}</div>`
          : '<div class="card vazio">Ainda não há respostas. Compartilhe o link do formulário para começar.</div>'
      }`;

    const busca = document.getElementById('busca');
    busca.addEventListener('input', () => {
      const t = normalizar(busca.value);
      document.querySelectorAll('#lista a.empresa:not(.todas)').forEach((a) => {
        a.hidden = !a.dataset.nome.includes(t);
      });
    });
  }

  function telaEmpresa(chave) {
    const consolidado = chave === TODAS;
    const grupo = consolidado ? null : agrupar(dados).find((g) => g.chave === chave);
    if (!consolidado && !grupo) {
      location.hash = '#/';
      return;
    }
    const itens = consolidado ? dados : grupo.itens;
    const nome = consolidado ? 'Todas as empresas' : grupo.nome;
    const r = resumo(itens);
    const ordenadas = [...itens].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    const pitch = window.Pitch.gerar(itens, Q, nome);

    app.innerHTML = `
      <a class="voltar" href="#/">← Voltar para as empresas</a>
      <div class="titulo-empresa"><h2>${esc(nome)}</h2><span class="pill">${r.n} ${r.n === 1 ? 'resposta' : 'respostas'}</span></div>
      <div class="kpis">
        ${kpi('Respostas', r.n)}
        ${kpi('Tempo médio', fmtDur(r.tempoMedio), 'min:seg')}
        ${kpi('Período de coleta', r.dias, r.dias === 1 ? 'dia' : 'dias')}
        ${kpi('Nota média', r.notaMedia == null ? '—' : fmtNota(r.notaMedia), 'de 5,00')}
      </div>
      ${Q.map((q, i) => questao(q, i, itens)).join('')}
      ${pitch ? window.Pitch.html(pitch) : ''}
      <section class="card"><h2>Respondentes</h2>
        <table class="tab"><thead><tr><th>Nome</th>${consolidado ? '<th>Empresa</th>' : ''}<th>E-mail</th><th>Nota</th><th>Data</th></tr></thead><tbody>
        ${ordenadas
          .map(
            (x) =>
              `<tr><td>${esc(x.nome)}</td>${consolidado ? `<td>${esc(x.empresa)}</td>` : ''}<td>${esc(x.email)}</td><td>${esc(x.respostas.q4 ?? '—')}</td><td>${fmtData(x.criadoEm)}</td></tr>`
          )
          .join('')}
        </tbody></table></section>`;

    const btn = document.getElementById('copiarPitch');
    if (btn && pitch) {
      btn.addEventListener('click', () => copiar(window.Pitch.texto(pitch), btn));
    }
    window.scrollTo(0, 0);
  }

  async function copiar(texto, btn) {
    const original = btn.textContent;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.append(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (!ok) throw new Error('copy');
      }
      btn.textContent = 'Copiado!';
    } catch (_) {
      btn.textContent = 'Não foi possível copiar';
    }
    setTimeout(() => (btn.textContent = original), 2000);
  }

  function rotear() {
    const m = location.hash.match(/^#\/empresa\/(.+)$/);
    if (m) telaEmpresa(decodeURIComponent(m[1]));
    else telaEmpresas();
  }

  /* ---------- dados ---------- */
  async function buscar() {
    try {
      return await Api.listar(KEY);
    } catch (e) {
      if (e.status === 401) return null;
      throw e;
    }
  }

  async function iniciar() {
    try {
      if (!Api.configurado()) throw new Error('Banco não configurado: preencha o arquivo config.js (veja o LEIA-ME.md).');
      const r = await buscar();
      if (r === null) {
        sessionStorage.removeItem('kiroAdminKey');
        return telaLogin(KEY ? 'Chave inválida.' : '');
      }
      dados = r;
      autenticado = true;
      rotear();
    } catch (e) {
      app.innerHTML = `<div class="card vazio">${esc(e.message)}</div>`;
    }
  }

  async function atualizar() {
    try {
      const r = await buscar();
      if (r && r.length !== dados.length) {
        dados = r;
        rotear();
      }
    } catch (_) {
      /* mantém a tela atual */
    }
  }

  /* ---------- início ---------- */
  const params = new URLSearchParams(location.search);
  if (params.get('key')) {
    KEY = params.get('key');
    sessionStorage.setItem('kiroAdminKey', KEY);
    history.replaceState(null, '', location.pathname + location.hash);
  }

  window.addEventListener('hashchange', () => {
    if (autenticado) rotear();
  });
  document.getElementById('btnAtualizar').addEventListener('click', iniciar);
  setInterval(() => autenticado && atualizar(), 30000);

  if (KEY) iniciar();
  else telaLogin('');
})();
