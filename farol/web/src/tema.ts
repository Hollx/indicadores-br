import { useEffect, useState } from "react";

/** Preferência de tema: segue o sistema ("auto") ou fixa claro/escuro. Guardada só neste navegador. */
export type Preferencia = "auto" | "claro" | "escuro";
export type Efetivo = "claro" | "escuro";

const CHAVE = "farol-tema";
const EVENTO = "farol-tema";
const midia = () => window.matchMedia("(prefers-color-scheme: dark)");

export function lerPreferencia(): Preferencia {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "claro" || v === "escuro" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function efetivo(pref: Preferencia): Efetivo {
  if (pref !== "auto") return pref;
  return midia().matches ? "escuro" : "claro";
}

export function aplicar(pref: Preferencia) {
  const raiz = document.documentElement;
  if (pref === "auto") raiz.removeAttribute("data-tema");
  else raiz.setAttribute("data-tema", pref);
  try {
    if (pref === "auto") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, pref);
  } catch {
    /* navegação privada: o tema vale só nesta visita */
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Tema em uso agora, atualizado quando a pessoa troca ou quando o sistema muda. */
export function useTema(): { preferencia: Preferencia; efetivo: Efetivo } {
  const [preferencia, setPreferencia] = useState<Preferencia>(lerPreferencia);
  const [, forcar] = useState(0);
  useEffect(() => {
    const atualizar = () => {
      setPreferencia(lerPreferencia());
      forcar((n) => n + 1);
    };
    const m = midia();
    window.addEventListener(EVENTO, atualizar);
    m.addEventListener("change", atualizar);
    return () => {
      window.removeEventListener(EVENTO, atualizar);
      m.removeEventListener("change", atualizar);
    };
  }, []);
  return { preferencia, efetivo: efetivo(preferencia) };
}
