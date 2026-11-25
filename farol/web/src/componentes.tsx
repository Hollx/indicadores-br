import type { ReactNode } from "react";

import type { Situacao } from "./tipos";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  ok: "ok",
  aviso: "aviso",
  falha: "falha",
  rodando: "rodando",
  sem_dados: "sem dados",
  ignorado: "ignorado",
};

export function Status({ situacao }: { situacao: Situacao }) {
  return <span className={`status status-${situacao}`}>{ROTULO_SITUACAO[situacao] ?? situacao}</span>;
}

export function Cartao({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
}) {
  return (
    <div className="cartao">
      <span className="cartao-rotulo">{rotulo}</span>
      <span className="cartao-valor">{valor}</span>
      {detalhe && <span className="cartao-detalhe">{detalhe}</span>}
    </div>
  );
}

export function Painel({
  titulo,
  children,
  acao,
}: {
  titulo: string;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <section className="painel">
      <header className="painel-topo">
        <h2>{titulo}</h2>
        {acao}
      </header>
      {children}
    </section>
  );
}

export function Indisponivel({ erro }: { erro: string | null }) {
  return <p className="estado aviso-indisponivel">Indisponível: {erro}</p>;
}

export function dataHora(texto: string | null | undefined): string {
  if (!texto) return "—";
  return new Date(texto).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function duracao(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined) return "—";
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const min = Math.floor(segundos / 60);
  return `${min} min ${Math.round(segundos % 60)} s`;
}
