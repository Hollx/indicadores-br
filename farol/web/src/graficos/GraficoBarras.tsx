import { escalaLinear, formatarNumero, ticksLegiveis } from "./escalas";
import { useLargura } from "./useLargura";

export type Barra = { rotulo: string; valor: number | null; destaque?: boolean; dica?: string; cor?: string };

type Props = {
  barras: Barra[];
  altura?: number;
  cor?: string;
  unidade?: string;
  casas?: number;
  rotuloX?: string;
};

const MARGEM = { topo: 18, direita: 12, baixo: 34, esquerda: 48 };

/** Barras verticais com rótulo de valor sobre cada barra. */
export default function GraficoBarras({
  barras,
  altura = 240,
  cor = "var(--chart-1)",
  unidade = "",
  casas = 2,
  rotuloX,
}: Props) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const valores = barras.map((b) => b.valor).filter((v): v is number => v !== null);
  if (valores.length === 0) return <p className="estado">Sem dados para o gráfico.</p>;

  const { dominio, ticks } = ticksLegiveis(Math.min(0, ...valores), Math.max(0, ...valores), 4);
  const larguraUtil = Math.max(largura - MARGEM.esquerda - MARGEM.direita, 50);
  const alturaUtil = altura - MARGEM.topo - MARGEM.baixo;
  const escY = escalaLinear(dominio, [alturaUtil, 0]);
  const passo = larguraUtil / barras.length;
  const larguraBarra = Math.min(passo * 0.7, 48);

  return (
    <div className="grafico" ref={ref}>
      <svg width={largura} height={altura} role="img" aria-label={rotuloX ?? "gráfico de barras"}>
        <g transform={`translate(${MARGEM.esquerda},${MARGEM.topo})`}>
          {ticks.map((t) => (
            <g key={t} transform={`translate(0,${escY(t)})`}>
              <line x2={larguraUtil} className={t === 0 ? "eixo-zero" : "grade"} />
              <text x={-8} dy="0.32em" textAnchor="end" className="rotulo-eixo">
                {formatarNumero(t, casas)}
              </text>
            </g>
          ))}
          {barras.map((b, i) => {
            if (b.valor === null) return null;
            const x = i * passo + (passo - larguraBarra) / 2;
            const y = escY(Math.max(b.valor, 0));
            const h = Math.abs(escY(b.valor) - escY(0));
            return (
              <g key={b.rotulo}>
                <title>{b.dica ?? `${b.rotulo}: ${formatarNumero(b.valor, casas)}${unidade}`}</title>
                <rect
                  x={x}
                  y={y}
                  width={larguraBarra}
                  height={Math.max(h, 1)}
                  rx={3}
                  fill={b.cor ?? cor}
                  opacity={b.destaque ? 1 : 0.75}
                />
                <text x={x + larguraBarra / 2} y={y - 5} textAnchor="middle" className="rotulo-valor">
                  {formatarNumero(b.valor, casas)}
                </text>
                <text
                  x={x + larguraBarra / 2}
                  y={alturaUtil + 16}
                  textAnchor="middle"
                  className="rotulo-eixo"
                >
                  {b.rotulo}
                </text>
              </g>
            );
          })}
          {rotuloX && (
            <text x={larguraUtil / 2} y={alturaUtil + 31} textAnchor="middle" className="rotulo-eixo">
              {rotuloX}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
