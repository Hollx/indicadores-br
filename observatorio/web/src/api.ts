import { useEffect, useState } from "react";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

type Estado<T> = { dados: T | null; erro: string | null; carregando: boolean };

/** GET simples na API do Observatório, com estado de carregamento e erro. */
export function useApi<T>(caminho: string): Estado<T> {
  const [estado, setEstado] = useState<Estado<T>>({ dados: null, erro: null, carregando: true });

  useEffect(() => {
    const controle = new AbortController();
    setEstado({ dados: null, erro: null, carregando: true });
    fetch(`${BASE}${caminho}`, { signal: controle.signal })
      .then(async (resposta) => {
        if (!resposta.ok) {
          const corpo = await resposta.json().catch(() => ({}));
          throw new Error(corpo.detail ?? `HTTP ${resposta.status}`);
        }
        return resposta.json() as Promise<T>;
      })
      .then((dados) => setEstado({ dados, erro: null, carregando: false }))
      .catch((erro: Error) => {
        if (erro.name !== "AbortError") setEstado({ dados: null, erro: erro.message, carregando: false });
      });
    return () => controle.abort();
  }, [caminho]);

  return estado;
}

export const ROTULO_TIPO: Record<string, string> = {
  source: "fonte",
  seed: "seed",
  model: "modelo",
  snapshot: "snapshot",
  exposure: "exposição",
};

export const ORDEM_CAMADAS = ["fonte", "bronze", "silver", "gold", "consumo"];
