-- Silver: tipagem, deduplicação e enriquecimento com o catálogo de séries.

with origem as (

    select * from {{ source('bronze', 'sgs_observacoes') }}

),

tipado as (

    select
        serie_id,
        data_referencia,
        safe_cast(replace(trim(valor_texto), ',', '.') as numeric) as valor,
        ingerido_em
    from origem

),

deduplicado as (

    select *
    from tipado
    qualify row_number() over (
        partition by serie_id, data_referencia
        order by ingerido_em desc
    ) = 1

)

select
    d.serie_id,
    s.nome_serie,
    s.unidade,
    s.periodicidade,
    d.data_referencia,
    d.valor,
    d.ingerido_em
from deduplicado as d
left join {{ ref('series_sgs') }} as s
    using (serie_id)
