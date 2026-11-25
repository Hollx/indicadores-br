/** Ícones de contorno, 16px, traço 1.5 (um único conjunto, sempre em cinza). */
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconeInicio = () => (
  <svg {...base}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
export const IconeGrafico = () => (
  <svg {...base}>
    <path d="M4 19h16M6 15l4-5 4 3 5-7" />
  </svg>
);
export const IconeExecucoes = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
);
export const IconeQualidade = () => (
  <svg {...base}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const IconeCatalogo = () => (
  <svg {...base}>
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </svg>
);
export const IconeLinhagem = () => (
  <svg {...base}>
    <circle cx="5" cy="6" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="12" r="2" />
    <path d="M7 6h4l6 6M7 18h4l6-6" />
  </svg>
);
export const IconeMenu = () => (
  <svg {...base} width={20} height={20}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconeExterno = () => (
  <svg {...base} width={13} height={13}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const IconeSol = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const IconeLua = () => (
  <svg {...base}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
  </svg>
);
export const IconeAuto = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v16a8 8 0 0 0 0-16z" fill="currentColor" />
  </svg>
);
export const IconePessoa = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);
