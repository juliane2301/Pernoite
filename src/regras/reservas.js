import {
  NOITES_MIN, NOITES_MAX, HOSPEDES_MIN,
  DESCONTO_A_PARTIR_DE_NOITES, DESCONTO_PERCENTUAL,
} from '../config.js';
import { dataValida, contarNoites } from './datas.js';

// Valida o período. Devolve { ok: true, noites } ou { ok: false, erro }.
export function validarPeriodo(checkin, checkout, dataHoje) {
  if (!dataValida(checkin) || !dataValida(checkout)) {
    return { ok: false, erro: 'Datas inválidas. Use o formato AAAA-MM-DD.' };
  }
  if (checkin < dataHoje) {
    return { ok: false, erro: 'A data de check-in não pode estar no passado.' };
  }
  const noites = contarNoites(checkin, checkout);
  if (noites < NOITES_MIN) {
    return { ok: false, erro: 'O check-out deve ser depois do check-in.' };
  }
  if (noites > NOITES_MAX) {
    return { ok: false, erro: `A estadia pode ter no máximo ${NOITES_MAX} noites.` };
  }
  return { ok: true, noites };
}

// Valida o número de hóspedes para a capacidade do quarto.
export function validarHospedes(hospedes, capacidade) {
  if (!Number.isInteger(hospedes)) {
    return { ok: false, erro: 'O número de hóspedes deve ser um inteiro.' };
  }
  if (hospedes < HOSPEDES_MIN) {
    return { ok: false, erro: `É preciso ao menos ${HOSPEDES_MIN} hóspede.` };
  }
  if (hospedes > capacidade) {
    return { ok: false, erro: `Este quarto comporta no máximo ${capacidade} hóspede(s).` };
  }
  return { ok: true };
}

// Total em reais: diária × noites, com desconto a partir de 7 noites. Arredonda em centavos.
export function calcularTotal(diaria, noites) {
  const bruto = diaria * noites;
  const total = noites >= DESCONTO_A_PARTIR_DE_NOITES
    ? bruto * (1 - DESCONTO_PERCENTUAL / 100)
    : bruto;
  return Math.round(total * 100) / 100;
}

// O check-in só é liberado na data da reserva e se ela estiver ativa.
export function podeFazerCheckin(reserva, dataHoje) {
  if (reserva.status !== 'ativa') {
    return { ok: false, erro: 'Esta reserva não está ativa.' };
  }
  if (dataHoje !== reserva.checkin) {
    return { ok: false, erro: 'O check-in só pode ser feito na data de entrada da reserva.' };
  }
  return { ok: true };
}

export function podeCancelar(reserva) {
  if (reserva.status !== 'ativa') {
    return { ok: false, erro: 'Só é possível cancelar reservas ativas.' };
  }
  return { ok: true };
}
