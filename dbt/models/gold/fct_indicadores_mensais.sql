-- Gold: uma linha por mês com os indicadores lado a lado e o IPCA acumulado em 12 meses.

with base as (

    select
        nome_serie,
        date_trunc(data_referencia, month) as mes,
        valor
    from {{ ref('stg_sgs__observacoes') }}

),

mensal as (

    select
        mes,
        avg(if(nome_serie = 'selic_meta', valor, null)) as selic_meta_media,
        avg(if(nome_serie = 'dolar_compra', valor, null)) as dolar_compra_medio,
        max(if(nome_serie = 'ipca_mensal', valor, null)) as ipca_mensal,
        max(if(nome_serie = 'igpm_mensal', valor, null)) as igpm_mensal
    from base
    group by mes

),

acumulado as (

    select
        *,
        count(ipca_mensal) over janela_12m as meses_ipca_na_janela,
        exp(sum(ln(1 + cast(ipca_mensal as float64) / 100)) over janela_12m)
            as fator_ipca_12m
    from mensal
    window janela_12m as (order by mes rows between 11 preceding and current row)

)

select
    mes,
    round(selic_meta_media, 2) as selic_meta_media,
    round(dolar_compra_medio, 4) as dolar_compra_medio,
    ipca_mensal,
    igpm_mensal,
    -- Só calcula o acumulado quando a janela tem os 12 meses completos.
    if(
        meses_ipca_na_janela = 12,
        round((fator_ipca_12m - 1) * 100, 2),
        null
    ) as ipca_acumulado_12m
from acumulado
