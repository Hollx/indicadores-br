import { useEffect, useState } from "react";

import Catalogo from "./pages/Catalogo";
import Governanca from "./pages/Governanca";
import Linhagem from "./pages/Linhagem";

const PAGINAS = {
  governanca: { titulo: "Governança", componente: Governanca },
  catalogo: { titulo: "Catálogo", componente: Catalogo },
  linhagem: { titulo: "Linhagem", componente: Linhagem },
} as const;

type Pagina = keyof typeof PAGINAS;

function paginaDaUrl(): Pagina {
  const hash = window.location.hash.replace("#/", "").split("?")[0];
  return hash in PAGINAS ? (hash as Pagina) : "governanca";
}

export default function App() {
  const [pagina, setPagina] = useState<Pagina>(paginaDaUrl);

  useEffect(() => {
    const aoMudar = () => setPagina(paginaDaUrl());
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);

  const Atual = PAGINAS[pagina].componente;

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <span className="marca-ponto" aria-hidden />
          <div>
            <strong>Observatório</strong>
            <small>pipeline indicadores-br</small>
          </div>
        </div>
        <nav>
          {(Object.keys(PAGINAS) as Pagina[]).map((chave) => (
            <a key={chave} href={`#/${chave}`} className={chave === pagina ? "ativo" : undefined}>
              {PAGINAS[chave].titulo}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <Atual />
      </main>
    </div>
  );
}
