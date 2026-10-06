# Publicar: Supabase (banco) + Vercel (link) + GitHub (código)

Ordem: **1) GitHub → 2) Supabase → 3) Vercel → 4) conferir**.
Tudo isso é grátis, só com conta. **Nunca** coloque a senha ou o `DATABASE_URL` no código, no GitHub ou em conversas: eles ficam só no `.env` (no seu computador) e nas variáveis de ambiente da Vercel.

## 1. GitHub
```bash
git init -b main
git add .
git commit -m "Pernoite v1.1"
git remote add origin https://github.com/SEU-USUARIO/hotel-araucaria.git
git push -u origin main
```
Antes do `git add`, confira que o arquivo `.env` **não** está na lista (`git status`). O `.gitignore` já o ignora.

## 2. Supabase (banco)
1. Em supabase.com, **New project**. Escolha um nome, uma região próxima (por exemplo São Paulo) e **anote a senha do banco** (ela só aparece ali).
2. Espere o projeto ficar pronto. Vá em **SQL Editor → New query**, cole **todo** o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Confira em **Table Editor**: devem existir as tabelas `hospedes`, `hoteis` (com 4 hotéis), `quartos` (com 34 quartos), `reservas` e `sessoes`.
4. Pegue a string de conexão: **Connect** (ou Project Settings → Database) → **Connection string** → aba **URI** → modo **Transaction pooler** (porta 6543). Troque `[YOUR-PASSWORD]` pela senha do banco.
   - Se a senha tiver caracteres especiais (`@`, `#`, `/`, `:`), eles precisam ser codificados na URL. O mais simples é redefinir uma senha só com letras e números (Project Settings → Database → Reset password).

## 3. Testar no seu computador com o Supabase (opcional, recomendado)
```bash
cp .env.example .env     # abra o .env e cole sua string de conexão
npm install
npm start                # "banco: Supabase (DATABASE_URL)"
```
Sem o `.env`, o sistema roda com um banco em memória (os dados somem ao parar), bom para desenvolver.

## 4. Vercel (link público)
1. Em vercel.com, **Add New → Project** e importe o repositório do GitHub.
2. Antes de clicar em **Deploy**, abra **Environment Variables** e crie:
   - Nome: `DATABASE_URL` · Valor: a string de conexão do passo 2.4.
3. **Deploy**. Ao terminar, a Vercel mostra o link (algo como `https://hotel-araucaria.vercel.app`).
4. Cada `git push` na branch `main` publica uma nova versão sozinho.

## 5. Conferir
- Abra o link, cadastre um hóspede, faça uma reserva e veja a linha aparecer em **Table Editor → reservas** no Supabase.
- Se der erro, veja **Vercel → o deploy → Logs** (aba *Runtime Logs*). Causas comuns:
  - `DATABASE_URL` não definida ou com a senha errada.
  - Esqueceu de rodar o `schema.sql` (erro de tabela inexistente).
  - Usou a conexão direta (porta 5432) em vez do *Transaction pooler* (6543).
  - Depois de mudar uma variável na Vercel, é preciso fazer um novo deploy (**Deployments → ⋯ → Redeploy**).

## Cuidados
- Projetos gratuitos do Supabase podem ser **pausados por inatividade**. Confira de vez em quando e reative no painel se precisar.
- Use só dados fictícios: não há recuperação de senha, e as sessões não expiram.
- O `schema.sql` liga o RLS (segurança por linha) nas tabelas sem criar políticas. Isso impede que a API pública do Supabase leia os dados (inclusive os hashes de senha). O servidor do site acessa o banco pela string de conexão, que não é afetada.
