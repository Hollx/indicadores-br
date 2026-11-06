---
title: Indicadores econômicos do Brasil
---

Selic, inflação (IPCA e IGP-M) e dólar, mês a mês. Os dados vêm da API SGS do Banco Central,
passam pelo pipeline diário (Airflow, dbt e BigQuery) e chegam aqui a partir da camada Gold
(`gold.fct_indicadores_mensais`). O código está em
[github.com/Hollx/indicadores-br](https://github.com/Hollx/indicadores-br).

```sql ultimo_mes
-- Último mês com cada indicador preenchido (IPCA e IGP-M saem com defasagem).
select
  max(mes) as mes_mais_recente,
  array_agg(selic_meta_media ignore nulls order by mes desc limit 1)[offset(0)] as selic,
  array_agg(dolar_compra_medio ignore nulls order by mes desc limit 1)[offset(0)] as dolar,
  array_agg(ipca_acumulado_12m ignore nulls order by mes desc limit 1)[offset(0)] as ipca_12m,
  array_agg(igpm_mensal ignore nulls order by mes desc limit 1)[offset(0)] as igpm_mes
from gold.fct_indicadores_mensais
```

{% row %}
{% big_value data="ultimo_mes" value="max(selic)" title="Selic meta (% a.a.)" fmt="num2" /%}
{% big_value data="ultimo_mes" value="max(ipca_12m)" title="IPCA em 12 meses (%)" fmt="num2" /%}
{% big_value data="ultimo_mes" value="max(igpm_mes)" title="IGP-M no mês (%)" fmt="num2" /%}
{% big_value data="ultimo_mes" value="max(dolar)" title="Dólar médio (R$)" fmt="num4" /%}
{% /row %}

## Juros e inflação

A meta da Selic contra o IPCA acumulado em 12 meses: a distância entre as duas linhas é,
grosso modo, o juro real.

```sql juros_inflacao
select mes, 'Selic meta (média do mês)' as indicador, selic_meta_media as valor
from gold.fct_indicadores_mensais
where selic_meta_media is not null
union all
select mes, 'IPCA acumulado em 12 meses', ipca_acumulado_12m
from gold.fct_indicadores_mensais
where ipca_acumulado_12m is not null
```

{% line_chart
  data="juros_inflacao"
  x="mes"
  y="max(valor)"
  series="indicador"
  date_grain="month"
  y_fmt="num1"
  title="Selic x IPCA 12 meses"
  subtitle="% ao ano"
/%}

## Inflação mensal: IPCA x IGP-M

```sql inflacao_mensal
select mes, 'IPCA' as indice, ipca_mensal as variacao
from gold.fct_indicadores_mensais
where ipca_mensal is not null
union all
select mes, 'IGP-M', igpm_mensal
from gold.fct_indicadores_mensais
where igpm_mensal is not null
```

{% line_chart
  data="inflacao_mensal"
  x="mes"
  y="max(variacao)"
  series="indice"
  date_grain="month"
  y_fmt="num2"
  title="Variação mensal"
  subtitle="% no mês"
/%}

## Câmbio

{% line_chart
  data="gold.fct_indicadores_mensais"
  x="mes"
  y="max(dolar_compra_medio)"
  date_grain="month"
  y_fmt="num2"
  title="Dólar comercial (compra)"
  subtitle="Média mensal, R$ por US$"
/%}

## Dados

{% table data="gold.fct_indicadores_mensais" order="mes desc" limit=24 /%}
