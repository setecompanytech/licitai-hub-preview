import { Link } from 'react-router-dom';

interface Props {
  /** Pílula acima do título — o assunto, em duas ou três palavras. */
  etiqueta: string;
  titulo: string;
  descricao: string;
  chamada: string;
  para: string;
}

/**
 * Faixa de destaque do painel — o cartão azul do protótipo, com a barra escura
 * de chamada colada embaixo.
 *
 * O gradiente vem de `--gradient-primary`, não de cor escrita à mão: assim ele
 * acompanha a paleta se ela mudar de novo, e muda junto no tema escuro.
 */
export default function BannerDestaque({ etiqueta, titulo, descricao, chamada, para }: Props) {
  return (
    <Link
      to={para}
      className="group flex flex-col rounded-2xl overflow-hidden shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex-1 bg-gradient-primary px-6 py-7 text-center flex flex-col items-center justify-center gap-2.5">
        <span className="text-xs font-bold uppercase tracking-wider bg-white/20 text-white px-3 py-1 rounded-full leading-none">
          {etiqueta}
        </span>
        <h3 className="text-2xl font-bold text-white tracking-tight text-balance">{titulo}</h3>
        <p className="text-sm text-white/85 max-w-[38ch] leading-snug">{descricao}</p>
      </div>

      {/* A barra escura é navy nos dois temas, como no protótipo: ela fecha o
          cartão e dá o contraste que o texto branco sobre azul não tem. */}
      <div className="bg-navy px-6 py-3 text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-white group-hover:text-gold-logo transition-colors">
          {chamada}
        </span>
      </div>
    </Link>
  );
}
