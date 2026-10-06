// Ponto de entrada na Vercel: toda chamada a /api/* cai aqui (ver vercel.json).
import { criarApp } from '../src/app.js';
import { criarBanco } from '../src/db.js';

if (!process.env.DATABASE_URL) {
  throw new Error('Defina a variável de ambiente DATABASE_URL na Vercel (string de conexão do Supabase).');
}

export default criarApp({ db: criarBanco(process.env.DATABASE_URL) });
