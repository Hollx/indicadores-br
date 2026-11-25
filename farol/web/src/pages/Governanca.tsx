import { Cartao } from "../componentes";
import { Termo } from "../glossario";
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

/** Indicadores de governança: o que está documentado, tem dono e é testado. */
export default function ResumoGovernanca({ dados }: { dados: Resumo }) {
  return (
    <>
      <div className="cartoes">
        <Cartao rotulo="Tabelas e fontes" valor={String(dados.recursos)} detalhe="no banco de dados" />
        <Cartao
          rotulo="Com dono definido"
          valor={`${dados.com_dono} de ${dados.recursos}`}
          detalhe="quem responde por ela"
        />
        <Cartao
          rotulo="Colunas documentadas"
          valor={fmt(dados.pct_colunas_documentadas)}
          detalhe={`das ${dados.colunas} colunas`}
        />
        <Cartao
          rotulo={<Termo id="teste">Testes de qualidade</Termo>}
          valor={String(dados.testes)}
          detalhe={`${fmt(dados.pct_colunas_testadas)} das colunas com teste`}
        />
      </div>

      <div className="painel">
        <header className="painel-topo">
          <div>
            <h2>Documentação por camada</h2>
            <p>
              Quanto das colunas de cada camada tem uma descrição escrita, para qualquer pessoa entender o que
              significa.
            </p>
          </div>
        </header>
        <div className="rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Camada</th>
                <th className="num">Tabelas</th>
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
                      <span className="num">{fmt(c.pct_documentadas)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
