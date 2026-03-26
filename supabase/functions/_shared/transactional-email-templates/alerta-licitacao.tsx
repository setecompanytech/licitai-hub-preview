/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PRAEFECTUS'

interface LicitacaoItem {
  titulo?: string
  orgao?: string
  objeto?: string
  municipio?: string
  uf?: string
  valor?: string
  abertura?: string
  modalidade?: string
  fonte?: string
}

interface AlertaLicitacaoProps {
  licitacoes?: LicitacaoItem[]
  totalEncontradas?: number
  dataHora?: string
}

const AlertaLicitacaoEmail = ({ licitacoes = [], totalEncontradas, dataHora }: AlertaLicitacaoProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>🔔 {totalEncontradas || licitacoes.length} nova(s) oportunidade(s) encontrada(s) — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <div style={logoBar}>
          <Text style={logoText}>PRAEFECTUS</Text>
        </div>

        {/* Title section */}
        <Section style={titleSection}>
          <Text style={alertBadge}>🔔 ALERTA DE OPORTUNIDADE</Text>
          <Heading style={h1}>
            {totalEncontradas || licitacoes.length} nova(s) licitação(ões) compatíveis com seu perfil
          </Heading>
          <Text style={subtext}>
            Monitoramento automático • {dataHora || new Date().toLocaleDateString('pt-BR')}
          </Text>
        </Section>

        <Hr style={hr} />

        {/* Licitações cards */}
        {licitacoes.map((lic, i) => (
          <Section key={i} style={cardContainer}>
            <div style={cardHeader}>
              <Text style={cardModalidade}>{lic.modalidade || 'Pregão Eletrônico'}</Text>
              <Text style={cardFonte}>{lic.fonte || 'PNCP'}</Text>
            </div>
            <Heading as="h2" style={cardTitle}>{lic.titulo || 'Sem título'}</Heading>
            {lic.objeto && <Text style={cardObjeto}>{lic.objeto}</Text>}
            
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
                  <td style={detailLabel}>💰 Valor Est.</td>
                  <td style={detailValueHighlight}>{lic.valor || '—'}</td>
                </tr>
                <tr>
                  <td style={detailLabel}>📅 Abertura</td>
                  <td style={detailValueHighlight}>{lic.abertura || '—'}</td>
                </tr>
              </tbody>
            </table>

            <Button style={cardButton} href="https://praefectus.com.br/monitoramento">
              Ver Detalhes e Marcar Interesse →
            </Button>
            {i < licitacoes.length - 1 && <Hr style={cardDivider} />}
          </Section>
        ))}

        {/* Footer CTA */}
        <Section style={ctaSection}>
          <Button style={mainButton} href="https://praefectus.com.br/monitoramento">
            🔍 Abrir Painel de Monitoramento
          </Button>
          <Text style={ctaSubtext}>
            Configure palavras-chave, UFs e faixas de valor para refinar seus alertas.
          </Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Este alerta foi gerado automaticamente pelo motor de monitoramento {SITE_NAME}.
          Você pode ajustar suas preferências a qualquer momento nas configurações do sistema.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AlertaLicitacaoEmail,
  subject: (data: Record<string, any>) =>
    `🔔 ${data.totalEncontradas || '1'} nova(s) oportunidade(s) — PRAEFECTUS`,
  displayName: 'Alerta de Licitação',
  previewData: {
    totalEncontradas: 2,
    dataHora: '26/03/2026 — 14:30',
    licitacoes: [
      {
        titulo: 'Pregão Eletrônico Nº 6/2026-FMAS PM Brasil Novo-Pa.',
        modalidade: 'Pregão Eletrônico',
        objeto: 'Aquisição de móveis, eletrodomésticos e itens de cama, e banho, destinados à estruturação e funcionamento do Serviço de Acolhimento Institucional na modalidade Casa Lar.',
        orgao: 'Fundo Municipal de Assistência Social — PM Brasil Novo/PA',
        municipio: 'Brasil Novo',
        uf: 'PA',
        valor: 'R$ 185.420,00',
        abertura: '08/04/2026 às 09:00',
        fonte: 'PNCP / DOE-PA',
      },
      {
        titulo: 'Pregão Eletrônico Nº 12/2026 — Secretaria de Saúde',
        modalidade: 'Pregão Eletrônico',
        objeto: 'Registro de preços para aquisição de materiais hospitalares e equipamentos de proteção individual — EPI.',
        orgao: 'Secretaria Municipal de Saúde — PM Marabá/PA',
        municipio: 'Marabá',
        uf: 'PA',
        valor: 'R$ 1.340.000,00',
        abertura: '10/04/2026 às 10:00',
        fonte: 'ComprasGov',
      },
    ],
  },
} satisfies TemplateEntry

// ─── Styles ─────────────────────────────────────────────
const main = { backgroundColor: '#f0f2f5', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '8px', margin: '40px auto', maxWidth: '600px', overflow: 'hidden' as const, border: '1px solid #e2e5ea' }

const logoBar = { backgroundColor: 'hsl(215, 50%, 23%)', padding: '18px 25px', textAlign: 'center' as const }
const logoText = { color: '#ffffff', fontSize: '18px', fontWeight: 'bold' as const, letterSpacing: '3px', margin: '0' }

const titleSection = { padding: '28px 25px 12px' }
const alertBadge = { fontSize: '11px', fontWeight: '700' as const, color: 'hsl(24, 95%, 53%)', letterSpacing: '1.5px', margin: '0 0 8px', textTransform: 'uppercase' as const }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(215, 40%, 16%)', margin: '0 0 8px', lineHeight: '1.4' }
const subtext = { fontSize: '12px', color: 'hsl(215, 12%, 50%)', margin: '0' }

const hr = { borderColor: '#eaedf1', margin: '0 25px' }

const cardContainer = { padding: '20px 25px' }
const cardHeader = { display: 'flex' as const, marginBottom: '8px' }
const cardModalidade = { fontSize: '10px', fontWeight: '700' as const, color: '#ffffff', backgroundColor: 'hsl(215, 50%, 23%)', borderRadius: '4px', padding: '3px 8px', margin: '0 8px 0 0', display: 'inline-block' as const, letterSpacing: '0.5px', textTransform: 'uppercase' as const }
const cardFonte = { fontSize: '10px', fontWeight: '600' as const, color: 'hsl(24, 95%, 53%)', backgroundColor: 'hsl(24, 95%, 95%)', borderRadius: '4px', padding: '3px 8px', margin: '0', display: 'inline-block' as const }
const cardTitle = { fontSize: '16px', fontWeight: '700' as const, color: 'hsl(215, 40%, 16%)', margin: '10px 0 6px', lineHeight: '1.4' }
const cardObjeto = { fontSize: '13px', color: 'hsl(215, 12%, 45%)', lineHeight: '1.5', margin: '0 0 14px', borderLeft: '3px solid hsl(24, 95%, 53%)', paddingLeft: '12px' }

const detailsTable = { width: '100%', marginBottom: '16px' } as React.CSSProperties
const detailLabel = { fontSize: '12px', color: 'hsl(215, 12%, 50%)', padding: '5px 8px 5px 0', verticalAlign: 'top' as const, width: '100px', whiteSpace: 'nowrap' as const }
const detailValue = { fontSize: '13px', color: 'hsl(215, 40%, 16%)', padding: '5px 0', fontWeight: '500' as const }
const detailValueHighlight = { fontSize: '13px', color: 'hsl(215, 50%, 23%)', padding: '5px 0', fontWeight: '700' as const }

const cardButton = { backgroundColor: 'hsl(24, 95%, 53%)', color: '#ffffff', fontSize: '13px', fontWeight: '600' as const, borderRadius: '6px', padding: '10px 20px', textDecoration: 'none', display: 'inline-block' as const }
const cardDivider = { borderColor: '#f0f2f5', margin: '20px 0 0' }

const ctaSection = { padding: '8px 25px 24px', textAlign: 'center' as const }
const mainButton = { backgroundColor: 'hsl(215, 50%, 23%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' as const }
const ctaSubtext = { fontSize: '11px', color: 'hsl(215, 12%, 50%)', margin: '12px 0 0' }

const footer = { fontSize: '11px', color: '#999999', margin: '16px 25px 20px', lineHeight: '1.5' }
