(function () {
  'use strict';

  const form = document.getElementById('form');
  const aviso = document.getElementById('aviso');
  const botao = document.getElementById('enviar');
  const inicio = Date.now();
  let Q = null;

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  }

  function mostrarAviso(msg) {
    aviso.textContent = msg;
    aviso.hidden = !msg;
  }

  /* ---------- construção das perguntas ---------- */
  function construir(q, i) {
    const card = h('section', { class: 'card pergunta', 'data-qid': q.id });
    card.append(h('h2', {}, h('span', { class: 'num', text: i + 1 + '.' }), ' ' + q.texto));

    if (q.dica) card.append(h('p', { class: 'dica', text: q.dica }));
    if (q.tipo === 'multipla') card.append(h('p', { class: 'dica', text: 'Selecione todas que se aplicam.' }));
    if (q.tipo === 'texto' && !q.obrigatoria) card.append(h('p', { class: 'dica', text: 'Opcional.' }));

    if (q.tipo === 'unica' || q.tipo === 'multipla') {
      const lista = h('div', { class: 'opcoes' });
      q.opcoes.forEach((op, j) => {
        const id = `${q.id}_${j}`;
        const input = h('input', { type: q.tipo === 'unica' ? 'radio' : 'checkbox', name: q.id, id, value: op });
        lista.append(h('label', { class: 'opcao', for: id }, input, h('span', { text: op })));
      });
      card.append(lista);

      if (q.outro) {
        const campo = h('input', {
          type: 'text', class: 'outro', maxlength: 300, hidden: true,
          placeholder: 'Descreva (opcional)', 'aria-label': 'Detalhe de "' + q.outro + '"',
        });
        card.append(campo);
        lista.addEventListener('change', () => {
          const marcada = [...lista.querySelectorAll('input:checked')].some((x) => x.value === q.outro);
          campo.hidden = !marcada;
        });
      }
    } else if (q.tipo === 'nota') {
      const grupo = h('div', { class: 'nota', role: 'radiogroup' });
      for (let n = 1; n <= 5; n++) {
        const id = `${q.id}_${n}`;
        grupo.append(
          h('input', { type: 'radio', name: q.id, id, value: n }),
          h('label', { class: 'estrela', for: id, title: 'Nível ' + n }, '★', h('small', { text: String(n) }))
        );
      }
      grupo.addEventListener('change', () => {
        const sel = Number(grupo.querySelector('input:checked').value);
        grupo.querySelectorAll('.estrela').forEach((l, idx) => l.classList.toggle('on', idx < sel));
      });
      card.append(grupo);
      if (q.legendaMin || q.legendaMax) {
        card.append(h('div', { class: 'legenda-nota' }, h('span', { text: q.legendaMin || '' }), h('span', { text: q.legendaMax || '' })));
      }
    } else if (q.tipo === 'texto') {
      card.append(h('textarea', { name: q.id, rows: 4, maxlength: 2000, 'aria-label': q.texto }));
    }
    return card;
  }

  /* ---------- coleta e validação ---------- */
  function coletar() {
    const respostas = {};
    const outros = {};
    const faltando = [];

    for (const q of Q.perguntas) {
      const card = form.querySelector(`[data-qid="${q.id}"]`);
      let v;
      if (q.tipo === 'unica') {
        const c = card.querySelector('input:checked');
        v = c ? c.value : null;
      } else if (q.tipo === 'multipla') {
        v = [...card.querySelectorAll('input:checked')].map((x) => x.value);
      } else if (q.tipo === 'nota') {
        const c = card.querySelector('input:checked');
        v = c ? Number(c.value) : null;
      } else {
        v = card.querySelector('textarea').value.trim();
      }

      const vazio = v == null || v === '' || (Array.isArray(v) && !v.length);
      const falta = vazio && q.obrigatoria;
      card.classList.toggle('erro', falta);
      if (falta) faltando.push(card);

      respostas[q.id] = vazio ? (q.tipo === 'multipla' ? [] : '') : v;
      if (q.outro && Array.isArray(v) && v.includes(q.outro)) {
        outros[q.id] = card.querySelector('.outro').value.trim();
      }
    }
    return { respostas, outros, faltando };
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarAviso('');

    const { respostas, outros, faltando } = coletar();
    if (faltando.length) {
      mostrarAviso('Responda todas as perguntas obrigatórias (destacadas em vermelho).');
      faltando[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    botao.disabled = true;
    botao.textContent = 'Enviando...';
    try {
      await Api.enviar({
        nome: form.elements.nome.value,
        empresa: form.elements.empresa.value,
        email: form.elements.email.value,
        duracaoSeg: Math.round((Date.now() - inicio) / 1000),
        respostas,
        outros,
      });
      form.hidden = true;
      document.getElementById('obrigado').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      mostrarAviso(e.message);
      botao.disabled = false;
      botao.textContent = 'Enviar respostas';
    }
  });

  /* ---------- início ---------- */
  Q = window.QUESTIONS;
  document.title = Q.titulo;
  document.getElementById('titulo').textContent = Q.titulo;
  document.getElementById('intro').textContent = Q.intro || '';
  const alvo = document.getElementById('perguntas');
  Q.perguntas.forEach((q, i) => alvo.append(construir(q, i)));

  if (!Api.configurado()) {
    mostrarAviso('Banco não configurado: preencha o arquivo config.js (veja o LEIA-ME.md). Os envios só funcionam depois disso.');
  }
})();
