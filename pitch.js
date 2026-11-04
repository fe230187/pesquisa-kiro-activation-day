/*
 * Pitch de vendas para os AMs (Account Managers), gerado a partir dos números da empresa.
 * Regras fixas, sem IA externa: o texto muda conforme os dados.
 *
 * Depende da ordem das opções em questions.json (índices usados abaixo):
 *   q1: [0]=nunca ouviu falar [1]=ouviu mas nunca usou
 *   q2: [0]=todos os dias [1]=algumas vezes por semana
 *   q3: [3]=testes [5]=documentação [7]=code review
 *   q5: [0]=aumentou significativamente [1]=aumentou um pouco
 *   q6: [8]=Outros [7]=não percebi benefícios
 *   q8: [2]=intervenções manuais [3]=créditos [4]=integração [7]=sem dificuldades
 *   q9: [0]=sim, com certeza [1]=sim, dependendo de créditos
 *   q11: [0..5]=faixas de consumo, [6]=não sei informar
 */
(function () {
  'use strict';

  // Valores de lista em US$/mês por usuário (confirme em kiro.dev/pricing).
  const PLANOS = [
    { nome: 'Free', preco: 0, limite: 50 },
    { nome: 'Pro', preco: 20, limite: 1000 },
    { nome: 'Pro+', preco: 40, limite: 2000 },
    { nome: 'Pro Max', preco: 100, limite: 5000 },
    { nome: 'Power', preco: 200, limite: 10000 },
  ];

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => n.toLocaleString('pt-BR');
  const usd = (n) => 'US$ ' + num(n);
  const nota2 = (n) => n.toFixed(2).replace('.', ',');
  const pl = (n, s, p) => (n === 1 ? s : p);
  const soma = (a) => a.reduce((x, y) => x + y, 0);
  const limpa = (s) => String(s).replace(/\.$/, '');

  function gerar(itens, perguntas, nome) {
    const N = itens.length;
    if (!N) return null;
    const Q = Object.fromEntries(perguntas.map((q) => [q.id, q]));
    const pct = (a, b = N) => (b ? Math.round((a / b) * 100) : 0);
    const un = (id, i) => (Q[id] ? itens.filter((r) => r.respostas[id] === Q[id].opcoes[i]).length : 0);
    const mu = (id, i) => (Q[id] ? itens.filter((r) => (r.respostas[id] || []).includes(Q[id].opcoes[i])).length : 0);
    const ranking = (id, excluir) =>
      Q[id].opcoes
        .map((o, i) => ({ o: limpa(o), c: mu(id, i) }))
        .filter((x) => x.c > 0 && !excluir.includes(x.o))
        .sort((a, b) => b.c - a.c)
        .slice(0, 3);
    const comTexto = (id, re) => itens.filter((r) => re.test(r.respostas[id] || '')).length;
    const lista = (rk) => rk.map((x) => `${x.o} (${pct(x.c)}%)`).join('; ');

    const notas = itens.map((r) => r.respostas.q4).filter(Number.isInteger);
    const nota = notas.length ? soma(notas) / notas.length : null;
    const notaAlta = notas.filter((n) => n >= 4).length;
    const diario = un('q2', 0);
    const impSig = un('q5', 0);
    const impAlgum = impSig + un('q5', 1);
    const contSim = un('q9', 0);
    const contCred = un('q9', 1);
    const novos = un('q1', 0) + un('q1', 1);
    const difCred = mu('q8', 3);
    const difInterv = mu('q8', 2);
    const difInteg = mu('q8', 4);
    const semDif = mu('q8', 7);
    const txtCusto = comTexto('q10', /custo|cr[eé]dit|pre[cç]o|consumo|caro/i);
    const txtAgentes = comTexto('q10', /acompanh|monitor|agentes/i);

    const ganhos = Q.q6 ? ranking('q6', ['Outros', 'Não percebi benefícios significativos']) : [];
    const usos = Q.q3 ? ranking('q3', ['Outras']) : [];

    const blocos = [];

    /* 1. Resumo */
    const resumo = [
      `${nome}: ${N} ${pl(N, 'resposta', 'respostas')}${nota != null ? `, nota média ${nota2(nota)} de 5 (${pct(notaAlta, notas.length)}% deram 4 ou 5)` : ''}.`,
      `${pct(diario)}% usaram o Kiro todos os dias e ${pct(impSig)}% dizem que a produtividade aumentou significativamente.`,
      `${pct(contSim)}% continuariam usando com certeza${contCred ? `, e outros ${pct(contCred)}% continuariam dependendo da disponibilidade de créditos` : ''}.`,
    ];
    if (N < 5) resumo.push('Amostra pequena (menos de 5 respostas): use os números como indício, não como regra.');
    blocos.push({ titulo: 'Resumo para o AM', paragrafo: resumo.join(' ') });

    /* 2. Argumentos de valor */
    const valor = [
      `Adoção: ${diario} de ${N} (${pct(diario)}%) usaram o Kiro todos os dias durante o período de créditos.`,
      `Produtividade: ${pct(impSig)}% relataram aumento significativo e ${pct(impAlgum)}% relataram algum aumento.`,
    ];
    if (ganhos.length) valor.push(`Onde mais ajudou: ${lista(ganhos)}.`);
    if (usos.length) valor.push(`Onde mais foi usado: ${lista(usos)}.`);
    if (novos > 0) {
      valor.push(
        `${pct(novos)}% não conheciam ou nunca tinham usado o Kiro antes da iniciativa, e ${pct(diario)}% da turma passou a usar todos os dias: a curva de aprendizado não travou a adoção.`
      );
    }
    blocos.push({ titulo: 'Argumentos de valor (use os números do cliente)', itens: valor });

    /* 3. Licenças por faixa de consumo */
    if (Q.q11) {
      const faixas = Q.q11.opcoes.map((_, i) => un('q11', i));
      const informados = soma(faixas.slice(0, 6));
      const semInfo = faixas[6];
      const semResposta = N - soma(faixas);
      if (informados > 0) {
        const porPlano = [faixas[0], faixas[1], faixas[2], faixas[3], faixas[4] + faixas[5]];
        const linhas = PLANOS.map((p, i) => [
          p.nome,
          `até ${num(p.limite)}`,
          String(porPlano[i]),
          usd(p.preco),
          usd(p.preco * porPlano[i]),
        ]).filter((_, i) => porPlano[i] > 0);
        const total = soma(PLANOS.map((p, i) => p.preco * porPlano[i]));
        linhas.push(['Total', '', String(informados), '', usd(total)]);

        let acum = 0;
        let cobre80 = null;
        for (let i = 0; i < PLANOS.length; i++) {
          acum += faixas[i];
          if (acum / informados >= 0.8) { cobre80 = PLANOS[i]; break; }
        }
        const pesados = faixas[3] + faixas[4] + faixas[5];
        const notas3 = [
          `${informados} ${pl(informados, 'pessoa informou', 'pessoas informaram')} o consumo mensal. A tabela abaixo enquadra cada pessoa no menor plano que comporta o consumo declarado (valores de lista, por mês).`,
        ];
        if (cobre80) notas3.push(`O plano ${cobre80.nome} (${num(cobre80.limite)} créditos) comporta pelo menos 80% das pessoas que informaram.`);
        else notas3.push('Nenhum plano individual comporta 80% das pessoas: o consumo é alto e merece conversa de volume.');
        if (pesados > 0) notas3.push(`${pesados} ${pl(pesados, 'pessoa consome', 'pessoas consomem')} mais de 2.000 créditos por mês: candidatas a Pro Max ou Power.`);
        if (faixas[5] > 0) notas3.push(`${faixas[5]} ${pl(faixas[5], 'pessoa declarou', 'pessoas declararam')} consumo acima do limite do Power: avaliar créditos adicionais ou condição comercial específica.`);
        if (semInfo > 0) notas3.push(`${semInfo} ${pl(semInfo, 'pessoa não soube', 'pessoas não souberam')} informar o consumo: proponha acompanhar o uso no primeiro mês antes de fechar o plano.`);
        if (semResposta > 0) notas3.push(`${semResposta} ${pl(semResposta, 'resposta é anterior', 'respostas são anteriores')} à pergunta de créditos e ficaram fora desta conta.`);
        blocos.push({
          titulo: 'Dimensionamento de licenças',
          itens: notas3,
          tabela: { cab: ['Plano', 'Créditos/mês', 'Pessoas', 'Lista/pessoa', 'Subtotal/mês'], linhas },
        });
      } else if (semInfo > 0) {
        blocos.push({
          titulo: 'Dimensionamento de licenças',
          paragrafo: `Ninguém soube informar o consumo de créditos. Proponha um piloto de 30 dias acompanhando o uso para dimensionar o plano.`,
        });
      }
    }

    /* 4. Objeções */
    const objecoes = [];
    if (difCred + contCred + txtCusto > 0) {
      const ev = [];
      if (difCred) ev.push(`${difCred} citaram limite ou consumo de créditos como dificuldade`);
      if (contCred) ev.push(`${contCred} só continuariam dependendo de créditos`);
      if (txtCusto) ev.push(`${txtCusto} ${pl(txtCusto, 'comentário cita', 'comentários citam')} custo/créditos`);
      objecoes.push([
        'Custo e créditos',
        ev.join('; ') + '.',
        'Dimensionar por perfil de uso (tabela de licenças) em vez de um plano único para todos, e revisar o consumo após 30 dias.',
      ]);
    }
    if (difInterv > 0) {
      objecoes.push([
        'Muitas correções manuais',
        `${difInterv} ${pl(difInterv, 'pessoa citou', 'pessoas citaram')} intervenções manuais.`,
        'Sessão de boas práticas: dar contexto ao agente com specs e arquivos de steering, e dividir o trabalho em tarefas menores.',
      ]);
    }
    if (difInteg > 0) {
      objecoes.push([
        'Integração com o fluxo de desenvolvimento',
        `${difInteg} ${pl(difInteg, 'pessoa citou', 'pessoas citaram')} integração com ferramentas.`,
        'Mapear com o time técnico as ferramentas do cliente (repositórios, CI/CD, gestão de tarefas) e envolver o Solutions Architect.',
      ]);
    }
    if (txtAgentes > 0) {
      objecoes.push([
        'Acompanhar vários agentes em execução',
        `${txtAgentes} ${pl(txtAgentes, 'comentário pede', 'comentários pedem')} formas melhores de acompanhar agentes.`,
        'Registrar como feedback de produto para o time Kiro/AWS e mostrar como o cliente acompanha as tarefas hoje.',
      ]);
    }
    if (objecoes.length) {
      blocos.push({
        titulo: 'Objeções prováveis e como responder',
        tabela: { cab: ['Objeção', 'Evidência nos dados', 'Como responder'], linhas: objecoes },
      });
    } else {
      blocos.push({
        titulo: 'Objeções prováveis e como responder',
        paragrafo: `Poucas objeções registradas${semDif ? ` (${pct(semDif)}% não encontraram dificuldades relevantes)` : ''}. Foque em expansão de uso e licenças.`,
      });
    }

    /* 5. Próximos passos */
    const passos = [];
    if (Q.q11) {
      const pes = un('q11', 3) + un('q11', 4) + un('q11', 5);
      if (pes > 0) passos.push(`Propor Pro Max ou Power para as ${pes} ${pl(pes, 'pessoa', 'pessoas')} de maior consumo e um plano menor para o restante do time.`);
    }
    if (pct(diario) < 60) passos.push('Rodar um workshop de adoção: menos da maioria usou todos os dias, há espaço para aumentar o uso.');
    if (Q.q3) {
      // usos abaixo de 50% da turma = espaço para mostrar mais valor
      const poucos = [
        ['geração de testes', pct(mu('q3', 3))],
        ['code review', pct(mu('q3', 7))],
        ['documentação técnica', pct(mu('q3', 5))],
      ].filter((x) => x[1] < 50);
      if (poucos.length) {
        passos.push(`Mostrar usos ainda pouco explorados: ${poucos.map((x) => `${x[0]} (${x[1]}% usam)`).join(', ')}.`);
      }
    }
    if (pct(novos) >= 40) passos.push(`Replicar a jornada em outros times: ${pct(novos)}% eram novos na ferramenta e adotaram.`);
    if (nota != null && nota >= 4.5 && N >= 5) passos.push('Pedir um depoimento ou case do cliente: nota média acima de 4,5.');
    passos.push('Agendar uma revisão de consumo e resultados em 30 dias com o líder técnico.');
    blocos.push({ titulo: 'Próximos passos para o AM', itens: passos });

    /* 6. Perguntas */
    const perguntasAbertura = [
      `Quantas pessoas do time usariam o Kiro todo dia? Nos números, ${pct(diario)}% já usaram diariamente.`,
      ganhos.length
        ? `Qual entrega ou prazo vocês querem reduzir? O maior ganho citado foi "${ganhos[0].o.toLowerCase()}".`
        : 'Qual entrega ou prazo vocês querem reduzir com o Kiro?',
      'Quem decide o orçamento de licenças e qual o ciclo de aprovação?',
      'Quais ferramentas do dia a dia precisam conversar com o Kiro?',
    ];
    blocos.push({ titulo: 'Perguntas para abrir a conversa', itens: perguntasAbertura });

    return {
      nome,
      blocos,
      rodape:
        'Base: respostas autodeclaradas da pesquisa. Valores de lista em US$ por pessoa/mês; confirme preços e limites em kiro.dev/pricing antes de propor.',
    };
  }

  function html(p) {
    const corpo = p.blocos
      .map((b) => {
        let h = `<div class="bloco"><h3>${esc(b.titulo)}</h3>`;
        if (b.paragrafo) h += `<p>${esc(b.paragrafo)}</p>`;
        if (b.itens) h += `<ul>${b.itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
        if (b.tabela) {
          h += `<table class="tab"><thead><tr>${b.tabela.cab.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.tabela.linhas
            .map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`;
        }
        return h + '</div>';
      })
      .join('');
    return `<section class="card pitch" id="pitch"><div class="pitch-topo"><h2>Pitch de vendas para os AMs</h2><button type="button" class="sec" id="copiarPitch">Copiar texto</button></div>${corpo}<p class="mut">${esc(p.rodape)}</p></section>`;
  }

  function texto(p) {
    const out = [`PITCH DE VENDAS - ${p.nome}`, ''];
    for (const b of p.blocos) {
      out.push(b.titulo.toUpperCase());
      if (b.paragrafo) out.push(b.paragrafo);
      if (b.itens) b.itens.forEach((i) => out.push('- ' + i));
      if (b.tabela) {
        out.push(b.tabela.cab.join(' | '));
        b.tabela.linhas.forEach((l) => out.push(l.join(' | ')));
      }
      out.push('');
    }
    out.push(p.rodape);
    return out.join('\n');
  }

  window.Pitch = { gerar, html, texto };
})();
