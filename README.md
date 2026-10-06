# Pernoite · Site de reservas de hotéis

Site de reservas de hotéis: o hóspede se cadastra, escolhe o hotel e as datas, reserva um quarto livre, cancela e faz o check-in.

Site publicado: <https://pernoite-one.vercel.app>

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Servidor | Node.js 22+ e Express 5 |
| Banco de dados | Postgres (Supabase) em produção, PGlite (Postgres em memória) no desenvolvimento |
| Telas | HTML, CSS e JavaScript puros |
| Hospedagem | Vercel |

## Como rodar

**Pré-requisito:** [Node.js](https://nodejs.org) 22 ou mais novo.

```bash
npm install
npm start
```

Abra <http://localhost:3000>.

Sem nenhuma configuração, o sistema sobe com um banco em memória, já com os hotéis e os quartos criados. **Os dados somem quando o servidor para.**

Para usar o Supabase, copie `.env.example` para `.env` e cole a string de conexão em `DATABASE_URL`. O `.env` guarda a senha do banco e nunca deve ir para o GitHub.

## Estrutura do projeto

```
api/index.js          entrada da API na Vercel
docs/                 regras de negócio e passo a passo de publicação
public/               telas, logo e fotos
src/
  app.js              rotas da API
  config.js           parâmetros do sistema
  db.js               conexão com o Postgres (Supabase)
  db-memoria.js       Postgres em memória (desenvolvimento)
  server.js           servidor local
  regras/             validações e cálculos
supabase/schema.sql   tabelas, hotéis e quartos
```

## Documentação

- [docs/regras.md](docs/regras.md): regras de negócio.
- [docs/publicar.md](docs/publicar.md): como publicar (GitHub, Supabase e Vercel).

**Use apenas dados fictícios.**
