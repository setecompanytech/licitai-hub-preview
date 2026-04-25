/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Link, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PRAEFECTUS'

interface EditalItem {
  pncp_id?: string
  numero_compra?: string
  orgao?: string
  uf?: string
  municipio?: string
  objeto?: string
  valor_total_estimado?: number | null
  data_abertura?: string | null
  url?: string
  is_uf_sede?: boolean
}

interface BoletimIaResumoProps {
  nome?: string
  data_geracao?: string
  resumo_executivo?: string
  editais?: EditalItem[]
  total_editais?: number
  uf_sede?: string | null
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
  editais = [],
  total_editais = 0,
  uf_sede,
}: BoletimIaResumoProps) => {
  const editaisSede = editais.filter(e => e.is_uf_sede)
  const editaisOutros = editais.filter(e => !e.is_uf_sede)

  return (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {`${total_editais} editais publicados nas últimas 24h${uf_sede ? ` • ${editaisSede.length} no ${uf_sede}` : ''}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={headerSection}>
          <Heading style={brand}>
            <span style={brandPrae}>PRAE</span>
            <span style={brandFectus}>FECTUS</span>
          </Heading>
          <Text style={tagline}>Boletim Diário • {data_geracao || new Date().toLocaleDateString('pt-BR')}</Text>
        </Section>

        {/* Greeting */}
        <Section style={section}>
          <Heading as="h2" style={h2}>
            {nome ? `Bom dia, ${nome}!` : 'Bom dia!'}
          </Heading>
          <Text style={text}>
            <strong>{total_editais}</strong> {total_editais === 1 ? 'edital publicado' : 'editais publicados'} nas últimas 24h
            {uf_sede && editaisSede.length > 0 && (
              <> — <strong>{editaisSede.length}</strong> {editaisSede.length === 1 ? 'na sua UF' : 'na sua UF'} ({uf_sede})</>
            )}.
          </Text>
        </Section>

        {/* Resumo executivo */}
        {resumo_executivo && (
          <Section style={resumoBox}>
            <Text style={resumoLabel}>📋 PANORAMA</Text>
            <Text style={resumoText}>{resumo_executivo}</Text>
          </Section>
        )}

        {/* Editais da UF sede primeiro */}
        {editaisSede.length > 0 && (
          <Section style={section}>
            <Heading as="h3" style={h3}>📍 Sua UF — {uf_sede}</Heading>
            {editaisSede.map((e, i) => (
              <EditalCard key={`sede-${i}`} edital={e} destaqueSede />
            ))}
          </Section>
        )}

        {/* Demais editais */}
        {editaisOutros.length > 0 && (
          <Section style={section}>
            <Heading as="h3" style={h3}>
              {editaisSede.length > 0 ? '🇧🇷 Outras UFs' : '🇧🇷 Editais publicados'}
            </Heading>
            {editaisOutros.map((e, i) => (
              <EditalCard key={`out-${i}`} edital={e} />
            ))}
          </Section>
        )}

        {editais.length === 0 && (
          <Section style={section}>
            <Text style={text}>
              Nenhum edital novo dentro do seu perfil de monitoramento hoje. Ajuste seus segmentos e UFs nas
              configurações para ampliar o escopo.
            </Text>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} • Inteligência em licitações públicas<br />
          Os editais são listados sem curadoria — você decide o que vale a pena.
        </Text>
      </Container>
    </Body>
  </Html>
  )
}

const EditalCard = ({ edital: e, destaqueSede }: { edital: EditalItem; destaqueSede?: boolean }) => (
  <div style={destaqueSede ? editalCardSede : editalCard}>
    <div style={editalHeader}>
      <Text style={editalNumero}>
        {e.numero_compra || 'S/N'} {e.uf ? `• ${e.municipio ? `${e.municipio}/` : ''}${e.uf}` : ''}
      </Text>
      {destaqueSede && (
        <span style={sedeBadge}>Sua UF</span>
      )}
    </div>
    <Text style={editalOrgao}>{e.orgao || 'Órgão não informado'}</Text>
    <Text style={editalObjeto}>{e.objeto?.slice(0, 220) || ''}{(e.objeto?.length || 0) > 220 ? '…' : ''}</Text>
    <div style={editalMeta}>
      <span style={metaItem}>💰 {fmtBRL(e.valor_total_estimado)}</span>
      <span style={metaItem}>📅 Abertura: {fmtData(e.data_abertura)}</span>
    </div>
    {e.url && (
      <Link href={e.url} style={editalLink}>Ver edital completo →</Link>
    )}
  </div>
)

export const template = {
  component: BoletimIaResumo,
  subject: (data: Record<string, any>) =>
    `${data.total_editais || 0} editais nas últimas 24h${data.uf_sede ? ` • ${data.uf_sede} priorizado` : ''}`,
  displayName: 'Boletim Diário (todos os editais)',
  previewData: {
    nome: 'João',
    data_geracao: '18/04/2026',
    total_editais: 47,
    uf_sede: 'PA',
    resumo_executivo: '47 editais publicados nas últimas 24h, com forte concentração nas regiões Norte e Nordeste. 12 acima de R$ 1 milhão.',
    editais: [
      {
        numero_compra: 'PE 045/2025', orgao: 'Prefeitura de Belém — SEMAD', uf: 'PA', municipio: 'Belém',
        objeto: 'Aquisição de notebooks e equipamentos de TI para modernização administrativa',
        valor_total_estimado: 1250000, data_abertura: '2026-04-25T09:00:00',
        url: 'https://pncp.gov.br/exemplo', is_uf_sede: true,
      },
      {
        numero_compra: 'PE 022/2025', orgao: 'Governo do Estado de SP', uf: 'SP', municipio: 'São Paulo',
        objeto: 'Contratação de serviços de manutenção predial',
        valor_total_estimado: 800000, data_abertura: '2026-04-30T10:00:00',
        url: 'https://pncp.gov.br/exemplo2', is_uf_sede: false,
      },
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
const h3 = { fontSize: '14px', color: '#0f172a', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const resumoBox = { backgroundColor: '#f1f5f9', padding: '18px 22px', margin: '8px 28px', borderRadius: '8px', borderLeft: '4px solid #d4a437' }
const resumoLabel = { fontSize: '11px', fontWeight: 700 as const, color: '#d4a437', margin: '0 0 8px', letterSpacing: '0.08em' }
const resumoText = { fontSize: '13px', color: '#1e293b', lineHeight: '1.6', margin: 0 }
const editalCard = { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '10px', backgroundColor: '#fafbfc' }
const editalCardSede = { border: '1px solid #d4a437', borderLeft: '4px solid #d4a437', borderRadius: '8px', padding: '14px 16px', marginBottom: '10px', backgroundColor: '#fffbeb' }
const editalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }
const editalNumero = { fontSize: '12px', fontWeight: 600 as const, color: '#3b82f6', margin: 0 }
const sedeBadge = { fontSize: '10px', fontWeight: 700 as const, color: '#fff', backgroundColor: '#d4a437', padding: '2px 8px', borderRadius: '10px' }
const editalOrgao = { fontSize: '13px', fontWeight: 600 as const, color: '#0f172a', margin: '4px 0 4px' }
const editalObjeto = { fontSize: '12px', color: '#475569', lineHeight: '1.5', margin: '0 0 8px' }
const editalMeta = { display: 'flex', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' as const }
const metaItem = { fontSize: '11px', color: '#64748b' }
const editalLink = { fontSize: '12px', color: '#3b82f6', fontWeight: 600 as const, textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '24px 28px' }
const footer = { fontSize: '11px', color: '#94a3b8', textAlign: 'center' as const, padding: '0 28px 24px', lineHeight: '1.6' }
