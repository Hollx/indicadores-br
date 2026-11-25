import { useMemo, useState } from "react";

import { Cartao, Indisponivel, Painel } from "../componentes";
import { useApi } from "../api";
import GraficoBarras from "../graficos/GraficoBarras";
import GraficoLinhas from "../graficos/GraficoLinhas";
import { data, formatarNumero, rotuloMes } from "../graficos/escalas";
import type { Expectativas, LinhaIndicadores } from "../tipos";

function ultimo<T>(linhas: T[], campo: keyof T): { valor: number | null; mes: string | null } {
  for (let i = linhas.length - 1; i >= 0; i--) {
    const v = linhas[i][campo] as unknown as number | null;
    if (v !== null && v !== undefined) return { valor: v, mes: (linhas[i] as { mes: string }).mes };
  }
  return { valor: null, mes: null };
}

function SerieHistorica() {
  const { dados, erro, carregando } = useApi<LinhaIndicadores[]>("/dados/indicadores");
  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <Indisponivel erro={erro} />;

  const selic = ultimo(dados, "selic_meta_media");
  const ipca = ultimo(dados, "ipca_acumulado_12m");
  const dolar = ultimo(dados, "dolar_compra_medio");
  const igpm = ultimo(dados, "igpm_mensal");
  const juroReal = selic.valor !== null && ipca.valor !== null ? selic.valor - ipca.valor : null;
  const mes = (m: string | null) => (m ? rotuloMes(data(m)) : "");

  return (
    <>
      <div className="cartoes">
        <Cartao
          rotulo="Selic meta"
          valor={`${formatarNumero(selic.valor)}%`}
          detalhe={`média de ${mes(selic.mes)}`}
        />
        <Cartao rotulo="IPCA 12 meses" valor={`${formatarNumero(ipca.valor)}%`} detalhe={mes(ipca.mes)} />
        <Cartao
          rotulo="Juro real"
          valor={`${formatarNumero(juroReal)} p.p.`}
          detalhe="Selic menos IPCA 12 meses"
        />
        <Cartao rotulo="IGP-M no mês" valor={`${formatarNumero(igpm.valor)}%`} detalhe={mes(igpm.mes)} />
        <Cartao
          rotulo="Dólar"
          valor={`R$ ${formatarNumero(dolar.valor)}`}
          detalhe={`média de ${mes(dolar.mes)}`}
        />
      </div>

      <div className="grade-2">
        <Painel titulo="Selic x IPCA em 12 meses (% a.a.)">
          <GraficoLinhas
            unidade="%"
            series={[
              {
                nome: "Selic meta",
                cor: "var(--serie-1)",
                pontos: dados.map((l) => ({ x: l.mes, y: l.selic_meta_media })),
              },
              {
                nome: "IPCA 12 meses",
                cor: "var(--serie-2)",
                pontos: dados.map((l) => ({ x: l.mes, y: l.ipca_acumulado_12m })),
              },
            ]}
          />
        </Painel>
        <Painel titulo="Dólar comercial (R$, média do mês)">
          <GraficoLinhas
            series={[
              {
                nome: "Dólar",
                cor: "var(--serie-3)",
                pontos: dados.map((l) => ({ x: l.mes, y: l.dolar_compra_medio })),
              },
            ]}
          />
        </Painel>
      </div>
      <Painel titulo="Inflação no mês: IPCA x IGP-M (%)">
        <GraficoLinhas
          unidade="%"
          linhaZero
          series={[
            {
              nome: "IPCA",
              cor: "var(--serie-2)",
              pontos: dados.map((l) => ({ x: l.mes, y: l.ipca_mensal })),
            },
            {
              nome: "IGP-M",
              cor: "var(--serie-4)",
              pontos: dados.map((l) => ({ x: l.mes, y: l.igpm_mensal })),
            },
          ]}
        />
      </Painel>
    </>
  );
}

const HORIZONTES = [0, 1, 3, 6, 12];

function ExpectativaRealizado() {
  const [indicador, setIndicador] = useState("IPCA");
  const [horizonte, setHorizonte] = useState(1);
  const { dados, erro, carregando } = useApi<Expectativas>(`/dados/expectativas?indicador=${indicador}`);

  const serie = useMemo(
    () =>
      (dados?.serie ?? []).filter(
        (l) => l.horizonte_meses === horizonte && l.mes_referencia <= hojeMaisUmAno(),
      ),
    [dados, horizonte],
  );

  const controles = (
    <div className="controles">
      <select value={indicador} onChange={(e) => setIndicador(e.target.value)} aria-label="Indicador">
        <option value="IPCA">IPCA</option>
        <option value="IGP-M">IGP-M</option>
      </select>
      <div className="segmentado" role="group" aria-label="Antecedência da projeção">
        {HORIZONTES.map((h) => (
          <button key={h} className={h === horizonte ? "ativo" : undefined} onClick={() => setHorizonte(h)}>
            {h === 0 ? "no mês" : `${h} ${h === 1 ? "mês" : "meses"} antes`}
          </button>
        ))}
      </div>
    </div>
  );

  if (carregando)
    return (
      <Painel titulo="Expectativa do mercado x realizado" acao={controles}>
        <p className="estado">Carregando…</p>
      </Painel>
    );
  if (erro || !dados)
    return (
      <Painel titulo="Expectativa do mercado x realizado" acao={controles}>
        <Indisponivel erro={erro} />
      </Painel>
    );

  const resumo = dados.erro_por_horizonte.find((e) => e.horizonte_meses === horizonte);

  return (
    <>
      <Painel titulo={`Expectativa do mercado x realizado: ${indicador} no mês (%)`} acao={controles}>
        <p className="nota">
          Linha tracejada: mediana das projeções do Boletim Focus feitas{" "}
          {horizonte === 0
            ? "durante o próprio mês"
            : `${horizonte} ${horizonte === 1 ? "mês" : "meses"} antes`}
          . Faixa: da menor à maior projeção. Linha cheia: o que aconteceu.
          {resumo &&
            ` Nesse horizonte, o erro médio absoluto foi de ${formatarNumero(resumo.erro_absoluto_medio)} p.p. e o realizado caiu dentro da faixa em ${formatarNumero(resumo.pct_dentro_intervalo, 0)}% dos ${resumo.meses} meses.`}
        </p>
        <GraficoLinhas
          unidade="%"
          linhaZero
          faixa={{
            nome: "Faixa das projeções",
            cor: "var(--serie-1)",
            pontos: serie.map((l) => ({ x: l.mes_referencia, y0: l.minimo_esperado, y1: l.maximo_esperado })),
          }}
          series={[
            {
              nome: "Mediana esperada",
              cor: "var(--serie-1)",
              tracejada: true,
              pontos: serie.map((l) => ({ x: l.mes_referencia, y: l.mediana_esperada })),
            },
            {
              nome: "Realizado",
              cor: "var(--serie-2)",
              pontos: serie.map((l) => ({ x: l.mes_referencia, y: l.realizado })),
            },
          ]}
        />
      </Painel>
      <Painel titulo={`Quanto o mercado erra o ${indicador}, por antecedência`}>
        <p className="nota">
          Erro médio absoluto (p.p.) entre a mediana esperada e o realizado. Quanto mais longe, maior o erro?
        </p>
        <GraficoBarras
          rotuloX="meses de antecedência da projeção"
          barras={dados.erro_por_horizonte.map((e) => ({
            rotulo: String(e.horizonte_meses),
            valor: e.erro_absoluto_medio,
            destaque: e.horizonte_meses === horizonte,
            dica: `${e.horizonte_meses} meses antes: erro médio absoluto ${formatarNumero(e.erro_absoluto_medio)} p.p., viés ${formatarNumero(e.erro_medio)} p.p., ${formatarNumero(e.pct_dentro_intervalo, 0)}% dentro da faixa (${e.meses} meses)`,
          }))}
        />
      </Painel>
    </>
  );
}

function hojeMaisUmAno(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Indicadores() {
  return (
    <section>
      <h1>Indicadores</h1>
      <p className="subtitulo">
        Selic, inflação e dólar mês a mês, e quanto o mercado acerta a inflação. Dados da camada Gold no
        BigQuery, servidos pela API do Farol.
      </p>
      <SerieHistorica />
      <ExpectativaRealizado />
    </section>
  );
}
