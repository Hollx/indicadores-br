-- Silver: expectativas do Focus deduplicadas, com o nome da série realizada e o horizonte.

with origem as (

    select * from {{ source('bronze', 'focus_expectativas_mensais') }}
    where base_calculo = 0

),

deduplicado as (

    select *
    from origem
    qualify row_number() over (
        partition by indicador, data_pesquisa, mes_referencia
        order by ingerido_em desc
    ) = 1

)

select
    indicador,
    case indicador
        when 'IPCA' then 'ipca_mensal'
        when 'IGP-M' then 'igpm_mensal'
    end as nome_serie,
    data_pesquisa,
    mes_referencia,
    -- Quantos meses antes do mês-alvo a projeção foi feita (0 = durante o próprio mês).
    date_diff(mes_referencia, date_trunc(data_pesquisa, month), month) as horizonte_meses,
    mediana,
    media,
    desvio_padrao,
    minimo,
    maximo,
    respondentes,
    ingerido_em
from deduplicado
