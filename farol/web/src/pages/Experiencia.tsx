import { TituloTela } from "../componentes";
import { AUTOR, CARGOS, CASOS, EM_NUMEROS, FORMACAO, type Caso } from "../conteudo/autor";
import { Cartao } from "../componentes";
import { Explica } from "../glossario";
import { IconeExterno } from "../icones";

function CasoLinha({ caso }: { caso: Caso }) {
  return (
    <article className="caso" aria-labelledby={`caso-${caso.id}`}>
      <div className="caso-cabeca">
        {caso.fase && <span className="selo caso-fase">{caso.fase}</span>}
        <h3 id={`caso-${caso.id}`}>{caso.titulo}</h3>
        <p className="caso-problema">
          <strong>O desafio:</strong> {caso.problema}
        </p>
        <ul className="caso-ferramentas" aria-label="Ferramentas">
          {caso.ferramentas.map((f) => (
            <li key={f} className="selo">
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="caso-corpo">
        <h4>O que eu fiz</h4>
        <ul>
          {caso.feito.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <h4>Resultado</h4>
        <p>{caso.resultado}</p>
        {caso.noFarol && (
          <a className="caso-farol" href={caso.noFarol.href}>
            {caso.noFarol.texto} →
          </a>
        )}
      </div>
    </article>
  );
}

export default function Experiencia() {
  return (
    <>
      <TituloTela
        titulo="Experiência"
        achado={`${AUTOR.cargo} na ${CARGOS[0].empresa}, a divisão de tecnologia do grupo Arizona, atuando com engenharia de dados desde agosto de 2024 e efetivado no cargo em janeiro de 2025. Abaixo estão casos reais do trabalho, e o Farol mostra as mesmas práticas funcionando com dados públicos.`}
        acao={
          <div className="controles">
            <a className="botao-secundario botao-link" href={AUTOR.linkedin} target="_blank" rel="noreferrer">
              LinkedIn <IconeExterno />
            </a>
            <a className="botao-secundario botao-link" href={AUTOR.github} target="_blank" rel="noreferrer">
              GitHub <IconeExterno />
            </a>
          </div>
        }
      >
        <Explica titulo="Por que não há código destes casos?">
          <p>
            Estes projetos foram feitos para a empresa, então o código e os dados pertencem a ela. Aqui fica a
            descrição do problema, do que foi feito e do resultado, sem nomes de clientes nem informações
            internas.
          </p>
          <p>O código do Farol e do pipeline que ele monitora é aberto e está no GitHub.</p>
        </Explica>
      </TituloTela>

      <div className="cartoes" aria-label="Em números">
        {EM_NUMEROS.map((n) => (
          <Cartao key={n.rotulo} rotulo={n.rotulo} valor={n.valor} detalhe={n.detalhe} />
        ))}
      </div>

      <section className="secao" aria-labelledby="trajetoria-titulo">
        <div className="secao-topo">
          <h2 id="trajetoria-titulo">Trajetória</h2>
        </div>
        <ol className="trajetoria">
          {CARGOS.map((c) => (
            <li key={c.cargo}>
              <span className="trajetoria-periodo">{c.periodo}</span>
              <div>
                <strong>{c.cargo}</strong>
                <span className="trajetoria-empresa"> · {c.empresa}</span>
                <p>{c.resumo}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="secao" aria-labelledby="casos-titulo">
        <div className="secao-topo">
          <h2 id="casos-titulo">Casos do trabalho</h2>
          <p>{CASOS.length} casos</p>
        </div>
        <div className="casos">
          {CASOS.map((c) => (
            <CasoLinha key={c.id} caso={c} />
          ))}
        </div>
      </section>

      <section className="secao" aria-labelledby="formacao-titulo">
        <div className="secao-topo">
          <h2 id="formacao-titulo">Formação</h2>
        </div>
        <ul className="formacao">
          {FORMACAO.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
