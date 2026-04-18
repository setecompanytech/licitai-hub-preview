/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Link, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PRAEFECTUS'

interface EditalDestaque {
  pncp_id?: string
  numero_compra?: string
  orgao?: string
  uf?: string
  objeto?: string
  valor_total_estimado?: number | null
  data_abertura?: string | null
  url?: string
  score?: number
  motivo?: string
}

interface BoletimIaResumoProps {
  nome?: string
  data_geracao?: string
  resumo_executivo?: string
  destaques?: EditalDestaque[]
  total_analisados?: number
  insights?: string[]
}

const fmtBRL = (v?: number | null) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—'

const fmtData = (raw?: string | null) => {
  if (!raw) return '—'
  try { return new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return raw }
}

const BoletimIaResumo = ({
  nome,
  data_geracao,
  resumo_executivo,
  destaques = [],
  total_analisados = 0,
  insights = [],
}: BoletimIaResumoProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      AURÉLIA analisou {total_analisados} editais — {destaques.length} oportunidades destacadas
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={headerSection}>
          <Heading style={brand}>
            <span style={brandPrae}>PRAE</span>
            <span style={brandFectus}>FECTUS</span>
          </Heading>
          <Text style={tagline}>Boletim Inteligente • {data_geracao || new Date().toLocaleDateString('pt-BR')}</Text>
        </Section>

        {/* Greeting */}
        <Section style={section}>
          <Heading as="h2" style={h2}>
            {nome ? `Bom dia, ${nome}!` : 'Bom dia!'}
          </Heading>
          <Text style={text}>
            A <strong>AURÉLIA</strong> analisou <strong>{total_analisados}</strong> editais publicados nas últimas 24h
            e selecionou <strong>{destaques.length}</strong> oportunidades alinhadas ao seu perfil.
          </Text>
        </Section>

        {/* Resumo executivo */}
        {resumo_executivo && (
          <Section style={resumoBox}>
            <Text style={resumoLabel}>📋 RESUMO EXECUTIVO</Text>
            <Text style={resumoText}>{resumo_executivo}</Text>
          </Section>
        )}

        {/* Destaques */}
        {destaques.length > 0 && (
          <Section style={section}>
            <Heading as="h3" style={h3}>🎯 Oportunidades em destaque</Heading>
            {destaques.map((e, i) => (
              <div key={i} style={editalCard}>
                <div style={editalHeader}>
                  <Text style={editalNumero}>
                    {e.numero_compra || 'S/N'} {e.uf ? `• ${e.uf}` : ''}
                  </Text>
                  {typeof e.score === 'number' && (
                    <span style={scoreBadge}>Score {e.score}%</span>
                  )}
                </div>
                <Text style={editalOrgao}>{e.orgao || 'Órgão não informado'}</Text>
                <Text style={editalObjeto}>{e.objeto?.slice(0, 200) || ''}{(e.objeto?.length || 0) > 200 ? '…' : ''}</Text>
                <div style={editalMeta}>
                  <span style={metaItem}>💰 {fmtBRL(e.valor_total_estimado)}</span>
                  <span style={metaItem}>📅 Abertura: {fmtData(e.data_abertura)}</span>
                </div>
                {e.motivo && (
                  <Text style={motivoText}>
                    <strong>Por que recomendamos:</strong> {e.motivo}
                  </Text>
                )}
                {e.url && (
                  <Link href={e.url} style={editalLink}>Ver edital completo →</Link>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <Section style={insightsBox}>
            <Text style={insightsLabel}>💡 INSIGHTS DA AURÉLIA</Text>
            {insights.map((ins, i) => (
              <Text key={i} style={insightItem}>• {ins}</Text>
            ))}
          </Section>
        )}

        {destaques.length === 0 && (
          <Section style={section}>
            <Text style={text}>
              Nenhuma oportunidade alinhada ao seu perfil hoje. Ajuste seus segmentos e UFs nas
              configurações para receber mais alertas.
            </Text>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} • Inteligência em licitações públicas<br />
          Powered by AURÉLIA Intelligence
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BoletimIaResumo,
  subject: (data: Record<string, any>) =>
    `🎯 ${data.destaques?.length || 0} oportunidades destacadas • Boletim AURÉLIA`,
  displayName: 'Boletim IA Diário (AURÉLIA)',
  previewData: {
    nome: 'João',
    data_geracao: '18/04/2026',
    total_analisados: 47,
    resumo_executivo: 'Foram identificadas 5 oportunidades estratégicas no setor de TI no Norte/Nordeste, com destaque para 2 pregões de grande porte e prazo confortável de habilitação.',
    destaques: [
      {
        numero_compra: 'PE 045/2025', orgao: 'Prefeitura de Belém — SEMAD', uf: 'PA',
        objeto: 'Aquisição de notebooks e equipamentos de TI para modernização administrativa',
        valor_total_estimado: 1250000, data_abertura: '2026-04-25T09:00:00',
        url: 'https://pncp.gov.br/exemplo', score: 87,
        motivo: 'Alinhado ao seu segmento de TI, prazo de habilitação confortável (7 dias) e valor compatível com seu histórico.',
      },
    ],
    insights: [
      'Volume 23% maior que a média semanal — bom momento para alocar equipe.',
      '3 órgãos do PA publicaram editais simultâneos — possível padronização de exigências.',
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const headerSection = { backgroundColor: '#0f172a', padding: '24px', textAlign: 'center' as const }
const brand = { fontSize: '26px', fontWeight: 700 as const, margin: 0, letterSpacing: '0.04em' }
const brandPrae = { color: '#3b82f6' }
const brandFectus = { color: '#d4a437' }
const tagline = { color: '#94a3b8', fontSize: '12px', margin: '6px 0 0' }
const section = { padding: '20px 28px' }
const h2 = { fontSize: '20px', color: '#0f172a', margin: '0 0 8px' }
const h3 = { fontSize: '15px', color: '#0f172a', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const resumoBox = { backgroundColor: '#f1f5f9', padding: '18px 22px', margin: '8px 28px', borderRadius: '8px', borderLeft: '4px solid #d4a437' }
const resumoLabel = { fontSize: '11px', fontWeight: 700 as const, color: '#d4a437', margin: '0 0 8px', letterSpacing: '0.08em' }
const resumoText = { fontSize: '13px', color: '#1e293b', lineHeight: '1.6', margin: 0 }
const editalCard = { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '12px', backgroundColor: '#fafbfc' }
const editalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }
const editalNumero = { fontSize: '12px', fontWeight: 600 as const, color: '#3b82f6', margin: 0 }
const scoreBadge = { fontSize: '10px', fontWeight: 700 as const, color: '#fff', backgroundColor: '#16a34a', padding: '2px 8px', borderRadius: '10px' }
const editalOrgao = { fontSize: '13px', fontWeight: 600 as const, color: '#0f172a', margin: '4px 0 4px' }
const editalObjeto = { fontSize: '12px', color: '#475569', lineHeight: '1.5', margin: '0 0 8px' }
const editalMeta = { display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' as const }
const metaItem = { fontSize: '11px', color: '#64748b' }
const motivoText = { fontSize: '12px', color: '#0f172a', backgroundColor: '#fef9e7', padding: '8px 10px', borderRadius: '6px', margin: '8px 0', lineHeight: '1.5' }
const editalLink = { fontSize: '12px', color: '#3b82f6', fontWeight: 600 as const, textDecoration: 'none' }
const insightsBox = { backgroundColor: '#eff6ff', padding: '16px 22px', margin: '8px 28px', borderRadius: '8px' }
const insightsLabel = { fontSize: '11px', fontWeight: 700 as const, color: '#1d4ed8', margin: '0 0 8px', letterSpacing: '0.08em' }
const insightItem = { fontSize: '12px', color: '#1e293b', lineHeight: '1.6', margin: '2px 0' }
const hr = { borderColor: '#e2e8f0', margin: '24px 28px' }
const footer = { fontSize: '11px', color: '#94a3b8', textAlign: 'center' as const, padding: '0 28px 24px', lineHeight: '1.6' }
