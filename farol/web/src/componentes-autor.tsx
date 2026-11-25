import { AUTOR } from "./conteudo/autor";
import { IconeExterno } from "./icones";

/** Faixa "Quem fez": nome, cargo, uma frase e os links. */
export function QuemFez() {
  const iniciais = AUTOR.nome
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <section className="quem-fez" aria-label="Quem fez">
      <span className="quem-fez-iniciais" aria-hidden>
        {iniciais}
      </span>
      <div className="quem-fez-texto">
        <p>
          <strong>{AUTOR.nome}</strong> · {AUTOR.cargo}
        </p>
        <p className="quem-fez-frase">{AUTOR.frase}</p>
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
    </section>
  );
}
