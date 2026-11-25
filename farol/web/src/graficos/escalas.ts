/** Escalas e ticks para os gráficos SVG do Farol (sem dependências). */

export type Escala = ((valor: number) => number) & { dominio: [number, number] };

export function escalaLinear(dominio: [number, number], faixa: [number, number]): Escala {
  const [d0, d1] = dominio;
  const [r0, r1] = faixa;
  const span = d1 - d0 || 1;
  const f = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as Escala;
  f.dominio = dominio;
  return f;
}

/** Passo "redondo" (1, 2, 2,5 ou 5 × 10^n) para cerca de `alvo` divisões. */
function passoRedondo(span: number, alvo: number): number {
  const bruto = span / Math.max(alvo, 1);
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const fator = bruto / potencia;
  const opcoes = [1, 2, 2.5, 5, 10];
  return (opcoes.find((o) => fator <= o) ?? 10) * potencia;
}

/** Domínio arredondado e ticks legíveis que cobrem [min, max]. */
export function ticksLegiveis(
  min: number,
  max: number,
  alvo = 5,
): { dominio: [number, number]; ticks: number[] } {
  if (min === max) {
    const folga = Math.abs(min) * 0.1 || 1;
    min -= folga;
    max += folga;
  }
  const passo = passoRedondo(max - min, alvo);
  const inicio = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = inicio; v <= fim + passo / 2; v += passo) ticks.push(Number(v.toFixed(10)));
  return { dominio: [inicio, fim], ticks };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11-01" → Date em UTC (as datas da Gold não têm hora). */
export function data(texto: string): Date {
  const [a, m, d] = texto.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d ?? 1));
}

export function rotuloMes(dia: Date, comAno = true): string {
  const mes = MESES[dia.getUTCMonth()];
  return comAno ? `${mes}/${String(dia.getUTCFullYear()).slice(2)}` : mes;
}

/** Ticks de tempo: primeiro mês de cada ano, ou a cada N meses quando o período é curto. */
export function ticksDeTempo(inicio: Date, fim: Date, alvo = 6): Date[] {
  const meses =
    (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + fim.getUTCMonth() - inicio.getUTCMonth();
  const passo = [1, 2, 3, 6, 12, 24].find((p) => meses / p <= alvo) ?? 24;
  const ticks: Date[] = [];
  const cursor = new Date(Date.UTC(inicio.getUTCFullYear(), 0, 1));
  while (cursor <= fim) {
    if (cursor >= inicio) ticks.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + passo);
  }
  return ticks;
}

export function formatarNumero(valor: number | null | undefined, casas = 2): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
