// Postgres em memória (PGlite) para rodar o sistema sem Supabase, em desenvolvimento e nos testes.
// Usa o mesmo supabase/schema.sql, então o comportamento é o do Postgres de verdade.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCHEMA = fileURLToPath(new URL('../supabase/schema.sql', import.meta.url));

export async function criarBancoMemoria() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { btree_gist } = await import('@electric-sql/pglite/contrib/btree_gist');
  const banco = new PGlite({ extensions: { btree_gist } });
  await banco.exec(readFileSync(SCHEMA, 'utf8'));

  return {
    async query(sql, params = []) {
      return (await banco.query(sql, params)).rows;
    },
    async transaction(fn) {
      return banco.transaction((tx) => fn(async (sql, params = []) => (await tx.query(sql, params)).rows));
    },
  };
}
