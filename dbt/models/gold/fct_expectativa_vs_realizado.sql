-- Gold: o que o mercado esperava para cada mês, em vários horizontes, contra o realizado.
-- Para cada indicador, mês-alvo e horizonte, vale a última pesquisa feita naquele mês.

with ultima_pesquisa_do_mes as (

    select *
    from {{ ref('stg_focus__expectativas_mensais') }}
    where horizonte_meses between 0 and 12
    qualify row_number() over (
        partition by indicador, mes_referencia, horizonte_meses
        order by data_pesquisa desc
    ) = 1

),

realizado as (

    select mes, 'ipca_mensal' as nome_serie, ipca_mensal as valor
    from {{ ref('fct_indicadores_mensais') }}
    union all
    select mes, 'igpm_mensal' as nome_serie, igpm_mensal as valor
    from {{ ref('fct_indicadores_mensais') }}

)

select
    e.indicador,
    e.mes_referencia,
    e.horizonte_meses,
    e.data_pesquisa,
    e.respondentes,
    round(e.mediana, 4) as mediana_esperada,
    round(e.minimo, 4) as minimo_esperado,
    round(e.maximo, 4) as maximo_esperado,
    cast(r.valor as float64) as realizado,
    round(cast(r.valor as float64) - e.mediana, 4) as erro,
    round(abs(cast(r.valor as float64) - e.mediana), 4) as erro_absoluto,
    cast(r.valor as float64) between e.minimo and e.maximo as dentro_do_intervalo
from ultima_pesquisa_do_mes as e
left join realizado as r
    on r.nome_serie = e.nome_serie
    and r.mes = e.mes_referencia
