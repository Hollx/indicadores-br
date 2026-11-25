import type { ReactNode } from "react";

import type { Situacao } from "./tipos";

/** Status em palavras simples, entendíveis por quem não é da área. */
export const ROTULO_SITUACAO: Record<Situacao, string> = {
  ok: "Ok",
  aviso: "Atenção",
  falha: "Problema",
  rodando: "Rodando agora",
  sem_dados: "Sem dados",
  ignorado: "Ignorado",
};

export function Status({ situacao, rotulo }: { situacao: Situacao; rotulo?: string }) {
  return (
    <span className={`status status-${situacao}`}>{rotulo ?? ROTULO_SITUACAO[situacao] ?? situacao}</span>
  );
}

export function Cartao({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: ReactNode;
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

/** Cabeçalho de cada tela: título, a resposta em uma frase e a explicação recolhível. */
export function TituloTela({
  titulo,
  achado,
  acao,
  children,
}: {
  titulo: string;
  achado?: ReactNode;
  acao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header>
      <div className="titulo-linha">
        <h1>{titulo}</h1>
        {acao}
      </div>
      {achado && <p className="achado">{achado}</p>}
      {children}
    </header>
  );
}

export function Painel({
  titulo,
  descricao,
  children,
  acao,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <section className="painel">
      <header className="painel-topo">
        <div>
          <h2>{titulo}</h2>
          {descricao && <p>{descricao}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

export function Indisponivel({ erro, oQue }: { erro: string | null; oQue?: string }) {
  return (
    <p className="aviso-indisponivel">
      {oQue ?? "Esta informação"} não está disponível agora{erro ? ` (${erro})` : ""}.
    </p>
  );
}

export function dataHora(texto: string | null | undefined): string {
  if (!texto) return "—";
  return new Date(texto).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** "hoje às 06:03", "ontem às 06:01" ou "21/11 às 06:00", no fuso de quem lê. */
export function quando(texto: string | null | undefined): string {
  if (!texto) return "—";
  const d = new Date(texto);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `hoje às ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem às ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hora}`;
}

export function duracao(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined) return "—";
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const min = Math.floor(segundos / 60);
  const seg = Math.round(segundos % 60);
  return seg ? `${min} min ${seg} s` : `${min} min`;
}
