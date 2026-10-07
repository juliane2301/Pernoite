-- Pernoite · deixa 5 quartos por hotel, cada um com uma foto diferente.
-- Para um banco já criado com a versão de 34 quartos. Rode UMA vez:
-- Supabase → SQL Editor → New query → colar → Run.
-- Só funciona se não houver reservas ligadas aos quartos que serão apagados.

BEGIN;

ALTER TABLE quartos ADD COLUMN IF NOT EXISTS foto TEXT;

UPDATE quartos q SET foto = v.foto
FROM (VALUES
  ('Hotel Araucária', '101', 'araucaria.jpg'), ('Hotel Araucária', '103', 'beira-mar.jpg'),
  ('Hotel Araucária', '201', 'iguacu-verde.jpg'), ('Hotel Araucária', '203', 'serra-azul.jpg'),
  ('Hotel Araucária', '301', 'suite.jpg'),

  ('Pousada Serra Azul', '1', 'araucaria.jpg'), ('Pousada Serra Azul', '2', 'beira-mar.jpg'),
  ('Pousada Serra Azul', '4', 'iguacu-verde.jpg'), ('Pousada Serra Azul', '5', 'serra-azul.jpg'),
  ('Pousada Serra Azul', '6', 'suite.jpg'),

  ('Hotel Beira-Mar', '101', 'araucaria.jpg'), ('Hotel Beira-Mar', '201', 'beira-mar.jpg'),
  ('Hotel Beira-Mar', '203', 'iguacu-verde.jpg'), ('Hotel Beira-Mar', '301', 'serra-azul.jpg'),
  ('Hotel Beira-Mar', '302', 'suite.jpg'),

  ('Hotel Iguaçu Verde', '11', 'araucaria.jpg'), ('Hotel Iguaçu Verde', '21', 'beira-mar.jpg'),
  ('Hotel Iguaçu Verde', '31', 'iguacu-verde.jpg'), ('Hotel Iguaçu Verde', '32', 'serra-azul.jpg'),
  ('Hotel Iguaçu Verde', '41', 'suite.jpg')
) AS v(hotel, numero, foto)
JOIN hoteis h ON h.nome = v.hotel
WHERE q.hotel_id = h.id AND q.numero = v.numero;

-- Os quartos que ficaram sem foto são os que saem.
DELETE FROM quartos WHERE foto IS NULL;

ALTER TABLE quartos ALTER COLUMN foto SET NOT NULL;

COMMIT;

-- Conferência: cada hotel deve aparecer com 5 quartos e 5 fotos.
SELECT h.nome, count(*) AS quartos, count(DISTINCT q.foto) AS fotos
FROM quartos q JOIN hoteis h ON h.id = q.hotel_id
GROUP BY h.nome ORDER BY h.nome;
