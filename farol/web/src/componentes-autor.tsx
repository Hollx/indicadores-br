import type { ReactNode } from "react";

import { AUTOR } from "./conteudo/autor";
import { IconeExterno } from "./icones";

/** Cabeçalho da página inicial: quem fez, o que faz e os links. O nome é o h1 da página. */
export function QuemFez({ children }: { children?: ReactNode }) {
  const iniciais = AUTOR.nome
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <header className="quem-fez">
      <span className="quem-fez-iniciais" aria-hidden>
        {iniciais}
      </span>
      <div className="quem-fez-texto">
        <h1>
          {AUTOR.nome} <span className="quem-fez-sep">· </span>
          <span className="quem-fez-cargo">{AUTOR.cargo}</span>
        </h1>
        <p className="quem-fez-frase">{AUTOR.frase}</p>
        <p className="quem-fez-nota">
          Este site é um projeto meu, funcionando agora: um pipeline de dados que roda todo dia com dados
          públicos do Banco Central, e o painel que cuida dele.
        </p>
      </div>
      <nav className="quem-fez-links" aria-label="Links do autor">
        <a href="#/experiencia">Experiência</a>
        <a href={AUTOR.linkedin} target="_blank" rel="noreferrer">
          LinkedIn <IconeExterno />
        </a>
        <a href={AUTOR.github} target="_blank" rel="noreferrer">
          GitHub <IconeExterno />
        </a>
      </nav>
      {children && <div className="quem-fez-extra">{children}</div>}
    </header>
  );
}
