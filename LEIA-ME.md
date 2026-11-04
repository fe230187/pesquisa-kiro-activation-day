# Pesquisa Kiro: site estático e gratuito

Duas páginas estáticas, sem servidor próprio:

| Página | Arquivo | Quem usa |
|---|---|---|
| Formulário | `index.html` | Qualquer pessoa com o link |
| Dashboard por empresa | `dashboard.html` | Só quem tem a chave |

As respostas ficam no **Supabase** (plano gratuito). O navegador chama o banco direto, e o acesso às tabelas é bloqueado: só duas funções SQL ficam abertas (enviar uma resposta e listar com chave).

## 1. Criar o banco (5 min)

1. Crie uma conta em https://supabase.com e um projeto novo (plano Free).
2. Abra `supabase.sql` e troque `SUA-CHAVE-DO-DASHBOARD` (só no `INSERT`) por uma senha sua, com **16+ caracteres**. Essa é a chave do dashboard.
3. No Supabase, abra **SQL Editor**, cole o arquivo inteiro e clique em **Run**.

## 2. Ligar o site ao banco

No Supabase, em **Project Settings > API Keys** (ou botão **Connect**), copie:
- **Project URL** (`https://xxxx.supabase.co`)
- **Publishable key** (`sb_publishable_...`)

Cole os dois em `config.js`. Esses valores são públicos por design.

## 3. Publicar (grátis)

Publique **o conteúdo da pasta `pesquisa-web`** (não use o repositório PixelsDungeons).

**Opção A: Netlify (sem git).** Em https://app.netlify.com/drop, arraste a pasta `pesquisa-web`. Ele devolve um link.

**Opção B: GitHub Pages.** Crie um repositório novo e público, envie os arquivos da pasta, e ative em *Settings > Pages > Deploy from a branch > main / root*.

## 4. Os links

- **Formulário (mande para todo mundo):** `https://SEU-SITE/`
- **Dashboard (só para você e seu gestor):** `https://SEU-SITE/dashboard.html?key=SUA_CHAVE`

A chave some da barra de endereço depois que o painel abre. Quem receber o link com a chave vê nomes e e-mails dos respondentes.

## Observações

- No plano gratuito, o Supabase pode pausar o projeto após cerca de uma semana sem uso. Basta reativar no painel. Abra o dashboard antes do evento para conferir.
- Qualquer pessoa com o link do formulário pode enviar respostas (inclusive repetidas). O banco valida nome, empresa e e-mail, mas não impede spam.
- Para mudar as perguntas, edite `questions.js`. O dashboard só contabiliza as opções que existem nessa lista.
- Testar local antes de publicar: `npx serve pesquisa-web` (ou qualquer servidor estático) e abra o endereço que ele mostrar.
