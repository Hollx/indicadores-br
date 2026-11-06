---
title: Indicadores econômicos do Brasil
---

# Indicadores econômicos do Brasil

Selic, inflação (IPCA e IGP-M) e dólar, mês a mês. Os dados vêm da API SGS do Banco Central,
passam por um pipeline diário (Airflow, dbt e BigQuery) e chegam aqui a partir da camada Gold.
Código em [github.com/Hollx/indicadores-br](https://github.com/Hollx/indicadores-br).

```sql ultimo_mes
-- Último valor de cada indicador (IPCA e IGP-M saem com um ou dois meses de defasagem).
with ultimos as (
  select
    array_agg(struct(mes, selic_meta_media as v) ignore nulls order by mes desc limit 1)[offset(0)] as selic,
    array_agg(if(ipca_acumulado_12m is null, null, struct(mes, ipca_acumulado_12m as v)) ignore nulls order by mes desc limit 1)[offset(0)] as ipca,
    array_agg(if(igpm_mensal is null, null, struct(mes, igpm_mensal as v)) ignore nulls order by mes desc limit 1)[offset(0)] as igpm,
    array_agg(if(dolar_compra_medio is null, null, struct(mes, dolar_compra_medio as v)) ignore nulls order by mes desc limit 1)[offset(0)] as dolar
  from gold.fct_indicadores_mensais
)
select
  selic.v as selic,
  ipca.v as ipca_12m,
  round(selic.v - ipca.v, 2) as juro_real,
  igpm.v as igpm_mes,
  dolar.v as dolar,
  ipca.mes as mes_ipca,
  igpm.mes as mes_igpm,
  selic.mes as mes_selic
from ultimos
```

{% row card=true %}
{% big_value data="ultimo_mes" value="max(selic)" title="Selic meta (% a.a.)" fmt="num2" /%}
{% big_value data="ultimo_mes" value="max(ipca_12m)" title="IPCA em 12 meses (%)" fmt="num2" /%}
{% big_value data="ultimo_mes" value="max(juro_real)" title="Juro real aprox. (p.p.)" fmt="num2" /%}
{% big_value data="ultimo_mes" value="max(igpm_mes)" title="IGP-M no mês (%)" fmt="num2" /%}
{% big_value data="ultimo_mes" value="max(dolar)" title="Dólar médio (R$)" fmt="num2" /%}
{% /row %}

Selic e dólar de {% value data="ultimo_mes" value="max(mes_selic)" fmt="mm/yyyy" /%}; IPCA de
{% value data="ultimo_mes" value="max(mes_ipca)" fmt="mm/yyyy" /%}; IGP-M de
{% value data="ultimo_mes" value="max(mes_igpm)" fmt="mm/yyyy" /%}. O juro real aproximado é a Selic
menos o IPCA dos últimos 12 meses.

## Juros e inflação

A faixa cinza é o intervalo de tolerância da meta de inflação do CMN em cada ano.

```sql juros_inflacao
select mes, 'Selic meta' as indicador, selic_meta_media as valor
from gold.fct_indicadores_mensais
where selic_meta_media is not null
union all
select mes, 'IPCA 12 meses', ipca_acumulado_12m
from gold.fct_indicadores_mensais
where ipca_acumulado_12m is not null
```

{% line_chart
  data="juros_inflacao"
  x="mes"
  y="max(valor)"
  series="indicador"
  series_order=["Selic meta", "IPCA 12 meses"]
  date_grain="month"
  y_fmt="num1"
  title="Selic meta x IPCA acumulado em 12 meses"
  subtitle="% ao ano"
  y_axis_options={ title="% a.a." min=0 }
  chart_options={
    series_colors={
      "Selic meta"="#2a78d6"
      "IPCA 12 meses"="#eb6834"
    }
  }
%}
  {% reference_area x_min="2022-01-01" x_max="2022-12-31" y_min=2 y_max=5 color="gray" /%}
  {% reference_area x_min="2023-01-01" x_max="2023-12-31" y_min=1.75 y_max=4.75 color="gray" /%}
  {% reference_area x_min="2024-01-01" x_max="2026-12-31" y_min=1.5 y_max=4.5 label="Meta 3% ± 1,5" color="gray" /%}
{% /line_chart %}

```sql juro_real
select mes, round(selic_meta_media - ipca_acumulado_12m, 2) as juro_real
from gold.fct_indicadores_mensais
where selic_meta_media is not null and ipca_acumulado_12m is not null
```

{% area_chart
  data="juro_real"
  x="mes"
  y="max(juro_real)"
  date_grain="month"
  y_fmt="num1"
  title="Juro real aproximado"
  subtitle="Selic meta menos IPCA 12 meses, em pontos percentuais"
  y_axis_options={ title="p.p." }
  chart_options={ color_palette=["#2a78d6"] }
/%}

## Inflação mensal: IPCA x IGP-M

O IGP-M pesa preços no atacado e commodities, por isso oscila bem mais que o IPCA.

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
  series_order=["IPCA", "IGP-M"]
  date_grain="month"
  y_fmt="num2"
  title="Variação mensal"
  subtitle="% no mês"
  y_axis_options={ title="% no mês" }
  chart_options={
    series_colors={
      "IPCA"="#2a78d6"
      "IGP-M"="#eb6834"
    }
  }
%}
  {% reference_line y=0 color="gray" /%}
{% /line_chart %}

## Câmbio

{% line_chart
  data="gold.fct_indicadores_mensais"
  x="mes"
  y="max(dolar_compra_medio)"
  date_grain="month"
  y_fmt="num2"
  title="Dólar comercial (compra)"
  subtitle="Média mensal, R$ por US$"
  y_axis_options={ title="R$" fit_to_data=true }
  chart_options={ color_palette=["#2a78d6"] }
/%}

## Dados dos últimos 24 meses

Selic em % ao ano; IPCA e IGP-M em %; dólar em R$ por US$ (média do mês). Traço indica
mês ainda sem divulgação.

```sql tabela
-- Texto formatado com duas casas: o formato automático da tabela arredondaria a Selic para uma.
select
  format_date('%Y-%m', mes) as `Mês`,
  format('%.2f', selic_meta_media) as `Selic meta`,
  format('%.2f', ipca_mensal) as `IPCA no mês`,
  format('%.2f', ipca_acumulado_12m) as `IPCA 12 meses`,
  format('%.2f', igpm_mensal) as `IGP-M no mês`,
  format('%.2f', dolar_compra_medio) as `Dólar médio`
from gold.fct_indicadores_mensais
order by mes desc
limit 24
```

{% table data="tabela"  format_titles=false page_size=12 /%}
