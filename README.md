# Pernoite · Site de reservas de hotéis

Site de reservas que lista vários hotéis: o hóspede se cadastra, escolhe o destino e o hotel, informa as datas, vê apenas os quartos livres, reserva, cancela e faz o check-in.

> **Versão 1.1:** contém só o sistema. Os testes automatizados (Vitest e Playwright) entram na próxima etapa.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Como rodar](#como-rodar)
- [Configuração](#configuração)
- [Estrutura do projeto](#estrutura-do-projeto)
- [API](#api)
- [Regras de negócio](#regras-de-negócio)
- [Banco de dados](#banco-de-dados)
- [Publicação](#publicação)
- [Fora do escopo](#fora-do-escopo)

## Funcionalidades

- Cadastro e login de hóspedes, com senha guardada em hash.
- Lista de hotéis com foto, cidade, descrição e diária inicial, com filtro por destino.
- Busca de quartos livres do hotel escolhido, por período e número de hóspedes, já com o total calculado.
- Reserva sem risco de dois hóspedes ficarem com o mesmo quarto no mesmo período.
- Desconto de 10% em estadias de 7 noites ou mais.
- Cancelamento (libera o quarto) e check-in (só na data de entrada).
- Cada hóspede vê e altera apenas as próprias reservas.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Servidor | Node.js 22+ e Express 5 |
| Banco de dados | Postgres (Supabase) em produção, PGlite (Postgres em memória) no desenvolvimento |
| Senhas | bcryptjs |
| Telas | HTML, CSS e JavaScript puros |
| Hospedagem | Vercel |

## Como rodar

**Pré-requisito:** [Node.js](https://nodejs.org) 22 ou mais novo.

```bash
npm install
npm start
```

Abra <http://localhost:3000>.

Sem nenhuma configuração, o sistema sobe com um Postgres em memória, já com as tabelas, os 4 hotéis e os 34 quartos criados. É o modo mais prático para desenvolver, mas **os dados somem quando o servidor para**.

O terminal mostra qual banco está em uso:

```
Site em http://localhost:3000 · banco: Postgres em memória (os dados somem ao parar)
```

### Usando o Supabase

Para manter os dados entre uma execução e outra:

1. Crie o projeto no Supabase e rode o `supabase/schema.sql` no SQL Editor (detalhes em [docs/publicar.md](docs/publicar.md)).
2. Copie `.env.example` para `.env`.
3. Cole a string de conexão em `DATABASE_URL`, usando o modo **Transaction pooler** (porta 6543).
4. Rode `npm start`. O terminal deve mostrar `banco: Supabase (DATABASE_URL)`.

O `.env` guarda a senha do banco e já está no `.gitignore`. Ele nunca deve ir para o GitHub.

## Configuração

Todas as variáveis de ambiente são opcionais.

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `DATABASE_URL` | vazio | String de conexão do Postgres. Sem ela, usa o banco em memória. |
| `PORT` | `3000` | Porta do servidor local. |
| `HOST` | `127.0.0.1` | Endereço do servidor local. O padrão aceita só este computador; `0.0.0.0` libera para a rede local. |
| `BCRYPT_ROUNDS` | `10` | Custo do hash das senhas. |

Os parâmetros das regras (nome do site, fuso horário, limites de senha e de noites, desconto) ficam em [src/config.js](src/config.js).

## Estrutura do projeto

```
api/index.js          entrada da API na Vercel
docs/
  regras.md           regras de negócio (RN-01 a RN-12)
  publicar.md         passo a passo de publicação
public/               telas: index.html, estilo.css, app.js
  logo.png            logo do site
  fotos/hoteis/       uma foto por hotel
  fotos/quartos/      uma foto de quarto por hotel, mais suite.jpg
src/
  app.js              rotas da API
  config.js           parâmetros do sistema
  db.js               conexão com o Postgres (Supabase)
  db-memoria.js       Postgres em memória (desenvolvimento e testes)
  server.js           servidor local
  regras/             regras de negócio em funções puras
    datas.js          validação de datas, noites, sobreposição de períodos
    email.js          validação de e-mail
    reservas.js       período, hóspedes, total, check-in, cancelamento
    senha.js          validação de senha
supabase/schema.sql   tabelas, travas do banco, hotéis e quartos
```

As regras ficam separadas das rotas, em funções sem acesso a banco ou rede, para que possam ser testadas isoladamente na próxima etapa.

## API

Todas as rotas recebem e devolvem JSON. Datas usam o formato `AAAA-MM-DD`.

| Método e rota | Login | O que faz |
| --- | :---: | --- |
| `GET /api/site` | | Nome do site e a data de hoje (fuso de Brasília) |
| `GET /api/hoteis` | | Lista os hotéis, com cidade, foto, número de quartos e a menor diária |
| `POST /api/cadastro` | | Cria o hóspede (`nome`, `email`, `senha`) |
| `POST /api/login` | | Devolve o `token` da sessão (`email`, `senha`) |
| `POST /api/logout` | ✔ | Encerra a sessão |
| `GET /api/quartos?hotel=` | | Lista os quartos; `hotel` é opcional |
| `GET /api/quartos/disponiveis?hotel=&checkin=&checkout=&hospedes=` | | Quartos livres no período, com `noites` e `total`; `hotel` é opcional |
| `POST /api/reservas` | ✔ | Cria a reserva (`quartoId`, `checkin`, `checkout`, `hospedes`) |
| `GET /api/reservas` | ✔ | Lista as reservas do hóspede logado |
| `POST /api/reservas/:id/cancelar` | ✔ | Cancela uma reserva ativa |
| `POST /api/reservas/:id/checkin` | ✔ | Faz o check-in (só na data de entrada) |

As rotas com login exigem o cabeçalho `Authorization: Bearer <token>`.

### Erros

Todo erro volta no formato `{ "erro": "mensagem" }`.

| Código | Quando acontece |
| --- | --- |
| `400` | Dado inválido: e-mail, senha, datas, número de hóspedes ou JSON malformado |
| `401` | Sem login, token inválido ou e-mail/senha incorretos |
| `404` | Hotel, quarto ou reserva não encontrados (inclui reservas de outro hóspede) |
| `409` | E-mail já cadastrado, quarto ocupado no período ou reserva em um status que não permite a ação |
| `500` | Erro inesperado no servidor |

### Exemplo

```bash
# Cadastro
curl -X POST http://localhost:3000/api/cadastro \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana Teste","email":"ana@exemplo.com","senha":"senha1234"}'

# Login (devolve o token)
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@exemplo.com","senha":"senha1234"}'

# Reserva de 2 noites no quarto de id 3
curl -X POST http://localhost:3000/api/reservas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"quartoId":3,"checkin":"2026-12-10","checkout":"2026-12-12","hospedes":2}'
```

## Regras de negócio

| Código | Regra |
| --- | --- |
| RN-01 | Senha com 8 a 20 caracteres e pelo menos um número |
| RN-02 | E-mail válido e único, sem diferenciar maiúsculas de minúsculas |
| RN-03 | Estadia de 1 a 30 noites, com check-out depois do check-in |
| RN-04 | Check-in não pode estar no passado (fuso de Brasília) |
| RN-05 | Número de hóspedes inteiro, de 1 até a capacidade do quarto |
| RN-06 | Sem reserva dupla; o dia de saída de uma reserva pode ser o de entrada de outra |
| RN-07 | Total = diária × noites, com 10% de desconto a partir de 7 noites |
| RN-08 | Reserva cancelada libera o quarto |
| RN-09 | Check-in só na data de entrada e só de reserva ativa |
| RN-10 | Cada hóspede só vê e altera as próprias reservas |
| RN-11 | Senha guardada com hash; o login não revela se o e-mail existe |
| RN-12 | O hóspede escolhe o hotel; a busca por hotel lista só os quartos dele |

[docs/regras.md](docs/regras.md) indica em que arquivo cada regra está implementada.

## Banco de dados

Cinco tabelas, definidas em [supabase/schema.sql](supabase/schema.sql): `hospedes`, `hoteis`, `quartos`, `reservas` e `sessoes`. Cada quarto pertence a um hotel.

Uma reserva pode estar em três status: `ativa`, `checkin_feito` ou `cancelada`.

A regra de reserva dupla (RN-06) é garantida em duas camadas. O servidor trava o quarto e confere se há conflito antes de inserir. Além disso, a restrição `reservas_sem_sobreposicao` faz o próprio Postgres recusar dois períodos sobrepostos no mesmo quarto, mesmo que duas pessoas reservem no mesmo instante.

O banco já vem com 4 hotéis fictícios e 34 quartos:

| Hotel | Cidade | Quartos | Diárias |
| --- | --- | :---: | --- |
| Hotel Araucária | Curitiba, PR | 12 | R$ 150 a R$ 600 |
| Pousada Serra Azul | Gramado, RS | 6 | R$ 320 a R$ 650 |
| Hotel Beira-Mar | Florianópolis, SC | 8 | R$ 180 a R$ 520 |
| Hotel Iguaçu Verde | Foz do Iguaçu, PR | 8 | R$ 130 a R$ 400 |

Para incluir ou alterar hotéis e quartos, edite as listas no final do `schema.sql`.

Um banco criado com uma versão anterior, sem a tabela `hoteis` ou sem a coluna `foto`, precisa ser recriado do zero antes de rodar o novo `schema.sql`.

### Fotos

Cada hotel tem na coluna `foto` o nome de um arquivo, por exemplo `araucaria.jpg`. O site procura esse nome em duas pastas:

- `public/fotos/hoteis/` para a foto do cartão do hotel;
- `public/fotos/quartos/` para a foto dos quartos daquele hotel.

Quartos do tipo suíte usam `public/fotos/quartos/suite.jpg`, em qualquer hotel.

Para trocar uma foto, substitua o arquivo mantendo o mesmo nome. Os arquivos precisam ser JPEG de verdade.

## Publicação

O passo a passo completo (GitHub, Supabase e Vercel) está em [docs/publicar.md](docs/publicar.md).

## Fora do escopo

Esta versão não tem pagamento, e-mail de confirmação, recuperação de senha, painel de administrador, expiração de sessões nem limite de tentativas de login.

**Use apenas dados fictícios.**
