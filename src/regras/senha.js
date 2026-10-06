import { SENHA_MIN, SENHA_MAX } from '../config.js';

// Regra: texto com 8 a 20 caracteres e pelo menos um número.
export function validarSenha(senha) {
  if (typeof senha !== 'string') return false;
  if (senha.length < SENHA_MIN || senha.length > SENHA_MAX) return false;
  return /\d/.test(senha);
}

export const MENSAGEM_SENHA = `Senha inválida: use de ${SENHA_MIN} a ${SENHA_MAX} caracteres e pelo menos um número.`;
