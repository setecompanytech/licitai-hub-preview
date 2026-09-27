import type { SVGProps } from 'react';

/**
 * "Reler documento": a folha com linhas e a lupa com um olho — o desenho que
 * o dono escolheu para a ação de reler um anexo com a IA (26/09/2026).
 *
 * Redesenhado em vetor a partir do PNG de 512 px: um bitmap encolhido para
 * 16 px vira um borrão azul, e a cor precisa seguir o tema (`currentColor`),
 * como os demais ícones da coluna Ações. O preenchimento é a própria cor do
 * texto em baixa opacidade, para a folha continuar "azul" sobre o traço.
 */
export default function IconeRelerDocumento(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* A folha, com a dobra no canto */}
      <path d="M5.5 2.5h8.5l4.5 4.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20V4a1.5 1.5 0 0 1 1.5-1.5z" fill="currentColor" fillOpacity="0.18" />
      <path d="M14 2.5V7h4.5" />
      {/* As linhas do texto param antes da lupa: atravessá-la sujava o olho */}
      <path d="M7 10.5h4.8M7 13.5h2.6M7 16.5h2.6M7 19h5.5" />
      {/* A lupa, com o olho dentro */}
      <circle cx="15.5" cy="14.5" r="4.6" fill="currentColor" fillOpacity="0.18" />
      <path d="M12.6 14.5c1.5-1.9 4.3-1.9 5.8 0c-1.5 1.9-4.3 1.9-5.8 0z" />
      <circle cx="15.5" cy="14.5" r="0.95" fill="currentColor" />
      <path d="M18.9 17.9l2.6 2.6" strokeWidth="2.4" />
    </svg>
  );
}
