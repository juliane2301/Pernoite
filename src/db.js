// Acesso ao Postgres (Supabase). Todo o resto do sistema usa só esta interface:
//   db.query(sql, params)        → linhas (array)
//   db.transaction(async (q) => …) → executa vários comandos juntos; q(sql, params) → linhas
import pg from 'pg';

export function criarBanco(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    max: 1, // na Vercel cada instância é pequena e de curta duração
    ssl: { rejectUnauthorized: false }, // o Supabase exige conexão segura
  });

  return {
    async query(sql, params = []) {
      const { rows } = await pool.query(sql, params);
      return rows;
    },
    async transaction(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await fn(async (sql, params = []) => (await cliente.query(sql, params)).rows);
        await cliente.query('COMMIT');
        return resultado;
      } catch (erro) {
        await cliente.query('ROLLBACK');
        throw erro;
      } finally {
        cliente.release();
      }
    },
  };
}
