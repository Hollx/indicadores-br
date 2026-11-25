import { useApi } from "../api";
import { Cartao } from "../componentes";
import type { Resumo } from "../tipos";

function Barra({ pct }: { pct: number | null }) {
  const valor = pct ?? 0;
  return (
    <div className="barra" role="meter" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100}>
      <div className="barra-preenchida" style={{ width: `${valor}%` }} />
    </div>
  );
}

const fmt = (pct: number | null) => (pct === null ? "—" : `${pct.toLocaleString("pt-BR")}%`);

export default function Governanca() {
  const { dados, erro, carregando } = useApi<Resumo>("/governanca/resumo");
  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <p className="estado erro">Não foi possível carregar: {erro}</p>;

  return (
    <section>
      <h1>Governança</h1>
      <p className="subtitulo">
        Quanto do pipeline está documentado, tem dono e é coberto por testes. Lido do manifest do dbt a cada
        execução.
      </p>
      <div className="cartoes">
        <Cartao
          rotulo="Tabelas e fontes"
          valor={String(dados.recursos)}
          detalhe={`${dados.exposicoes} exposição`}
        />
        <Cartao rotulo="Com dono" valor={`${dados.com_dono}/${dados.recursos}`} />
        <Cartao
          rotulo="Testes de qualidade"
          valor={String(dados.testes)}
          detalhe={`${dados.com_testes} tabelas cobertas`}
        />
        <Cartao
          rotulo="Colunas documentadas"
          valor={fmt(dados.pct_colunas_documentadas)}
          detalhe={`de ${dados.colunas} colunas`}
        />
        <Cartao rotulo="Colunas com teste" valor={fmt(dados.pct_colunas_testadas)} />
      </div>

      <h2>Documentação por camada</h2>
      <table className="tabela">
        <thead>
          <tr>
            <th>Camada</th>
            <th className="num">Recursos</th>
            <th className="num">Colunas</th>
            <th>Documentadas</th>
          </tr>
        </thead>
        <tbody>
          {dados.por_camada.map((c) => (
            <tr key={c.camada}>
              <td>
                <span className={`selo camada-${c.camada}`}>{c.camada}</span>
              </td>
              <td className="num">{c.recursos}</td>
              <td className="num">{c.colunas}</td>
              <td>
                <div className="barra-linha">
                  <Barra pct={c.pct_documentadas} />
                  <span>{fmt(c.pct_documentadas)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
