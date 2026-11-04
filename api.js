/* Chamadas ao Supabase (funções SQL expostas via REST). */
(function () {
  'use strict';
  const cfg = window.PESQUISA_CONFIG || {};

  function configurado() {
    return (
      /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1))[^\s/]*/.test(cfg.supabaseUrl || '') &&
      !/SEU-PROJETO/.test(cfg.supabaseUrl) &&
      !!cfg.supabaseKey &&
      !/COLE_AQUI/.test(cfg.supabaseKey)
    );
  }

  async function rpc(nome, args) {
    const headers = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey };
    // Chaves antigas (anon) são JWT e também precisam ir em Authorization.
    // Chaves novas (sb_publishable_...) não são JWT e vão só em apikey.
    if (cfg.supabaseKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + cfg.supabaseKey;

    let resp;
    try {
      resp = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + nome, {
        method: 'POST',
        headers,
        body: JSON.stringify(args),
      });
    } catch (e) {
      throw Object.assign(new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.'), { status: 0 });
    }
    let corpo = null;
    try {
      corpo = await resp.json();
    } catch (_) {
      /* resposta sem corpo */
    }
    if (!resp.ok) {
      throw Object.assign(new Error((corpo && corpo.message) || 'Falha na requisição (' + resp.status + ').'), {
        status: resp.status,
      });
    }
    return corpo;
  }

  window.Api = {
    configurado,
    enviar: (payload) => rpc('enviar_resposta', { p: payload }),
    listar: (chave) => rpc('listar_respostas', { p_chave: chave }),
  };
})();
