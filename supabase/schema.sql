-- Pernoite · esquema do banco (Postgres / Supabase)
-- Rode UMA vez: Supabase → SQL Editor → New query → colar → Run.
-- É seguro rodar de novo (usa IF NOT EXISTS e ON CONFLICT).
-- Atenção: um banco criado com uma versão anterior (sem a tabela "hoteis" ou sem a coluna "foto" em hoteis e quartos) precisa ser recriado do zero.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS hoteis (
  id        SERIAL PRIMARY KEY,
  nome      TEXT NOT NULL UNIQUE,
  cidade    TEXT NOT NULL,
  estado    TEXT NOT NULL,
  descricao TEXT NOT NULL,
  foto      TEXT NOT NULL -- nome do arquivo em public/fotos/hoteis
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
  foto       TEXT NOT NULL, -- nome do arquivo em public/fotos/quartos
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

-- Cinco quartos por hotel, cada um com uma foto diferente.
INSERT INTO quartos (hotel_id, numero, tipo, capacidade, diaria, foto)
SELECT h.id, v.numero, v.tipo, v.capacidade, v.diaria, v.foto
FROM (VALUES
  ('Hotel Araucária', '101', 'Solteiro', 1, 150, 'araucaria.jpg'),
  ('Hotel Araucária', '103', 'Casal', 2, 220, 'beira-mar.jpg'),
  ('Hotel Araucária', '201', 'Família', 3, 300, 'iguacu-verde.jpg'),
  ('Hotel Araucária', '203', 'Família', 4, 380, 'serra-azul.jpg'),
  ('Hotel Araucária', '301', 'Suíte', 2, 450, 'suite.jpg'),

  ('Pousada Serra Azul', '1', 'Chalé casal', 2, 320, 'araucaria.jpg'),
  ('Pousada Serra Azul', '2', 'Chalé casal', 2, 320, 'beira-mar.jpg'),
  ('Pousada Serra Azul', '4', 'Chalé família', 4, 480, 'iguacu-verde.jpg'),
  ('Pousada Serra Azul', '5', 'Chalé família', 4, 480, 'serra-azul.jpg'),
  ('Pousada Serra Azul', '6', 'Chalé master', 4, 650, 'suite.jpg'),

  ('Hotel Beira-Mar', '101', 'Solteiro', 1, 180, 'araucaria.jpg'),
  ('Hotel Beira-Mar', '201', 'Casal', 2, 280, 'beira-mar.jpg'),
  ('Hotel Beira-Mar', '203', 'Casal vista mar', 2, 360, 'iguacu-verde.jpg'),
  ('Hotel Beira-Mar', '301', 'Família', 4, 420, 'serra-azul.jpg'),
  ('Hotel Beira-Mar', '302', 'Família vista mar', 4, 520, 'suite.jpg'),

  ('Hotel Iguaçu Verde', '11', 'Solteiro', 1, 130, 'araucaria.jpg'),
  ('Hotel Iguaçu Verde', '21', 'Casal', 2, 200, 'beira-mar.jpg'),
  ('Hotel Iguaçu Verde', '31', 'Família', 3, 290, 'iguacu-verde.jpg'),
  ('Hotel Iguaçu Verde', '32', 'Família', 4, 350, 'serra-azul.jpg'),
  ('Hotel Iguaçu Verde', '41', 'Suíte', 2, 400, 'suite.jpg')
) AS v(hotel, numero, tipo, capacidade, diaria, foto)
JOIN hoteis h ON h.nome = v.hotel
ORDER BY h.id, v.numero
ON CONFLICT (hotel_id, numero) DO NOTHING;
