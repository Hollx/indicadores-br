import { useMemo, useState } from "react";

import { data, escalaLinear, formatarNumero, rotuloMes, ticksDeTempo, ticksLegiveis } from "./escalas";
import { useLargura } from "./useLargura";

export type Ponto = { x: string; y: number | null };

export type Serie = {
  nome: string;
  cor: string;
  pontos: Ponto[];
  tracejada?: boolean;
};

/** Faixa sombreada entre dois limites (ex.: menor e maior projeção do mercado). */
export type Faixa = {
  nome: string;
  cor: string;
  pontos: { x: string; y0: number | null; y1: number | null }[];
};

type Props = {
  series: Serie[];
  faixa?: Faixa;
  altura?: number;
  unidade?: string;
  casas?: number;
  linhaZero?: boolean;
};

const MARGEM = { topo: 12, direita: 16, baixo: 28, esquerda: 48 };

/** Gráfico de linhas no tempo, com faixa opcional, grade, legenda e tooltip por mês. */
export default function GraficoLinhas({
  series,
  faixa,
  altura = 280,
  unidade = "",
  casas = 2,
  linhaZero,
}: Props) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  const modelo = useMemo(() => {
    const xs = Array.from(
      new Set([...series.flatMap((s) => s.pontos.map((p) => p.x)), ...(faixa?.pontos.map((p) => p.x) ?? [])]),
    ).sort();
    if (xs.length === 0) return null;
    const valores = [
      ...series.flatMap((s) => s.pontos.map((p) => p.y)),
      ...(faixa?.pontos.flatMap((p) => [p.y0, p.y1]) ?? []),
      ...(linhaZero ? [0] : []),
    ].filter((v): v is number => v !== null);
    const { dominio, ticks } = ticksLegiveis(Math.min(...valores), Math.max(...valores));
    const datas = xs.map(data);
    const larguraUtil = Math.max(largura - MARGEM.esquerda - MARGEM.direita, 50);
    const alturaUtil = altura - MARGEM.topo - MARGEM.baixo;
    const escX = escalaLinear([datas[0].getTime(), datas[datas.length - 1].getTime()], [0, larguraUtil]);
    const escY = escalaLinear(dominio, [alturaUtil, 0]);
    return { xs, datas, ticks, escX, escY, larguraUtil, alturaUtil };
  }, [series, faixa, largura, altura, linhaZero]);

  if (!modelo) return <p className="estado">Sem dados para o gráfico.</p>;
  const { xs, datas, ticks, escX, escY, larguraUtil, alturaUtil } = modelo;
  const xDe = (x: string) => escX(data(x).getTime());

  const caminho = (pontos: Ponto[]) => {
    let d = "";
    let aberto = false;
    for (const p of pontos) {
      if (p.y === null) {
        aberto = false;
        continue;
      }
      d += `${aberto ? "L" : "M"}${xDe(p.x).toFixed(1)},${escY(p.y).toFixed(1)}`;
      aberto = true;
    }
    return d;
  };

  const caminhoFaixa = (() => {
    if (!faixa) return "";
    const validos = faixa.pontos.filter((p) => p.y0 !== null && p.y1 !== null);
    if (validos.length < 2) return "";
    const topo = validos.map((p, i) => `${i ? "L" : "M"}${xDe(p.x)},${escY(p.y1!)}`).join("");
    const base = [...validos]
      .reverse()
      .map((p) => `L${xDe(p.x)},${escY(p.y0!)}`)
      .join("");
    return `${topo}${base}Z`;
  })();

  const aoMover = (evento: React.MouseEvent<SVGRectElement>) => {
    const caixa = evento.currentTarget.getBoundingClientRect();
    const alvo = evento.clientX - caixa.left;
    let melhor = 0;
    datas.forEach((d, i) => {
      if (Math.abs(escX(d.getTime()) - alvo) < Math.abs(escX(datas[melhor].getTime()) - alvo)) melhor = i;
    });
    setFoco(melhor);
  };

  const xFoco = foco !== null ? escX(datas[foco].getTime()) : 0;
  const valorDe = (s: Serie, x: string) => s.pontos.find((p) => p.x === x)?.y ?? null;

  return (
    <div className="grafico" ref={ref}>
      <div className="legenda">
        {faixa && (
          <span>
            <i className="legenda-faixa" style={{ background: faixa.cor }} /> {faixa.nome}
          </span>
        )}
        {series.map((s) => (
          <span key={s.nome}>
            <i
              className={s.tracejada ? "legenda-linha tracejada" : "legenda-linha"}
              style={{ borderColor: s.cor }}
            />{" "}
            {s.nome}
          </span>
        ))}
      </div>
      <svg width={largura} height={altura} role="img" aria-label={series.map((s) => s.nome).join(", ")}>
        <g transform={`translate(${MARGEM.esquerda},${MARGEM.topo})`}>
          {ticks.map((t) => (
            <g key={t} transform={`translate(0,${escY(t)})`}>
              <line x2={larguraUtil} className={t === 0 && linhaZero ? "eixo-zero" : "grade"} />
              <text x={-8} dy="0.32em" textAnchor="end" className="rotulo-eixo">
                {formatarNumero(t, Number.isInteger(t) ? 0 : casas > 1 ? 1 : casas)}
              </text>
            </g>
          ))}
          {ticksDeTempo(datas[0], datas[datas.length - 1]).map((d) => (
            <text
              key={d.getTime()}
              x={escX(d.getTime())}
              y={alturaUtil + 18}
              textAnchor="middle"
              className="rotulo-eixo"
            >
              {rotuloMes(d)}
            </text>
          ))}
          {caminhoFaixa && <path d={caminhoFaixa} fill={faixa!.cor} opacity={0.18} />}
          {series.map((s) => (
            <path
              key={s.nome}
              d={caminho(s.pontos)}
              fill="none"
              stroke={s.cor}
              strokeWidth={2}
              strokeDasharray={s.tracejada ? "5 4" : undefined}
              strokeLinejoin="round"
            />
          ))}
          {foco !== null && (
            <g>
              <line x1={xFoco} x2={xFoco} y2={alturaUtil} className="mira" />
              {series.map((s) => {
                const v = valorDe(s, xs[foco]);
                return v === null ? null : (
                  <circle key={s.nome} cx={xFoco} cy={escY(v)} r={3.5} fill={s.cor} />
                );
              })}
            </g>
          )}
          <rect
            width={larguraUtil}
            height={alturaUtil}
            fill="transparent"
            onMouseMove={aoMover}
            onMouseLeave={() => setFoco(null)}
          />
        </g>
      </svg>
      {foco !== null && (
        <div
          className="dica"
          style={{
            left: Math.min(MARGEM.esquerda + xFoco + 12, largura - 190),
            top: MARGEM.topo,
          }}
        >
          <strong>{rotuloMes(datas[foco])}</strong>
          {faixa &&
            (() => {
              const p = faixa.pontos.find((q) => q.x === xs[foco]);
              return p && p.y0 !== null ? (
                <span>
                  {faixa.nome}: {formatarNumero(p.y0, casas)} a {formatarNumero(p.y1, casas)}
                  {unidade}
                </span>
              ) : null;
            })()}
          {series.map((s) => (
            <span key={s.nome}>
              <i style={{ background: s.cor }} /> {s.nome}: {formatarNumero(valorDe(s, xs[foco]), casas)}
              {valorDe(s, xs[foco]) !== null ? unidade : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
