import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NOME_SITE } from './config.js';
import { validarSenha, MENSAGEM_SENHA } from './regras/senha.js';
import { validarEmail } from './regras/email.js';
import { hoje } from './regras/datas.js';
import {
  validarPeriodo, validarHospedes, calcularTotal, podeFazerCheckin, podeCancelar,
} from './regras/reservas.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Reservas que ocupam o quarto (canceladas liberam o quarto).
const OCUPAM = "('ativa', 'checkin_feito')";

// Códigos de erro do Postgres
const VIOLACAO_UNICA = '23505';
const VIOLACAO_EXCLUSAO = '23P01'; // dois períodos sobrepostos no mesmo quarto

// Datas e valores voltam como texto/número simples (e não como objetos Date ou strings numéricas).
const SELECIONAR_RESERVA = `
  SELECT r.id, r.checkin::text AS checkin, r.checkout::text AS checkout, r.hospedes,
         r.total::float8 AS total, r.status, q.numero AS quarto, q.tipo,
         h.nome AS hotel, h.cidade
  FROM reservas r JOIN quartos q ON q.id = r.quarto_id JOIN hoteis h ON h.id = q.hotel_id
`;

const SELECIONAR_QUARTO = `
  SELECT q.id, q.numero, q.tipo, q.capacidade, q.diaria::float8 AS diaria,
         h.id AS "hotelId", h.nome AS hotel
  FROM quartos q JOIN hoteis h ON h.id = q.hotel_id
`;

const NAO_ENCONTRADA = { ok: false };

export function criarApp({ db, agora = () => new Date(), rodadasHash = 10 } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Cabeçalhos de segurança: só carrega recursos do próprio site e não pode ser embutido em outro.
  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });
  app.use(express.json());
  app.use(express.static(PUBLIC));

  const erro = (res, status, mensagem) => res.status(status).json({ erro: mensagem });
  const comoInteiro = (valor) => (/^\d+$/.test(String(valor)) ? Number(valor) : null);

  async function autenticar(req, res, next) {
    const cabecalho = req.get('Authorization') ?? '';
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
    const [sessao] = token
      ? await db.query(
        `SELECT h.id, h.nome, h.email FROM sessoes s
         JOIN hospedes h ON h.id = s.hospede_id WHERE s.token = $1`,
        [token],
      )
      : [];
    if (!sessao) return erro(res, 401, 'Faça login para continuar.');
    req.hospede = sessao;
    next();
  }

  app.get('/api/site', (_req, res) => res.json({ nome: NOME_SITE, hoje: hoje(agora()) }));

  // ---------- Cadastro e login ----------
  app.post('/api/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body ?? {};
    if (typeof nome !== 'string' || nome.trim() === '') return erro(res, 400, 'Informe o nome.');
    if (!validarEmail(email)) return erro(res, 400, 'E-mail inválido.');
    if (!validarSenha(senha)) return erro(res, 400, MENSAGEM_SENHA);
    const chave = email.trim().toLowerCase();
    const hash = bcrypt.hashSync(senha, rodadasHash);
    try {
      const [novo] = await db.query(
        'INSERT INTO hospedes (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id',
        [nome.trim(), chave, hash],
      );
      res.status(201).json({ id: novo.id, nome: nome.trim(), email: chave });
    } catch (e) {
      if (e.code === VIOLACAO_UNICA) return erro(res, 409, 'E-mail já cadastrado.');
      throw e;
    }
  });

  app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body ?? {};
    const [hospede] = typeof email === 'string'
      ? await db.query('SELECT * FROM hospedes WHERE email = $1', [email.trim().toLowerCase()])
      : [];
    // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
    if (!hospede || typeof senha !== 'string' || !bcrypt.compareSync(senha, hospede.senha_hash)) {
      return erro(res, 401, 'E-mail ou senha incorretos.');
    }
    const token = randomBytes(24).toString('hex');
    await db.query('INSERT INTO sessoes (token, hospede_id) VALUES ($1, $2)', [token, hospede.id]);
    res.json({ token, nome: hospede.nome });
  });

  app.post('/api/logout', autenticar, async (req, res) => {
    await db.query('DELETE FROM sessoes WHERE token = $1', [req.get('Authorization').slice(7)]);
    res.status(204).end();
  });

  // ---------- Hotéis ----------
  app.get('/api/hoteis', async (_req, res) => {
    res.json(await db.query(
      `SELECT h.id, h.nome, h.cidade, h.estado, h.descricao, h.foto,
              COUNT(q.id)::int AS quartos, MIN(q.diaria)::float8 AS "diariaMinima"
       FROM hoteis h LEFT JOIN quartos q ON q.hotel_id = h.id
       GROUP BY h.id ORDER BY h.cidade, h.nome`,
    ));
  });

  // Filtro opcional ?hotel=ID nas rotas de quartos. Sem ele, vale para todos os hotéis (id null).
  async function hotelDaConsulta(req) {
    if (req.query.hotel === undefined) return { ok: true, id: null };
    const id = comoInteiro(req.query.hotel);
    const [hotel] = id === null ? [] : await db.query('SELECT id FROM hoteis WHERE id = $1', [id]);
    return hotel ? { ok: true, id } : { ok: false };
  }

  // ---------- Quartos ----------
  app.get('/api/quartos', async (req, res) => {
    const hotel = await hotelDaConsulta(req);
    if (!hotel.ok) return erro(res, 404, 'Hotel não encontrado.');
    res.json(await db.query(
      `${SELECIONAR_QUARTO} WHERE ($1::int IS NULL OR q.hotel_id = $1) ORDER BY h.nome, q.numero`,
      [hotel.id],
    ));
  });

  app.get('/api/quartos/disponiveis', async (req, res) => {
    const { checkin, checkout } = req.query;
    const hospedes = Number(req.query.hospedes);
    const periodo = validarPeriodo(checkin, checkout, hoje(agora()));
    if (!periodo.ok) return erro(res, 400, periodo.erro);
    const qtd = validarHospedes(hospedes, 4);
    if (!qtd.ok) return erro(res, 400, qtd.erro);
    const hotel = await hotelDaConsulta(req);
    if (!hotel.ok) return erro(res, 404, 'Hotel não encontrado.');

    const livres = await db.query(
      `${SELECIONAR_QUARTO}
       WHERE q.capacidade >= $1
         AND ($4::int IS NULL OR q.hotel_id = $4)
         AND NOT EXISTS (
           SELECT 1 FROM reservas r
           WHERE r.quarto_id = q.id AND r.status IN ${OCUPAM}
             AND r.checkin < $2::date AND $3::date < r.checkout
         )
       ORDER BY q.diaria, h.nome, q.numero`,
      [hospedes, checkout, checkin, hotel.id],
    );
    res.json(livres.map((q) => ({
      ...q, noites: periodo.noites, total: calcularTotal(q.diaria, periodo.noites),
    })));
  });

  // ---------- Reservas ----------
  app.post('/api/reservas', autenticar, async (req, res) => {
    const { quartoId, checkin, checkout, hospedes } = req.body ?? {};
    const periodo = validarPeriodo(checkin, checkout, hoje(agora()));
    if (!periodo.ok) return erro(res, 400, periodo.erro);
    const idQuarto = Number.isInteger(quartoId) ? quartoId : null;
    const [quarto] = idQuarto === null ? []
      : await db.query('SELECT id, capacidade, diaria::float8 AS diaria FROM quartos WHERE id = $1', [idQuarto]);
    if (!quarto) return erro(res, 404, 'Quarto não encontrado.');
    const qtd = validarHospedes(hospedes, quarto.capacidade);
    if (!qtd.ok) return erro(res, 400, qtd.erro);

    const total = calcularTotal(quarto.diaria, periodo.noites);
    const indisponivel = 'Este quarto não está disponível no período escolhido.';
    try {
      const id = await db.transaction(async (q) => {
        // Trava o quarto: duas reservas ao mesmo tempo no mesmo quarto passam uma de cada vez.
        await q('SELECT id FROM quartos WHERE id = $1 FOR UPDATE', [quarto.id]);
        const conflito = await q(
          `SELECT 1 FROM reservas
           WHERE quarto_id = $1 AND status IN ${OCUPAM} AND checkin < $2::date AND $3::date < checkout`,
          [quarto.id, checkout, checkin],
        );
        if (conflito.length > 0) return null;
        const [nova] = await q(
          `INSERT INTO reservas (hospede_id, quarto_id, checkin, checkout, hospedes, total)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [req.hospede.id, quarto.id, checkin, checkout, hospedes, total],
        );
        return nova.id;
      });
      if (id === null) return erro(res, 409, indisponivel);
      const [reserva] = await db.query(`${SELECIONAR_RESERVA} WHERE r.id = $1`, [id]);
      res.status(201).json(reserva);
    } catch (e) {
      if (e.code === VIOLACAO_EXCLUSAO) return erro(res, 409, indisponivel); // rede de segurança do banco
      throw e;
    }
  });

  app.get('/api/reservas', autenticar, async (req, res) => {
    res.json(await db.query(
      `${SELECIONAR_RESERVA} WHERE r.hospede_id = $1 ORDER BY r.checkin DESC, r.id DESC`,
      [req.hospede.id],
    ));
  });

  // Reserva do hóspede logado; reservas de outras pessoas aparecem como "não encontrada".
  async function buscarReservaDoHospede(req) {
    const id = comoInteiro(req.params.id);
    if (id === null) return NAO_ENCONTRADA;
    const [reserva] = await db.query(
      'SELECT id, status, checkin::text AS checkin FROM reservas WHERE id = $1 AND hospede_id = $2',
      [id, req.hospede.id],
    );
    return reserva ? { ok: true, reserva } : NAO_ENCONTRADA;
  }

  async function mudarStatus(req, res, regra, novoStatus) {
    const { ok, reserva } = await buscarReservaDoHospede(req);
    if (!ok) return erro(res, 404, 'Reserva não encontrada.');
    const permitido = regra(reserva);
    if (!permitido.ok) return erro(res, 409, permitido.erro);
    await db.query('UPDATE reservas SET status = $1 WHERE id = $2', [novoStatus, reserva.id]);
    const [atualizada] = await db.query(`${SELECIONAR_RESERVA} WHERE r.id = $1`, [reserva.id]);
    res.json(atualizada);
  }

  app.post('/api/reservas/:id/cancelar', autenticar, (req, res) =>
    mudarStatus(req, res, podeCancelar, 'cancelada'));

  app.post('/api/reservas/:id/checkin', autenticar, (req, res) =>
    mudarStatus(req, res, (r) => podeFazerCheckin(r, hoje(agora())), 'checkin_feito'));

  // JSON malformado e erros inesperados
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return erro(res, 400, 'Corpo da requisição inválido.');
    console.error(err);
    erro(res, 500, 'Erro interno.');
  });

  return app;
}
