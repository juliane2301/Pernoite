# Regras de negócio

Versão do sistema: **v1.1** (vários hotéis)

Cada regra tem um código (RN-xx) para ser citada depois nos testes e nos registros do GitHub Issues.

| Código | Regra | Onde está no código |
| --- | --- | --- |
| RN-01 | Senha com 8 a 20 caracteres e pelo menos um número | `src/regras/senha.js` |
| RN-02 | E-mail válido e único (sem diferenciar maiúsculas) | `src/regras/email.js`, `src/app.js` |
| RN-03 | Estadia de 1 a 30 noites; check-out depois do check-in | `src/regras/reservas.js` |
| RN-04 | Check-in não pode estar no passado (fuso de Brasília) | `src/regras/reservas.js`, `src/regras/datas.js` |
| RN-05 | Hóspedes: inteiro de 1 até a capacidade do quarto | `src/regras/reservas.js` |
| RN-06 | Sem reserva dupla: períodos se sobrepõem se `entradaA < saídaB` e `entradaB < saídaA`; o dia de saída de uma reserva pode ser o de entrada de outra | `src/regras/datas.js`, `src/app.js` e a trava `reservas_sem_sobreposicao` em `supabase/schema.sql` |
| RN-07 | Total = diária × noites, com 10% de desconto a partir de 7 noites | `src/regras/reservas.js` |
| RN-08 | Reserva cancelada libera o quarto | `src/app.js` |
| RN-09 | Check-in só na data de entrada e só de reserva ativa | `src/regras/reservas.js` |
| RN-10 | Cada hóspede só vê e altera as próprias reservas | `src/app.js` |
| RN-11 | Senha guardada com hash (bcrypt); login não revela se o e-mail existe | `src/app.js` |
| RN-12 | O hóspede escolhe o hotel; a busca filtrada por hotel lista só os quartos dele, e o número do quarto é único dentro de cada hotel | `src/app.js`, `supabase/schema.sql` |

## Fora do escopo desta versão
Pagamento, e-mail de confirmação, recuperação de senha, painel de administrador, expiração das sessões, limite de tentativas de login.
