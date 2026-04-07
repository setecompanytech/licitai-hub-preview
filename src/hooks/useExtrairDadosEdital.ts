import { useState, useCallback } from 'react';
import { streamAIChat } from '@/lib/ai-stream';

interface DadosExtraidos {
  prazo_entrega: string | null;
  local_entrega: string | null;
  condicoes_pagamento: string | null;
  prazo_validade_proposta: string | null;
  processo_administrativo: string | null;
  garantia: string | null;
  condicoes_especiais: string | null;
  condicoes_liquidacao: string | null;
}

export const useExtrairDadosEdital = () => {
  const [extraindo, setExtraindo] = useState(false);

  const extrairDados = useCallback(async (textoEdital: string, objetoLicitacao: string): Promise<DadosExtraidos | null> => {
    if (!textoEdital || textoEdital.length < 50) return null;
    setExtraindo(true);
    try {
      let content = '';
      await streamAIChat({
        messages: [{
          role: 'user',
          content: `Objeto: ${objetoLicitacao}\n\nTexto do edital/TR:\n${textoEdital.substring(0, 12000)}`
        }],
        action: 'extracao_dados_edital',
        context: `Extraia do texto do edital/TR os campos abaixo e retorne SOMENTE JSON puro sem markdown:
{
  "prazo_entrega": "texto do prazo de entrega das mercadorias/serviços",
  "local_entrega": "endereço completo do local de entrega",
  "condicoes_pagamento": "condições e prazo de pagamento",
  "prazo_validade_proposta": "ex: 60 dias",
  "processo_administrativo": "número do processo administrativo se mencionado",
  "garantia": "prazo/condições de garantia se mencionado",
  "condicoes_especiais": "quaisquer condições especiais do edital",
  "condicoes_liquidacao": "condições de liquidação e apresentação de nota fiscal"
}
Se um campo não estiver no texto, use null.`,
        onDelta: (chunk) => { content += chunk; },
        onDone: () => {},
        onError: () => {},
      });

      const limpo = content.replace(/```json|```/g, '').trim();
      const jsonMatch = limpo.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]) as DadosExtraidos;
    } catch (e) {
      console.error('Erro ao extrair dados do edital:', e);
      return null;
    } finally {
      setExtraindo(false);
    }
  }, []);

  return { extraindo, extrairDados };
};
