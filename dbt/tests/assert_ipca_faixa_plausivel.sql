-- Variação mensal do IPCA fora de [-5%, 10%] indica erro de carga ou de parsing.
select
    mes,
    ipca_mensal
from {{ ref('fct_indicadores_mensais') }}
where ipca_mensal is not null
  and (ipca_mensal < -5 or ipca_mensal > 10)
