-- Pernoite · esquema do banco (Postgres / Supabase)
-- Rode UMA vez: Supabase → SQL Editor → New query → colar → Run.
-- É seguro rodar de novo (usa IF NOT EXISTS e ON CONFLICT).
-- Atenção: um banco criado com a v1.0 (sem a tabela "hoteis") ou a v1.1 (sem a coluna "foto") precisa ser recriado do zero.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS hoteis (
  id        SERIAL PRIMARY KEY,
  nome      TEXT NOT NULL UNIQUE,
  cidade    TEXT NOT NULL,
  estado    TEXT NOT NULL,
  descricao TEXT NOT NULL,
  foto      TEXT NOT NULL -- nome do arquivo em public/fotos/hoteis e public/fotos/quartos
);

CREATE TABLE IF NOT EXISTS hospedes (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quartos (
  id         SERIAL PRIMARY KEY,
  hotel_id   INTEGER NOT NULL REFERENCES hoteis(id),
  numero     TEXT NOT NULL,
  tipo       TEXT NOT NULL,
  capacidade INTEGER NOT NULL CHECK (capacidade BETWEEN 1 AND 4),
  diaria     NUMERIC(10, 2) NOT NULL CHECK (diaria > 0),
  UNIQUE (hotel_id, numero) -- o mesmo número pode existir em hotéis diferentes
);

CREATE TABLE IF NOT EXISTS reservas (
  id         SERIAL PRIMARY KEY,
  hospede_id INTEGER NOT NULL REFERENCES hospedes(id),
  quarto_id  INTEGER NOT NULL REFERENCES quartos(id),
  checkin    DATE NOT NULL,
  checkout   DATE NOT NULL,
  hospedes   INTEGER NOT NULL CHECK (hospedes >= 1),
  total      NUMERIC(10, 2) NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'checkin_feito')),
  CHECK (checkout > checkin),
  -- Rede de segurança (RN-06): o banco recusa dois períodos que se sobrepõem no mesmo quarto,
  -- mesmo que duas pessoas reservem ao mesmo tempo. O dia de saída pode ser o de entrada de outra reserva.
  CONSTRAINT reservas_sem_sobreposicao EXCLUDE USING gist (
    quarto_id WITH =,
    daterange(checkin, checkout, '[)') WITH &&
  ) WHERE (status IN ('ativa', 'checkin_feito'))
);

CREATE TABLE IF NOT EXISTS sessoes (
  token      TEXT PRIMARY KEY,
  hospede_id INTEGER NOT NULL REFERENCES hospedes(id)
);

-- Segurança: o Supabase expõe as tabelas por uma API pública. Com RLS ligado e sem políticas,
-- ninguém de fora lê nada (nem os hashes de senha). O servidor do hotel conecta pelo usuário
-- "postgres" da string de conexão, que não é barrado pelo RLS.
ALTER TABLE hospedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoteis   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quartos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes  ENABLE ROW LEVEL SECURITY;

-- Hotéis fictícios.
INSERT INTO hoteis (nome, cidade, estado, descricao, foto) VALUES
  ('Hotel Araucária', 'Curitiba', 'PR', 'Resort à beira do lago, com piscinas e muito verde em volta.', 'araucaria.jpg'),
  ('Pousada Serra Azul', 'Gramado', 'RS', 'Chalés de madeira com varanda, no meio das árvores e à beira do riacho.', 'serra-azul.jpg'),
  ('Hotel Beira-Mar', 'Florianópolis', 'SC', 'Parque aquático com toboáguas e piscinas, cercado pela mata.', 'beira-mar.jpg'),
  ('Hotel Iguaçu Verde', 'Foz do Iguaçu', 'PR', 'Piscina ampla e chalés entre palmeiras, a caminho das Cataratas.', 'iguacu-verde.jpg')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO quartos (hotel_id, numero, tipo, capacidade, diaria)
SELECT h.id, v.numero, v.tipo, v.capacidade, v.diaria
FROM (VALUES
  ('Hotel Araucária', '101', 'Solteiro', 1, 150), ('Hotel Araucária', '102', 'Solteiro', 1, 150),
  ('Hotel Araucária', '103', 'Casal', 2, 220), ('Hotel Araucária', '104', 'Casal', 2, 220),
  ('Hotel Araucária', '105', 'Casal', 2, 240),
  ('Hotel Araucária', '201', 'Família', 3, 300), ('Hotel Araucária', '202', 'Família', 3, 300),
  ('Hotel Araucária', '203', 'Família', 4, 380), ('Hotel Araucária', '204', 'Família', 4, 400),
  ('Hotel Araucária', '301', 'Suíte', 2, 450), ('Hotel Araucária', '302', 'Suíte', 2, 450),
  ('Hotel Araucária', '303', 'Suíte master', 4, 600),

  ('Pousada Serra Azul', '1', 'Chalé casal', 2, 320), ('Pousada Serra Azul', '2', 'Chalé casal', 2, 320),
  ('Pousada Serra Azul', '3', 'Chalé casal', 2, 350),
  ('Pousada Serra Azul', '4', 'Chalé família', 4, 480), ('Pousada Serra Azul', '5', 'Chalé família', 4, 480),
  ('Pousada Serra Azul', '6', 'Chalé master', 4, 650),

  ('Hotel Beira-Mar', '101', 'Solteiro', 1, 180), ('Hotel Beira-Mar', '102', 'Solteiro', 1, 180),
  ('Hotel Beira-Mar', '201', 'Casal', 2, 280), ('Hotel Beira-Mar', '202', 'Casal', 2, 280),
  ('Hotel Beira-Mar', '203', 'Casal vista mar', 2, 360), ('Hotel Beira-Mar', '204', 'Casal vista mar', 2, 360),
  ('Hotel Beira-Mar', '301', 'Família', 4, 420), ('Hotel Beira-Mar', '302', 'Família vista mar', 4, 520),

  ('Hotel Iguaçu Verde', '11', 'Solteiro', 1, 130), ('Hotel Iguaçu Verde', '12', 'Solteiro', 1, 130),
  ('Hotel Iguaçu Verde', '21', 'Casal', 2, 200), ('Hotel Iguaçu Verde', '22', 'Casal', 2, 200),
  ('Hotel Iguaçu Verde', '23', 'Casal', 2, 210),
  ('Hotel Iguaçu Verde', '31', 'Família', 3, 290), ('Hotel Iguaçu Verde', '32', 'Família', 4, 350),
  ('Hotel Iguaçu Verde', '41', 'Suíte', 2, 400)
) AS v(hotel, numero, tipo, capacidade, diaria)
JOIN hoteis h ON h.nome = v.hotel
ORDER BY h.id, v.numero
ON CONFLICT (hotel_id, numero) DO NOTHING;
