import { useMemo, useState } from "react";

import { useApi } from "../api";
import { Cartao, Indisponivel, Painel, TituloTela } from "../componentes";
import { Explica, Termo } from "../glossario";
import GraficoBarras from "../graficos/GraficoBarras";
import GraficoLinhas from "../graficos/GraficoLinhas";
import { data, formatarNumero, rotuloMes } from "../graficos/escalas";
import type { Expectativas, LinhaIndicadores } from "../tipos";

function ultimo(linhas: LinhaIndicadores[], campo: keyof LinhaIndicadores) {
  for (let i = linhas.length - 1; i >= 0; i--) {
    const v = linhas[i][campo];
    if (typeof v === "number") return { valor: v, mes: linhas[i].mes };
  }
  return { valor: null as number | null, mes: null as string | null };
}

const mesDe = (m: string | null) => (m ? rotuloMes(data(m)) : "—");

function SerieHistorica({ dados }: { dados: LinhaIndicadores[] }) {
  const selic = ultimo(dados, "selic_meta_media");
  const ipca = ultimo(dados, "ipca_acumulado_12m");
  const dolar = ultimo(dados, "dolar_compra_medio");
  const igpm = ultimo(dados, "igpm_mensal");
  const juroReal = selic.valor !== null && ipca.valor !== null ? selic.valor - ipca.valor : null;

  return (
    <>
      <div className="cartoes">
        <Cartao
          rotulo={<Termo id="selic">Juros (Selic)</Termo>}
          valor={
            <>
              {formatarNumero(selic.valor)}
              <small>% ao ano</small>
            </>
          }
          detalhe={`média de ${mesDe(selic.mes)}`}
        />
        <Cartao
          rotulo={<Termo id="ipca">Inflação em 12 meses</Termo>}
          valor={
            <>
              {formatarNumero(ipca.valor)}
              <small>%</small>
            </>
          }
          detalhe={`IPCA até ${mesDe(ipca.mes)}`}
        />
        <Cartao
          rotulo="Juro real"
          valor={
            <>
              {formatarNumero(juroReal)}
              <small>pontos</small>
            </>
          }
          detalhe="Selic menos a inflação de 12 meses"
        />
        <Cartao
          rotulo={<Termo id="igpm">IGP-M no mês</Termo>}
          valor={
            <>
              {formatarNumero(igpm.valor)}
              <small>%</small>
            </>
          }
          detalhe={mesDe(igpm.mes)}
        />
        <Cartao
          rotulo="Dólar"
          valor={
            <>
              <small>R$</small> {formatarNumero(dolar.valor)}
            </>
          }
          detalhe={`média de ${mesDe(dolar.mes)}`}
        />
      </div>

      <div className="grade-2">
        <Painel
          titulo="Os juros estão acima da inflação?"
          descricao="Quando a linha da Selic fica acima da inflação, o dinheiro aplicado rende mais do que os preços sobem."
        >
          <GraficoLinhas
            unidade="%"
            series={[
              {
                nome: "Selic (% ao ano)",
                cor: "var(--chart-1)",
                pontos: dados.map((l) => ({ x: l.mes, y: l.selic_meta_media })),
              },
              {
                nome: "Inflação em 12 meses (%)",
                cor: "var(--chart-3)",
                pontos: dados.map((l) => ({ x: l.mes, y: l.ipca_acumulado_12m })),
              },
            ]}
          />
        </Painel>
        <Painel titulo="Quanto custa um dólar?" descricao="Média do mês da cotação de compra, em reais.">
          <GraficoLinhas
            series={[
              {
                nome: "Dólar (R$)",
                cor: "var(--chart-1)",
                pontos: dados.map((l) => ({ x: l.mes, y: l.dolar_compra_medio })),
              },
            ]}
          />
        </Painel>
      </div>
      <Painel
        titulo="Os preços subiram quanto em cada mês?"
        descricao="O IPCA mede a inflação do consumidor; o IGP-M, usado em aluguéis, oscila mais porque inclui preços no atacado. Abaixo de zero, os preços caíram."
      >
        <GraficoLinhas
          unidade="%"
          linhaZero
          series={[
            {
              nome: "IPCA (%)",
              cor: "var(--chart-1)",
              pontos: dados.map((l) => ({ x: l.mes, y: l.ipca_mensal })),
            },
            {
              nome: "IGP-M (%)",
              cor: "var(--chart-3)",
              pontos: dados.map((l) => ({ x: l.mes, y: l.igpm_mensal })),
            },
          ]}
        />
      </Painel>
    </>
  );
}

const HORIZONTES = [0, 1, 3, 6, 12];
const rotuloHorizonte = (h: number) =>
  h === 0 ? "no próprio mês" : `${h} ${h === 1 ? "mês" : "meses"} antes`;

function ExpectativaRealizado() {
  const [indicador, setIndicador] = useState("IPCA");
  const [horizonte, setHorizonte] = useState(1);
  const { dados, erro, carregando } = useApi<Expectativas>(`/dados/expectativas?indicador=${indicador}`);

  const serie = useMemo(() => {
    const limite = new Date();
    limite.setFullYear(limite.getFullYear() + 1);
    const corte = limite.toISOString().slice(0, 10);
    return (dados?.serie ?? []).filter((l) => l.horizonte_meses === horizonte && l.mes_referencia <= corte);
  }, [dados, horizonte]);

  const resumo = dados?.erro_por_horizonte.find((e) => e.horizonte_meses === horizonte);

  const controles = (
    <div className="controles">
      <select
        value={indicador}
        onChange={(e) => setIndicador(e.target.value)}
        aria-label="Índice de inflação"
      >
        <option value="IPCA">IPCA</option>
        <option value="IGP-M">IGP-M</option>
      </select>
      <div className="segmentado" role="group" aria-label="Quando a previsão foi feita">
        {HORIZONTES.map((h) => (
          <button
            key={h}
            className={h === horizonte ? "ativo" : undefined}
            onClick={() => setHorizonte(h)}
            aria-pressed={h === horizonte}
          >
            {rotuloHorizonte(h)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="secao" aria-labelledby="focus-titulo">
      <div className="secao-topo">
        <h2 id="focus-titulo">O mercado acerta a inflação?</h2>
      </div>
      <p className="nota">
        Toda semana, bancos e consultorias dizem ao Banco Central quanto acham que a inflação vai ser (o{" "}
        <Termo id="focus">Boletim Focus</Termo>). Aqui a previsão é comparada com o que aconteceu.
      </p>
      {carregando ? (
        <p className="estado">Carregando…</p>
      ) : erro || !dados ? (
        <Indisponivel erro={erro} oQue="A comparação com o Boletim Focus" />
      ) : (
        <>
          <Painel
            titulo={`${indicador}: previsão feita ${rotuloHorizonte(horizonte)} x o que aconteceu`}
            descricao={
              resumo
                ? `Nesse prazo, a previsão errou em média ${formatarNumero(resumo.erro_absoluto_medio)} ponto percentual, e o valor real ficou dentro da faixa das previsões em ${formatarNumero(resumo.pct_dentro_intervalo, 0)}% dos ${resumo.meses} meses.`
                : undefined
            }
            acao={controles}
          >
            <GraficoLinhas
              unidade="%"
              linhaZero
              faixa={{
                nome: "Da menor à maior previsão",
                cor: "var(--chart-1)",
                pontos: serie.map((l) => ({
                  x: l.mes_referencia,
                  y0: l.minimo_esperado,
                  y1: l.maximo_esperado,
                })),
              }}
              series={[
                {
                  nome: "Previsão do mercado (mediana)",
                  cor: "var(--chart-1)",
                  tracejada: true,
                  pontos: serie.map((l) => ({ x: l.mes_referencia, y: l.mediana_esperada })),
                },
                {
                  nome: "O que aconteceu",
                  cor: "var(--text)",
                  pontos: serie.map((l) => ({ x: l.mes_referencia, y: l.realizado })),
                },
              ]}
            />
          </Painel>
          <Painel
            titulo="Quanto mais distante, maior o erro?"
            descricao="Erro médio da previsão (em pontos percentuais) conforme a antecedência com que ela foi feita. A barra destacada é o prazo escolhido acima."
          >
            <GraficoBarras
              rotuloX="meses de antecedência da previsão"
              barras={dados.erro_por_horizonte.map((e) => ({
                rotulo: String(e.horizonte_meses),
                valor: e.erro_absoluto_medio,
                destaque: e.horizonte_meses === horizonte,
                cor: e.horizonte_meses === horizonte ? "var(--chart-1)" : "var(--chart-cinza)",
                dica: `${rotuloHorizonte(e.horizonte_meses)}: erro médio de ${formatarNumero(e.erro_absoluto_medio)} p.p.; ${formatarNumero(e.pct_dentro_intervalo, 0)}% dentro da faixa (${e.meses} meses)`,
              }))}
            />
          </Painel>
        </>
      )}
    </section>
  );
}

export default function Indicadores() {
  const { dados, erro, carregando } = useApi<LinhaIndicadores[]>("/dados/indicadores");
  const selic = dados ? ultimo(dados, "selic_meta_media") : null;
  const ipca = dados ? ultimo(dados, "ipca_acumulado_12m") : null;
  const achado =
    selic?.valor != null && ipca?.valor != null
      ? `Os juros estão em ${formatarNumero(selic.valor)}% ao ano e a inflação de 12 meses em ${formatarNumero(ipca.valor)}%. Descontada a inflação, o juro real é de ${formatarNumero(selic.valor - ipca.valor)} pontos.`
      : null;

  return (
    <>
      <TituloTela titulo="Indicadores" achado={achado}>
        <Explica titulo="De onde vêm esses números?">
          <p>
            Todos os dias o pipeline busca no Banco Central a <Termo id="selic">Selic</Termo>, o{" "}
            <Termo id="ipca">IPCA</Termo>, o <Termo id="igpm">IGP-M</Termo> e o dólar, e as previsões do{" "}
            <Termo id="focus">Boletim Focus</Termo>. Os gráficos leem a camada <Termo id="gold">Gold</Termo>,
            a versão final e testada dos dados.
          </p>
          <p>Passe o mouse sobre um gráfico para ver o valor de cada mês.</p>
        </Explica>
      </TituloTela>
      {carregando ? (
        <p className="estado">Carregando…</p>
      ) : erro || !dados ? (
        <Indisponivel erro={erro} oQue="A série de indicadores" />
      ) : (
        <SerieHistorica dados={dados} />
      )}
      <ExpectativaRealizado />
    </>
  );
}
