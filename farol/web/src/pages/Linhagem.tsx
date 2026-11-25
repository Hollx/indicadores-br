import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

import { ORDEM_CAMADAS, ROTULO_TIPO, useApi } from "../api";
import { TituloTela } from "../componentes";
import { Explica, Termo } from "../glossario";
import { useTema } from "../tema";
import type { Linhagem as TLinhagem } from "../tipos";

const LARGURA_COLUNA = 270;
const ALTURA_LINHA = 120;

/** Profundidade de cada nó: o caminho mais longo desde uma fonte (sem pais = 0). */
function profundidades(dados: TLinhagem): Map<string, number> {
  const pais = new Map<string, string[]>();
  for (const a of dados.arestas) pais.set(a.destino, [...(pais.get(a.destino) ?? []), a.origem]);
  const memo = new Map<string, number>();
  const calcular = (id: string, visitando: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (visitando.has(id)) return 0; // proteção contra ciclo (o dbt não permite, mas não custa)
    visitando.add(id);
    const p = pais.get(id) ?? [];
    const valor = p.length ? Math.max(...p.map((x) => calcular(x, visitando) + 1)) : 0;
    memo.set(id, valor);
    return valor;
  };
  for (const n of dados.nos) calcular(n.id, new Set());
  return memo;
}

/**
 * Uma coluna por profundidade. Cada nó tenta ficar na altura média dos pais (baricentro),
 * o que deixa as setas retas e evita que uma aresta longa passe por trás de outro nó.
 */
function posicionar(dados: TLinhagem): { nos: Node[]; arestas: Edge[] } {
  const prof = profundidades(dados);
  const pais = new Map<string, string[]>();
  for (const a of dados.arestas) pais.set(a.destino, [...(pais.get(a.destino) ?? []), a.origem]);

  const colunas = new Map<number, TLinhagem["nos"]>();
  for (const n of dados.nos) {
    const c = prof.get(n.id) ?? 0;
    colunas.set(c, [...(colunas.get(c) ?? []), n]);
  }

  const y = new Map<string, number>();
  for (const c of [...colunas.keys()].sort((a, b) => a - b)) {
    const desejado = (n: TLinhagem["nos"][number], i: number) => {
      const ys = (pais.get(n.id) ?? []).map((p) => y.get(p)).filter((v): v is number => v !== undefined);
      return ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length : i * ALTURA_LINHA;
    };
    const coluna = [...colunas.get(c)!].sort(
      (a, b) =>
        ORDEM_CAMADAS.indexOf(a.camada) - ORDEM_CAMADAS.indexOf(b.camada) || a.nome.localeCompare(b.nome),
    );
    const alvos = coluna.map((n, i) => ({ n, alvo: desejado(n, i) })).sort((a, b) => a.alvo - b.alvo);
    let anterior = -Infinity;
    for (const { n, alvo } of alvos) {
      const valor = Math.max(alvo, anterior + ALTURA_LINHA);
      y.set(n.id, valor);
      anterior = valor;
    }
  }

  const nos: Node[] = dados.nos.map((n) => ({
    id: n.id,
    position: { x: (prof.get(n.id) ?? 0) * LARGURA_COLUNA, y: y.get(n.id) ?? 0 },
    data: {
      label: (
        <div className="no-linhagem">
          <span className={`selo camada-${n.camada}`}>{n.camada}</span>
          <strong>{n.nome}</strong>
          <small>{ROTULO_TIPO[n.tipo]}</small>
        </div>
      ),
    },
    className: `no camada-borda-${n.camada}`,
    sourcePosition: "right" as Node["sourcePosition"],
    targetPosition: "left" as Node["targetPosition"],
  }));
  const arestas: Edge[] = dados.arestas.map((a) => ({
    id: `${a.origem}->${a.destino}`,
    source: a.origem,
    target: a.destino,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
  return { nos, arestas };
}

export default function Linhagem() {
  const { efetivo } = useTema();
  const { dados, erro, carregando } = useApi<TLinhagem>("/linhagem");
  const grafo = useMemo(() => (dados ? posicionar(dados) : null), [dados]);

  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !grafo) return <p className="estado erro">Não foi possível carregar: {erro}</p>;

  return (
    <>
      <TituloTela
        titulo="Linhagem"
        achado={`Cada número dos gráficos tem origem rastreável: ${grafo.nos.length} etapas ligadas por ${grafo.arestas.length} dependências, da API do Banco Central até a tela.`}
      >
        <Explica titulo="Como ler este mapa">
          <p>
            Cada caixa é uma tabela e cada seta mostra de onde ela tira os dados. Da esquerda para a direita,
            o dado sai bruto da fonte e chega pronto ao gráfico. Se uma tabela tiver problema, o mapa mostra
            tudo o que depende dela.
          </p>
          <p>
            Esta é a <Termo id="linhagem">linhagem</Termo> declarada no <Termo id="dbt">dbt</Termo>. Arraste
            para mover e use a roda do mouse ou os botões para aproximar.
          </p>
        </Explica>
      </TituloTela>
      <div className="grafo">
        <ReactFlow
          colorMode={efetivo === "escuro" ? "dark" : "light"}
          nodes={grafo.nos}
          edges={grafo.arestas}
          fitView
          nodesConnectable={false}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="camadas-legenda" aria-label="Camadas">
        {CAMADAS.map(([c, texto]) => (
          <span key={c}>
            <span className={`ponto camada-${c}`} aria-hidden /> {texto}
          </span>
        ))}
      </div>
    </>
  );
}

const CAMADAS: [string, string][] = [
  ["bronze", "Bronze: dado bruto"],
  ["silver", "Silver: dado limpo"],
  ["gold", "Gold: pronto para análise"],
  ["consumo", "Consumo: gráficos e painéis"],
];
