{#
  Usa o schema configurado (silver, gold) como nome exato do dataset,
  em vez do padrão do dbt "<target>_<custom>". Os datasets são criados pelo Terraform.
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
