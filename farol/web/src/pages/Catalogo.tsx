import { useMemo, useState } from "react";

import { ORDEM_CAMADAS, ROTULO_TIPO, useApi } from "../api";
import { TituloTela } from "../componentes";
import { Explica, Termo } from "../glossario";
import { formatarNumero } from "../graficos/escalas";
import type { Recurso, Resumo } from "../tipos";
import ResumoGovernanca from "./Governanca";

const ROTULO_META: Record<string, string> = {
  grao: "Cada linha é",
  origem: "Origem",
  atualizacao: "Atualização",
  consumidores: "Quem usa",
};

function Detalhe({ recurso }: { recurso: Recurso }) {
  const { cobertura } = recurso;
  const metaExtra = Object.entries(recurso.meta).filter(([chave]) => !["dono", "camada"].includes(chave));
  return (
    <article className="detalhe">
      <header>
        <span className={`selo camada-${recurso.camada}`}>{recurso.camada}</span>
        <span className="selo neutro">{ROTULO_TIPO[recurso.tipo]}</span>
        {recurso.materializacao && <span className="selo neutro">{recurso.materializacao}</span>}
        <h2>{recurso.nome}</h2>
        <p>{recurso.descricao || <em className="vazio">Sem descrição.</em>}</p>
      </header>

      <dl className="ficha">
        <dt>Dono</dt>
        <dd>{recurso.dono ?? <em className="vazio">sem dono</em>}</dd>
        {metaExtra.map(([chave, valor]) => (
          <div key={chave} className="ficha-linha">
            <dt>{ROTULO_META[chave] ?? chave}</dt>
            <dd>{String(valor)}</dd>
          </div>
        ))}
        {recurso.tags.length > 0 && (
          <>
            <dt>Tags</dt>
            <dd>{recurso.tags.join(", ")}</dd>
          </>
        )}
        <dt>Cobertura</dt>
        <dd>
          {cobertura.documentadas}/{cobertura.colunas} colunas documentadas · {cobertura.testadas} com teste ·{" "}
          {recurso.testes.length} testes
        </dd>
      </dl>

      {recurso.colunas.length > 0 && (
        <div className="rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Coluna</th>
                <th>Descrição</th>
                <th>Testes</th>
              </tr>
            </thead>
            <tbody>
              {recurso.colunas.map((c) => (
                <tr key={c.nome}>
                  <td className="codigo">{c.nome}</td>
                  <td>{c.descricao || <em className="vazio">sem descrição</em>}</td>
                  <td>
                    {c.testes.map((t) => (
                      <span key={t} className="selo teste">
                        {t}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recurso.testes.some((t) => !t.coluna) && (
        <p className="nota">
          Testes da tabela inteira:{" "}
          {recurso.testes
            .filter((t) => !t.coluna)
            .map((t) => t.nome)
            .join(", ")}
        </p>
      )}
    </article>
  );
}

export default function Catalogo() {
  const { dados, erro, carregando } = useApi<Recurso[]>("/catalogo");
  const resumo = useApi<Resumo>("/governanca/resumo");
  const [busca, setBusca] = useState("");
  const [camada, setCamada] = useState("todas");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados ?? []).filter(
      (r) =>
        (camada === "todas" || r.camada === camada) &&
        (!termo ||
          r.nome.toLowerCase().includes(termo) ||
          r.descricao.toLowerCase().includes(termo) ||
          r.colunas.some((c) => c.nome.includes(termo))),
    );
  }, [dados, busca, camada]);

  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <p className="estado erro">Não foi possível carregar: {erro}</p>;

  const camadas = ORDEM_CAMADAS.filter((c) => dados.some((r) => r.camada === c));
  const atual = dados.find((r) => r.id === selecionado) ?? filtrados[0];

  const r = resumo.dados;
  const achado = r
    ? `${r.com_dono === r.recursos ? "Todas as" : `${r.com_dono} de`} ${r.recursos} tabelas têm dono e ${formatarNumero(r.pct_colunas_documentadas, 0)}% das colunas estão documentadas. Os testes de qualidade cobrem ${formatarNumero(r.pct_colunas_testadas, 0)}% das colunas: é aí que dá para melhorar.`
    : null;

  return (
    <>
      <TituloTela titulo="Catálogo" achado={achado}>
        <Explica titulo="Por que isso importa?">
          <p>
            <Termo id="governanca">Governança</Termo> é saber o que existe nos dados, quem responde por cada
            tabela e o que cada coluna significa. Sem isso, cada pessoa interpreta um número de um jeito.
          </p>
          <p>
            Tudo aqui é lido automaticamente da documentação do <Termo id="dbt">dbt</Termo> a cada execução,
            então o catálogo nunca fica desatualizado.
          </p>
        </Explica>
      </TituloTela>
      {r && <ResumoGovernanca dados={r} />}
      <section className="secao" aria-labelledby="tabelas-titulo">
        <div className="secao-topo">
          <h2 id="tabelas-titulo">Tabelas, colunas e testes</h2>
          <p>{dados.length} itens. Escolha um para ver as colunas.</p>
        </div>
        <div className="filtros">
          <input
            type="search"
            aria-label="Buscar no catálogo"
            placeholder="Buscar tabela, coluna ou descrição"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select value={camada} onChange={(e) => setCamada(e.target.value)} aria-label="Camada">
            <option value="todas">Todas as camadas</option>
            {camadas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="catalogo">
          <ul className="lista">
            {filtrados.map((r) => (
              <li key={r.id}>
                <button
                  className={atual?.id === r.id ? "ativo" : undefined}
                  onClick={() => setSelecionado(r.id)}
                >
                  <span className={`ponto camada-${r.camada}`} aria-hidden />
                  <span className="lista-nome">{r.nome}</span>
                  <span className="lista-tipo">{ROTULO_TIPO[r.tipo]}</span>
                </button>
              </li>
            ))}
            {filtrados.length === 0 && <li className="vazio">Nada encontrado.</li>}
          </ul>
          {atual && <Detalhe recurso={atual} />}
        </div>
      </section>
    </>
  );
}
