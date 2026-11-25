import { useEffect, useRef, useState } from "react";

/** Largura do contêiner, atualizada quando a tela muda (gráficos responsivos). */
export function useLargura<T extends HTMLElement>(inicial = 640) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    if (!ref.current) return;
    const observador = new ResizeObserver(([entrada]) => setLargura(Math.floor(entrada.contentRect.width)));
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, []);
  return [ref, largura] as const;
}
