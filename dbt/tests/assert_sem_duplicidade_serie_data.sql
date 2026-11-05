-- A Silver deve ter no máximo uma observação por série e data.
select
    serie_id,
    data_referencia,
    count(*) as ocorrencias
from {{ ref('stg_sgs__observacoes') }}
group by serie_id, data_referencia
having count(*) > 1
