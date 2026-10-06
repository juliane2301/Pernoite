import { FUSO } from '../config.js';

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

// Aceita só datas reais no formato AAAA-MM-DD (rejeita, por exemplo, 2026-02-30).
export function dataValida(texto) {
  if (typeof texto !== 'string') return false;
  const m = FORMATO.exec(texto);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function emDias(texto) {
  const [a, m, d] = texto.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86400000;
}

// Número de noites entre check-in e check-out (datas já validadas).
export function contarNoites(checkin, checkout) {
  return emDias(checkout) - emDias(checkin);
}

// Dois períodos [início, fim) se sobrepõem? O dia de saída de um pode ser o dia de entrada do outro.
export function periodosSeSobrepoem(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && inicioB < fimA;
}

// Data de hoje (AAAA-MM-DD) no fuso de Brasília.
export function hoje(agora = new Date()) {
  return agora.toLocaleDateString('sv-SE', { timeZone: FUSO });
}
