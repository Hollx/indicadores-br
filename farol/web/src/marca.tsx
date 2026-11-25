/** Marca do Farol: um farol com o facho de luz, desenhado para o projeto. */
export function MarcaFarol({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true" className="marca-simbolo">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M16 5l3 3v2h-6V8z" fill="#fff" />
      <path d="M13.2 11h5.6l1.8 15h-9.2z" fill="#fff" />
      <path d="M12.6 16.5h6.8l.3 2.5h-7.4z" fill="var(--accent)" />
      <path d="M19 8.6l9-3v6.4z M13 8.6l-9-3v6.4z" fill="#fff" opacity=".45" />
      <rect x="9" y="26" width="14" height="2" rx="1" fill="#fff" />
    </svg>
  );
}
