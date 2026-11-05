import json
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from include import bq_loader, sgs


def test_janela_historico_respeita_limite_da_api():
    inicio, fim = sgs.janela_historico(date(2026, 11, 5), anos=15)
    assert fim == date(2026, 11, 5)
    assert inicio == date(2016, 11, 5)


def test_janela_historico_em_29_de_fevereiro():
    inicio, _ = sgs.janela_historico(date(2024, 2, 29), anos=1)
    assert inicio == date(2023, 2, 28)


def test_janela_historico_rejeita_anos_invalidos():
    with pytest.raises(ValueError):
        sgs.janela_historico(date(2026, 1, 1), anos=0)


def test_montar_parametros_formata_datas_no_padrao_do_sgs():
    params = sgs.montar_parametros(date(2021, 1, 5), date(2026, 11, 5))
    assert params == {"formato": "json", "dataInicial": "05/01/2021", "dataFinal": "05/11/2026"}


def test_montar_parametros_rejeita_janela_invertida():
    with pytest.raises(ValueError):
        sgs.montar_parametros(date(2026, 1, 2), date(2026, 1, 1))


def test_normalizar_converte_para_o_schema_da_bronze():
    ingerido = datetime(2026, 11, 5, 9, 0, tzinfo=UTC)
    registros = [{"data": "01/10/2026", "valor": "0.45"}, {"data": "01/09/2026", "valor": "0.48"}]

    linhas = sgs.normalizar(433, registros, ingerido_em=ingerido)

    assert linhas[0] == {
        "serie_id": 433,
        "data_referencia": "2026-10-01",
        "valor_texto": "0.45",
        "ingerido_em": "2026-11-05T09:00:00+00:00",
    }
    assert len(linhas) == 2


def test_caminho_bruto_particiona_por_data():
    caminho = sgs.caminho_bruto(Path("/dados"), date(2026, 11, 5), 432)
    assert caminho == Path("/dados/raw/sgs/dt=2026-11-05/serie_432.ndjson")


def test_baixar_serie_rejeita_resposta_que_nao_e_lista():
    class RespostaFalsa:
        def raise_for_status(self):
            pass

        def json(self):
            return {"erro": "intervalo inválido"}

    class SessaoFalsa:
        def get(self, url, params, timeout):
            assert "bcdata.sgs.432" in url
            return RespostaFalsa()

    with pytest.raises(ValueError):
        sgs.baixar_serie(432, date(2026, 1, 1), date(2026, 1, 31), session=SessaoFalsa())


def test_salvar_e_concatenar_ndjson(tmp_path):
    a = sgs.salvar_ndjson([{"serie_id": 1}, {"serie_id": 2}], tmp_path / "a" / "a.ndjson")
    b = sgs.salvar_ndjson([{"serie_id": 3}], tmp_path / "b.ndjson")

    destino = tmp_path / "todos.ndjson"
    total = bq_loader.concatenar([a, b], destino)

    assert total == 3
    linhas = [json.loads(linha) for linha in destino.read_text(encoding="utf-8").splitlines()]
    assert [linha["serie_id"] for linha in linhas] == [1, 2, 3]
