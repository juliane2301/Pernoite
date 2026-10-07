// Ponto de entrada na Vercel: toda chamada a /api/* cai aqui (ver vercel.json).
import { criarApp } from '../src/app.js';
import { criarBanco } from '../src/db.js';

const url = process.env.DATABASE_URL;

// Sem a variável, responde o motivo em JSON em vez de derrubar a função (FUNCTION_INVOCATION_FAILED).
function semBanco(_req, res) {
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    erro: 'Variável de ambiente DATABASE_URL não definida na Vercel (string de conexão do Supabase).',
  }));
}

export default url ? criarApp({ db: criarBanco(url) }) : semBanco;
