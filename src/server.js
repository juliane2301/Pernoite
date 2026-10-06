// Servidor local. Com DATABASE_URL usa o Supabase; sem ela usa um Postgres em memória.
import { criarApp } from './app.js';
import { criarBanco } from './db.js';
import { criarBancoMemoria } from './db-memoria.js';

const porta = Number(process.env.PORT) || 3000;
// Só este computador acessa. Para liberar na rede local (ex.: testar no celular), use HOST=0.0.0.0.
const host = process.env.HOST || '127.0.0.1';
const rodadasHash = Number(process.env.BCRYPT_ROUNDS) || 10;
const url = process.env.DATABASE_URL;

const db = url ? criarBanco(url) : await criarBancoMemoria();
const origem = url ? 'Supabase (DATABASE_URL)' : 'Postgres em memória (os dados somem ao parar)';

criarApp({ db, rodadasHash }).listen(porta, host, () => {
  console.log(`Site em http://localhost:${porta} · banco: ${origem}`);
});
