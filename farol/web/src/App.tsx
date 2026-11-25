import { useEffect, useState, type ReactNode } from "react";

import { useApi } from "./api";
import { Status, quando } from "./componentes";
import {
  IconeCatalogo,
  IconeExecucoes,
  IconeExterno,
  IconeGrafico,
  IconeInicio,
  IconeLinhagem,
  IconeMenu,
  IconeAuto,
  IconeLua,
  IconeQualidade,
  IconeSol,
} from "./icones";
import { MarcaFarol } from "./marca";
import Catalogo from "./pages/Catalogo";
import Indicadores from "./pages/Indicadores";
import Linhagem from "./pages/Linhagem";
import Monitoramento from "./pages/Monitoramento";
import Qualidade from "./pages/Qualidade";
import VisaoGeral from "./pages/VisaoGeral";
import { aplicar, useTema, type Preferencia } from "./tema";
import type { PainelEtapas } from "./tipos";

const PROXIMO: Record<Preferencia, Preferencia> = { auto: "claro", claro: "escuro", escuro: "auto" };
const ROTULO_TEMA: Record<Preferencia, string> = { auto: "Automático", claro: "Claro", escuro: "Escuro" };

function BotaoTema() {
  const { preferencia } = useTema();
  const Icone = preferencia === "claro" ? IconeSol : preferencia === "escuro" ? IconeLua : IconeAuto;
  return (
    <button
      className="botao-tema"
      onClick={() => aplicar(PROXIMO[preferencia])}
      aria-label={`Tema: ${ROTULO_TEMA[preferencia]}. Trocar para ${ROTULO_TEMA[PROXIMO[preferencia]]}`}
      title="Trocar o tema"
    >
      <Icone />
      <span>{ROTULO_TEMA[preferencia]}</span>
    </button>
  );
}

export const REPOSITORIO = "https://github.com/Hollx/indicadores-br";

type Pagina = {
  titulo: string;
  grupo: string;
  icone: () => ReactNode;
  componente: () => ReactNode;
};

const PAGINAS = {
  inicio: { titulo: "Visão geral", grupo: "Comece aqui", icone: IconeInicio, componente: VisaoGeral },
  indicadores: {
    titulo: "Indicadores",
    grupo: "O que os dados dizem",
    icone: IconeGrafico,
    componente: Indicadores,
  },
  execucoes: {
    titulo: "Execuções",
    grupo: "Por dentro do pipeline",
    icone: IconeExecucoes,
    componente: Monitoramento,
  },
  qualidade: {
    titulo: "Qualidade",
    grupo: "Por dentro do pipeline",
    icone: IconeQualidade,
    componente: Qualidade,
  },
  catalogo: {
    titulo: "Catálogo",
    grupo: "Por dentro do pipeline",
    icone: IconeCatalogo,
    componente: Catalogo,
  },
  linhagem: {
    titulo: "Linhagem",
    grupo: "Por dentro do pipeline",
    icone: IconeLinhagem,
    componente: Linhagem,
  },
} satisfies Record<string, Pagina>;

type Chave = keyof typeof PAGINAS;

// Endereços antigos continuam funcionando.
const APELIDOS: Record<string, Chave> = {
  painel: "inicio",
  monitoramento: "execucoes",
  governanca: "catalogo",
};

function paginaDaUrl(): Chave {
  const hash = window.location.hash.replace("#/", "").split("?")[0];
  if (hash in PAGINAS) return hash as Chave;
  return APELIDOS[hash] ?? "inicio";
}

function Frescor() {
  const { dados } = useApi<PainelEtapas>("/etapas");
  const execucao = dados?.execucao_airflow;
  if (!execucao) return null;
  return (
    <span className="frescor-topo">
      <span className="longo">
        Última execução do pipeline: {quando(execucao.inicio ?? execucao.agendada_para)}
      </span>
      <Status situacao={execucao.situacao} />
    </span>
  );
}

export default function App() {
  const [pagina, setPagina] = useState<Chave>(paginaDaUrl);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const aoMudar = () => {
      setPagina(paginaDaUrl());
      setMenuAberto(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);

  useEffect(() => {
    document.title = `${PAGINAS[pagina].titulo} · Farol`;
  }, [pagina]);

  const atual = PAGINAS[pagina];
  const Componente = atual.componente;
  const grupos = [...new Set(Object.values(PAGINAS).map((p) => p.grupo))];

  return (
    <div className={`quadro${menuAberto ? " menu-aberto" : ""}`}>
      <aside className="lateral" aria-label="Navegação">
        <a className="marca" href="#/inicio">
          <MarcaFarol />
          <span>
            <strong>Farol</strong>
            <small>pipeline indicadores-br</small>
          </span>
        </a>
        <nav>
          {grupos.map((grupo) => (
            <div key={grupo}>
              <div className="nav-grupo">{grupo}</div>
              {(Object.keys(PAGINAS) as Chave[])
                .filter((chave) => PAGINAS[chave].grupo === grupo)
                .map((chave) => {
                  const Icone = PAGINAS[chave].icone;
                  return (
                    <a
                      key={chave}
                      href={`#/${chave}`}
                      className="nav-item"
                      aria-current={chave === pagina ? "page" : undefined}
                    >
                      <Icone />
                      {PAGINAS[chave].titulo}
                    </a>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="lateral-pe">
          <a href={REPOSITORIO} target="_blank" rel="noreferrer">
            Código no GitHub <IconeExterno />
          </a>
          <span>Dados públicos do Banco Central (SGS e Boletim Focus), atualizados todo dia.</span>
        </div>
      </aside>

      <div className="barra-topo">
        <button
          className="botao-menu"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuAberto}
        >
          <IconeMenu />
        </button>
        <span className="trilha">
          Farol <span aria-hidden>/</span> <strong>{atual.titulo}</strong>
        </span>
        <div className="topo-direita">
          <Frescor />
          <BotaoTema />
        </div>
      </div>

      <main className="folha">
        <div className="folha-conteudo">
          <Componente />
        </div>
      </main>
    </div>
  );
}
