/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PRAEFECTUS'

interface LicitacaoItem {
  titulo?: string
  orgao?: string
  municipio?: string
  uf?: string
  valor?: string
}

interface BoletimDiarioProps {
  tipo?: string
  data?: string
  licitacoes?: LicitacaoItem[]
}

const tipoLabels: Record<string, { label: string; emoji: string; desc: string }> = {
  manha: { label: 'Novas Licitações — Manhã', emoji: '🌅', desc: 'Novas oportunidades publicadas' },
  meiodia: { label: 'Alterações e Avisos — Meio-dia', emoji: '⚠️', desc: 'Suspensões, cancelamentos e alterações' },
  tarde: { label: 'Resultados do Dia — Tarde', emoji: '📊', desc: 'Adjudicações, homologações e encerramentos' },
}

const BoletimDiarioEmail = ({ tipo = 'manha', data, licitacoes = [] }: BoletimDiarioProps) => {
  const cfg = tipoLabels[tipo] || tipoLabels.manha
  const dataStr = data || new Date().toLocaleDateString('pt-BR')

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{cfg.emoji} {cfg.label} — {dataStr} — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <div style={logoBar}>
            <Text style={logoText}>PRAEFECTUS</Text>
          </div>

          <Section style={titleSection}>
            <Text style={alertBadge}>{cfg.emoji} BOLETIM DIÁRIO</Text>
            <Heading style={h1}>{cfg.label}</Heading>
            <Text style={subtext}>{cfg.desc} • {dataStr}</Text>
          </Section>

          <Hr style={hr} />

          {licitacoes.length === 0 ? (
            <Section style={emptySection}>
              <Text style={emptyText}>Nenhuma licitação encontrada para este período.</Text>
            </Section>
          ) : (
            <>
              <Section style={countSection}>
                <Text style={countText}>{licitacoes.length} licitação(ões) encontrada(s)</Text>
              </Section>
              {licitacoes.map((lic, i) => (
                <Section key={i} style={cardContainer}>
                  <Heading as="h2" style={cardTitle}>{lic.titulo || 'Sem título'}</Heading>
                  <table style={detailsTable} cellPadding={0} cellSpacing={0}>
                    <tbody>
                      <tr>
                        <td style={detailLabel}>🏛️ Órgão</td>
                        <td style={detailValue}>{lic.orgao || '—'}</td>
                      </tr>
                      <tr>
                        <td style={detailLabel}>📍 Local</td>
                        <td style={detailValue}>{[lic.municipio, lic.uf].filter(Boolean).join('/') || '—'}</td>
                      </tr>
                      <tr>
                        <td style={detailLabel}>💰 Valor</td>
                        <td style={detailValueHighlight}>{lic.valor || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                  {i < licitacoes.length - 1 && <Hr style={cardDivider} />}
                </Section>
              ))}
            </>
          )}

          <Section style={ctaSection}>
            <Button style={mainButton} href="https://praefectus.com.br/monitoramento">
              🔍 Abrir Painel de Monitoramento
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Este boletim foi gerado automaticamente pelo {SITE_NAME}.
            Gerencie suas preferências de boletim nas configurações do sistema.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BoletimDiarioEmail,
  subject: (data: Record<string, any>) => {
    const cfg = tipoLabels[data.tipo] || tipoLabels.manha
    return `${cfg.emoji} ${cfg.label} — ${data.data || new Date().toLocaleDateString('pt-BR')}`
  },
  displayName: 'Boletim Diário',
  previewData: {
    tipo: 'manha',
    data: '06/04/2026',
    licitacoes: [
      { titulo: 'Pregão Eletrônico Nº 12/2026', orgao: 'Sec. Municipal de Saúde', municipio: 'Belém', uf: 'PA', valor: 'R$ 450.000,00' },
    ],
  },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#f0f2f5', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '8px', margin: '40px auto', maxWidth: '600px', overflow: 'hidden' as const, border: '1px solid #e2e5ea' }
const logoBar = { backgroundColor: 'hsl(215, 50%, 23%)', padding: '18px 25px', textAlign: 'center' as const }
const logoText = { color: '#ffffff', fontSize: '18px', fontWeight: 'bold' as const, letterSpacing: '3px', margin: '0' }
const titleSection = { padding: '28px 25px 12px' }
const alertBadge = { fontSize: '11px', fontWeight: '700' as const, color: 'hsl(24, 95%, 53%)', letterSpacing: '1.5px', margin: '0 0 8px', textTransform: 'uppercase' as const }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(215, 40%, 16%)', margin: '0 0 8px', lineHeight: '1.4' }
const subtext = { fontSize: '12px', color: 'hsl(215, 12%, 50%)', margin: '0' }
const hr = { borderColor: '#eaedf1', margin: '0 25px' }
const emptySection = { padding: '30px 25px', textAlign: 'center' as const }
const emptyText = { fontSize: '14px', color: 'hsl(215, 12%, 50%)' }
const countSection = { padding: '16px 25px 0' }
const countText = { fontSize: '12px', fontWeight: '600' as const, color: 'hsl(215, 50%, 23%)', margin: '0', backgroundColor: 'hsl(215, 50%, 95%)', display: 'inline-block' as const, padding: '4px 10px', borderRadius: '4px' }
const cardContainer = { padding: '16px 25px' }
const cardTitle = { fontSize: '15px', fontWeight: '700' as const, color: 'hsl(215, 40%, 16%)', margin: '0 0 10px', lineHeight: '1.4' }
const detailsTable = { width: '100%', marginBottom: '8px' } as React.CSSProperties
const detailLabel = { fontSize: '12px', color: 'hsl(215, 12%, 50%)', padding: '4px 8px 4px 0', verticalAlign: 'top' as const, width: '90px', whiteSpace: 'nowrap' as const }
const detailValue = { fontSize: '13px', color: 'hsl(215, 40%, 16%)', padding: '4px 0', fontWeight: '500' as const }
const detailValueHighlight = { fontSize: '13px', color: 'hsl(215, 50%, 23%)', padding: '4px 0', fontWeight: '700' as const }
const cardDivider = { borderColor: '#f0f2f5', margin: '8px 0 0' }
const ctaSection = { padding: '16px 25px 24px', textAlign: 'center' as const }
const mainButton = { backgroundColor: 'hsl(215, 50%, 23%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' as const }
const footer = { fontSize: '11px', color: '#999999', margin: '16px 25px 20px', lineHeight: '1.5' }
