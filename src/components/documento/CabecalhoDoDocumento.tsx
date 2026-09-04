import { useEffect, useState } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { VERSAO_APP } from '@/lib/versao';
import { carregarTimbrado, type Timbrado } from '@/lib/timbrado/timbrado';

type Props = {
  titulo: string;
  /** Segunda linha: o que este documento é sobre (contrato, competência, órgão). */
  referencia?: string;
  /** Nº do processo, contrato ou protocolo — o que se cita em ofício. */
  identificador?: string;
};

/**
 * O cabeçalho que só existe no papel.
 *
 * Na tela ele é redundante: quem está olhando sabe em que empresa está e em
 * que contrato clicou. No papel, nada disso viaja junto — a folha sai da
 * impressora sem contexto e vai para dentro de um processo administrativo,
 * onde precisa se identificar sozinha.
 *
 * O carimbo de geração não é enfeite: um relatório de execução contratual
 * muda toda semana, e duas folhas iguais sem data são indistinguíveis. Quem
 * confere precisa saber a que momento aquele número se refere.
 */
export default function CabecalhoDoDocumento({ titulo, referencia, identificador }: Props) {
  const { empresaAtiva } = useEmpresa();
  const agora = new Date();
  // O timbrado configurado (Configurações → Timbrado) veste também o papel
  // impresso; sem configuração, o cabeçalho de sempre (princípio 7).
  const [timbrado, setTimbrado] = useState<Timbrado | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTimbrado(empresaAtiva?.id).then((t) => { if (vivo) setTimbrado(t); });
    return () => { vivo = false; };
  }, [empresaAtiva?.id]);

  return (
    <header className="so-impresso mb-5 border-b-2 border-black pb-3">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex items-start gap-3">
          {timbrado?.logoDataUrl && (
            <img src={timbrado.logoDataUrl} alt="" className="h-12 w-auto shrink-0" />
          )}
          {timbrado?.cabecalho ? (
            <p className="text-[10px] font-bold whitespace-pre-line leading-snug">{timbrado.cabecalho}</p>
          ) : (
            <div>
              <p className="text-[13px] font-bold uppercase tracking-wide">
                {empresaAtiva?.razao_social ?? '—'}
              </p>
              {empresaAtiva?.cnpj && (
                <p className="text-[11px]">CNPJ {empresaAtiva.cnpj}</p>
              )}
            </div>
          )}
        </div>
        <div className="text-right text-[10px] leading-tight shrink-0">
          <p>
            Emitido em{' '}
            {agora.toLocaleDateString('pt-BR')} às{' '}
            {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p>Praefectus {VERSAO_APP}</p>
        </div>
      </div>

      <h1 className="mt-3 text-[15px] font-bold uppercase tracking-wide">{titulo}</h1>
      {referencia && <p className="text-[12px] mt-0.5">{referencia}</p>}
      {identificador && (
        <p className="text-[11px] mt-0.5">
          <span className="font-semibold">Referência:</span> {identificador}
        </p>
      )}
    </header>
  );
}
