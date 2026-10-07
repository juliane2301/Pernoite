// Front-end do site de reservas: conversa com a API e desenha as telas.
const $ = (id) => document.getElementById(id);
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso) => iso.split('-').reverse().join('/');
const ROTULO_STATUS = { ativa: 'Ativa', cancelada: 'Cancelada', checkin_feito: 'Check-in feito' };

let token = sessionStorage.getItem('token');
let hoteis = [];
let hotelEscolhido = null;

async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const res = await fetch(caminho, {
    method: metodo,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(dados?.erro ?? 'Erro inesperado.');
  return dados;
}

function mensagem(id, texto, tipo = '') {
  const el = $(id);
  el.textContent = texto;
  el.className = `mensagem ${tipo}`.trim();
}

function criar(tag, { texto, classe, atributos = {} } = {}, ...filhos) {
  const el = document.createElement(tag);
  if (texto !== undefined) el.textContent = texto;
  if (classe) el.className = classe;
  Object.entries(atributos).forEach(([k, v]) => el.setAttribute(k, v));
  filhos.forEach((f) => el.append(f));
  return el;
}

const foto = (src, alt) => criar('img', { classe: 'foto', atributos: { src, alt, loading: 'lazy' } });

// Suítes têm foto própria; os demais quartos usam a foto de quarto do hotel.
const fotoDoQuarto = (quarto) => (/suíte/i.test(quarto.tipo)
  ? 'fotos/quartos/suite.jpg'
  : `fotos/quartos/${hotelEscolhido.foto}`);

// ---------- Sessão ----------
function mostrarTela(logado, nome = '') {
  $('area-visitante').hidden = logado;
  $('area-hospede').hidden = !logado;
  $('area-usuario').hidden = !logado;
  $('saudacao').textContent = logado ? `Olá, ${nome}` : '';
}

function sair() {
  token = null;
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('nome');
  hotelEscolhido = null;
  $('secao-busca').hidden = true;
  $('lista-hoteis').replaceChildren();
  $('lista-quartos').replaceChildren();
  $('lista-reservas').replaceChildren();
  mensagem('msg-hoteis', '');
  mensagem('msg-busca', '');
  mensagem('msg-reservas', '');
  mostrarTela(false);
}

// ---------- Cadastro e login ----------
$('form-cadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/cadastro', {
      metodo: 'POST',
      corpo: { nome: $('cadastro-nome').value, email: $('cadastro-email').value, senha: $('cadastro-senha').value },
    });
    mensagem('msg-cadastro', 'Cadastro realizado com sucesso. Agora é só entrar.', 'ok');
    $('login-email').value = $('cadastro-email').value;
    $('cadastro-senha').value = '';
  } catch (erro) {
    mensagem('msg-cadastro', erro.message, 'erro');
  }
});

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const dados = await api('/api/login', {
      metodo: 'POST',
      corpo: { email: $('login-email').value, senha: $('login-senha').value },
    });
    token = dados.token;
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('nome', dados.nome);
    $('login-senha').value = '';
    mensagem('msg-login', '');
    await entrar(dados.nome);
  } catch (erro) {
    mensagem('msg-login', erro.message, 'erro');
  }
});

$('botao-sair').addEventListener('click', async () => {
  try { await api('/api/logout', { metodo: 'POST' }); } catch { /* sessão já expirada */ }
  sair();
});

// ---------- Hotéis ----------
async function carregarHoteis() {
  hoteis = await api('/api/hoteis');
  const cidades = [...new Set(hoteis.map((h) => h.cidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filtro = $('filtro-cidade');
  filtro.replaceChildren(
    criar('option', { texto: 'Todos os destinos', atributos: { value: '' } }),
    ...cidades.map((c) => criar('option', { texto: c, atributos: { value: c } })),
  );
  desenharHoteis();
}

function desenharHoteis() {
  const cidade = $('filtro-cidade').value;
  const visiveis = hoteis.filter((h) => cidade === '' || h.cidade === cidade);
  mensagem('msg-hoteis', `${visiveis.length} hotel(is) encontrado(s).`);
  $('lista-hoteis').replaceChildren(...visiveis.map((h) => {
    const botao = criar('button', {
      texto: 'Ver quartos',
      classe: 'leve',
      atributos: { type: 'button', 'aria-label': `Ver quartos do ${h.nome}` },
    });
    botao.addEventListener('click', () => escolherHotel(h));
    return criar('li', { classe: h.id === hotelEscolhido?.id ? 'escolhido' : '' },
      foto(`fotos/hoteis/${h.foto}`, `Foto do ${h.nome}`),
      criar('h3', { texto: h.nome }),
      criar('p', { texto: `${h.cidade} · ${h.estado}` }),
      criar('p', { texto: h.descricao }),
      criar('p', { texto: `${h.quartos} quarto(s) · a partir de ${brl(h.diariaMinima)} por noite`, classe: 'preco' }),
      criar('div', { classe: 'acoes' }, botao),
    );
  }));
}

$('filtro-cidade').addEventListener('change', desenharHoteis);

function escolherHotel(hotel) {
  hotelEscolhido = hotel;
  $('titulo-busca').textContent = `Buscar quartos · ${hotel.nome}`;
  $('lista-quartos').replaceChildren();
  mensagem('msg-busca', '');
  $('secao-busca').hidden = false;
  desenharHoteis();
  $('secao-busca').scrollIntoView({ behavior: 'smooth' });
}

// ---------- Busca e reserva de quartos ----------
// Soma dias a uma data AAAA-MM-DD.
function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

// O check-out é sempre depois do check-in: ajusta o mínimo do campo e corrige a data se preciso.
function ajustarCheckout() {
  const checkin = $('busca-checkin').value;
  if (!checkin) return;
  const minimo = somarDias(checkin, 1);
  $('busca-checkout').min = minimo;
  if ($('busca-checkout').value < minimo) $('busca-checkout').value = minimo;
}

$('busca-checkin').addEventListener('change', ajustarCheckout);
$('busca-checkout').addEventListener('change', ajustarCheckout);

$('form-busca').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lista = $('lista-quartos');
  lista.replaceChildren();
  const checkin = $('busca-checkin').value;
  const checkout = $('busca-checkout').value;
  const hospedes = Number($('busca-hospedes').value);
  if (!checkin || !checkout) {
    mensagem('msg-busca', 'Informe as datas de check-in e check-out.', 'erro');
    return;
  }
  try {
    const params = new URLSearchParams({ hotel: hotelEscolhido.id, checkin, checkout, hospedes });
    const quartos = await api(`/api/quartos/disponiveis?${params}`);
    if (quartos.length === 0) {
      mensagem('msg-busca', 'Nenhum quarto disponível para esse período.', 'erro');
      return;
    }
    mensagem('msg-busca', `${quartos.length} quarto(s) disponível(is).`, 'ok');
    quartos.forEach((q) => {
      const botao = criar('button', {
        texto: 'Reservar',
        classe: 'leve',
        atributos: { type: 'button', 'aria-label': `Reservar quarto ${q.numero}` },
      });
      botao.addEventListener('click', () => reservar(q, { checkin, checkout, hospedes }));
      lista.append(criar('li', {},
        foto(fotoDoQuarto(q), `Foto do quarto ${q.numero}`),
        criar('h3', { texto: `Quarto ${q.numero} · ${q.tipo}` }),
        criar('p', { texto: `Até ${q.capacidade} hóspede(s) · ${brl(q.diaria)} por noite` }),
        criar('p', { texto: `${q.noites} noite(s)` }),
        criar('p', { texto: `Total: ${brl(q.total)}`, classe: 'preco' }),
        criar('div', { classe: 'acoes' }, botao),
      ));
    });
  } catch (erro) {
    mensagem('msg-busca', erro.message, 'erro');
  }
});

async function reservar(quarto, { checkin, checkout, hospedes }) {
  try {
    const r = await api('/api/reservas', {
      metodo: 'POST',
      corpo: { quartoId: quarto.id, checkin, checkout, hospedes },
    });
    mensagem('msg-busca', `Reserva confirmada: ${r.hotel}, quarto ${r.quarto}, ${dataBR(r.checkin)} a ${dataBR(r.checkout)}.`, 'ok');
    $('lista-quartos').replaceChildren(); // os quartos mudaram: busque de novo
    await carregarReservas();
  } catch (erro) {
    mensagem('msg-busca', erro.message, 'erro');
  }
}

// ---------- Minhas reservas ----------
async function carregarReservas() {
  const lista = $('lista-reservas');
  lista.replaceChildren();
  const reservas = await api('/api/reservas');
  mensagem('msg-reservas', reservas.length === 0 ? 'Você ainda não tem reservas.' : '');
  reservas.forEach((r) => {
    const acoes = criar('div', { classe: 'acoes' });
    if (r.status === 'ativa') {
      const checkin = criar('button', {
        texto: 'Fazer check-in', classe: 'leve',
        atributos: { type: 'button', 'aria-label': `Fazer check-in da reserva ${r.id}` },
      });
      checkin.addEventListener('click', () => acao(r.id, 'checkin', 'Check-in realizado com sucesso.'));
      const cancelar = criar('button', {
        texto: 'Cancelar', classe: 'leve perigo',
        atributos: { type: 'button', 'aria-label': `Cancelar a reserva ${r.id}` },
      });
      cancelar.addEventListener('click', () => acao(r.id, 'cancelar', 'Reserva cancelada.'));
      acoes.append(checkin, cancelar);
    }
    lista.append(criar('li', { atributos: { 'data-reserva': r.id } },
      criar('h3', { texto: `Reserva ${r.id} · Quarto ${r.quarto}` }),
      criar('p', { texto: `${r.hotel} · ${r.cidade}` }),
      criar('p', { texto: `${dataBR(r.checkin)} a ${dataBR(r.checkout)} · ${r.hospedes} hóspede(s)` }),
      criar('p', { texto: `Total: ${brl(r.total)}`, classe: 'preco' }),
      criar('span', { texto: ROTULO_STATUS[r.status], classe: `selo ${r.status}` }),
      acoes,
    ));
  });
}

async function acao(id, nome, textoOk) {
  try {
    await api(`/api/reservas/${id}/${nome}`, { metodo: 'POST' });
    await carregarReservas();
    mensagem('msg-reservas', textoOk, 'ok');
  } catch (erro) {
    mensagem('msg-reservas', erro.message, 'erro');
  }
}

// ---------- Início ----------
async function entrar(nome) {
  mostrarTela(true, nome);
  await Promise.all([carregarHoteis(), carregarReservas()]);
}

async function iniciar() {
  const site = await api('/api/site');
  $('logo').alt = site.nome;
  document.title = site.nome;
  // A busca já abre preenchida: entrada hoje, saída amanhã.
  $('busca-checkin').min = site.hoje;
  $('busca-checkin').value = site.hoje;
  ajustarCheckout();
  if (token) {
    try { await entrar(sessionStorage.getItem('nome') ?? ''); } catch { sair(); }
  }
}
iniciar();
