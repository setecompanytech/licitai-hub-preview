/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

/**
 * Digest diário de vencimento de documentos — vai para assessorias contábeis
 * e setores internos cadastrados. A COR de cada linha esquenta conforme o
 * prazo aperta (o pedido do dono: "cores vibrantes a cada dia que se
 * aproxime"): vencido é vermelho pleno; 0–3 dias vermelho; 4–7 laranja;
 * 8–15 âmbar; além disso, amarelo suave. Vencido dispara TODO dia até o
 * documento ser renovado no sistema — quando o upload atualiza a validade,
 * a linha sai do digest sozinha.
 */

interface DocLinha {
  nome: string
  validade: string // dd/mm/aaaa já formatada
  dias: number     // negativo = vencido
}

interface VencimentoDocsProps {
  destinatarioNome?: string
  empresaNome?: string
  docs?: DocLinha[]
  ctaUrl?: string
}

function corDaLinha(dias: number): { bg: string; fg: string; rotulo: string } {
  if (dias < 0) return { bg: '#dc2626', fg: '#ffffff', rotulo: `VENCIDO há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}` }
  if (dias === 0) return { bg: '#ef4444', fg: '#ffffff', rotulo: 'VENCE HOJE' }
  if (dias <= 3) return { bg: '#f87171', fg: '#7f1d1d', rotulo: `vence em ${dias} dia${dias === 1 ? '' : 's'}` }
  if (dias <= 7) return { bg: '#fb923c', fg: '#7c2d12', rotulo: `vence em ${dias} dias` }
  if (dias <= 15) return { bg: '#fbbf24', fg: '#78350f', rotulo: `vence em ${dias} dias` }
  return { bg: '#fef08a', fg: '#713f12', rotulo: `vence em ${dias} dias` }
}

const VencimentoDocsEmail = ({ destinatarioNome, empresaNome, docs = [], ctaUrl }: VencimentoDocsProps) => {
  const vencidos = docs.filter(d => d.dias < 0).length
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {vencidos > 0
          ? `${vencidos} documento(s) VENCIDO(S) — ${empresaNome || ''}`
          : `Documentos a vencer — ${empresaNome || ''}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <div style={logoBar}>
            <Text style={logoText}>PRAEFECTUS</Text>
          </div>
          <Heading style={h1}>
            {vencidos > 0 ? '🚨 Documentos vencidos' : '⏳ Documentos a vencer'}
          </Heading>
          <Text style={text}>
            {destinatarioNome ? `Olá, ${destinatarioNome}!` : 'Olá!'}
          </Text>
          <Text style={text}>
            {vencidos > 0
              ? `A empresa ${empresaNome || ''} tem ${vencidos} documento(s) VENCIDO(S) e este alerta se repetirá todos os dias até a atualização.`
              : `Os documentos abaixo da empresa ${empresaNome || ''} estão dentro da janela de vencimento.`}
            {' '}Assim que o documento renovado for anexado no sistema, o alerta cessa automaticamente.
          </Text>

          <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', margin: '16px 0' }}>
            <tbody>
              {docs.map((d, i) => {
                const cor = corDaLinha(d.dias)
                return (
                  <tr key={i}>
                    <td style={{ padding: '10px 12px', backgroundColor: cor.bg, color: cor.fg, borderRadius: 6, fontSize: 14, fontWeight: 600, border: '2px solid #ffffff' }}>
                      {d.nome}
                      <div style={{ fontSize: 12, fontWeight: 400, marginTop: 2 }}>
                        Validade: {d.validade} — <strong>{cor.rotulo}</strong>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <Button style={button} href={ctaUrl || 'https://praefectus.com.br/documentos'}>
            Atualizar documentos no sistema
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            PRAEFECTUS — alerta automático de vencimento de documentos.
            Você recebe esta mensagem porque seu e-mail está cadastrado como
            destinatário de alertas da empresa {empresaNome || ''}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#f4f4f5', fontFamily: 'Arial, Helvetica, sans-serif', padding: '24px 0' }
const container = { backgroundColor: '#ffffff', borderRadius: 8, margin: '0 auto', padding: 24, maxWidth: 560 }
const logoBar = { borderBottom: '2px solid #b45309', paddingBottom: 8, marginBottom: 16 }
const logoText = { fontSize: 18, fontWeight: 700 as const, letterSpacing: 2, color: '#b45309', margin: 0 }
const h1 = { fontSize: 20, color: '#18181b', margin: '8px 0 4px' }
const text = { fontSize: 14, color: '#3f3f46', lineHeight: '22px' }
const button = { backgroundColor: '#b45309', borderRadius: 6, color: '#ffffff', fontSize: 14, fontWeight: 600 as const, padding: '12px 20px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e4e4e7', margin: '20px 0 12px' }
const footer = { fontSize: 12, color: '#a1a1aa', lineHeight: '18px' }

export const template: TemplateEntry = {
  component: VencimentoDocsEmail,
  subject: (data) => {
    const docs = (data.docs as DocLinha[] | undefined) ?? []
    const vencidos = docs.filter(d => d.dias < 0).length
    return vencidos > 0
      ? `🚨 ${vencidos} documento(s) VENCIDO(S) — ${data.empresaNome ?? ''}`
      : `⏳ Documentos a vencer — ${data.empresaNome ?? ''}`
  },
  displayName: 'Vencimento de documentos (digest)',
  previewData: {
    destinatarioNome: 'Contabilidade Exemplo',
    empresaNome: 'EMPRESA DEMONSTRAÇÃO LTDA',
    docs: [
      { nome: 'Certidão Negativa Federal (RFB/PGFN)', validade: '05/09/2026', dias: -5 },
      { nome: 'CRF — FGTS', validade: '12/09/2026', dias: 2 },
      { nome: 'Certidão Estadual', validade: '18/09/2026', dias: 8 },
      { nome: 'Certidão Municipal', validade: '30/09/2026', dias: 20 },
    ],
  },
}
