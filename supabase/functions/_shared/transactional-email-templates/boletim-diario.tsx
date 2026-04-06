/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PRAEFECTUS'

interface BoletimDiarioProps {
  tipo?: string
  data?: string
  numero_pregao?: string
  orgao?: string
  codigo_uasg?: string
  objeto?: string
  municipio?: string
  uf?: string
  valor_estimado?: string
  data_abertura?: string
  endereco?: string
  modalidade?: string
  lei?: string
  horario_edital?: string
  horario_proposta?: string
  portal?: string
}

const tipoLabels: Record<string, { label: string; desc: string }> = {
  manha: { label: 'Novas Licitações — Manhã', desc: 'Nova oportunidade publicada' },
  meiodia: { label: 'Alterações e Avisos — Meio-dia', desc: 'Alteração ou aviso identificado' },
  tarde: { label: 'Resultados do Dia — Tarde', desc: 'Resultado publicado' },
}

const BoletimDiarioEmail = (props: BoletimDiarioProps) => {
  const {
    tipo = 'manha',
    data,
    numero_pregao,
    orgao,
    codigo_uasg,
    objeto,
    municipio,
    uf,
    valor_estimado,
    data_abertura,
    modalidade,
    lei,
    portal,
  } = props

  const cfg = tipoLabels[tipo] || tipoLabels.manha
  const dataStr = data || new Date().toLocaleDateString('pt-BR')
  const localStr = [municipio, uf].filter(Boolean).join('/')

  const previewText = numero_pregao
    ? `${numero_pregao} ${localStr ? `PM ${localStr}` : ''}`
    : `${cfg.label} — ${dataStr}`

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{previewText} — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>

          <Section style={headerSection}>
            <Text style={senderLine}>{SITE_NAME}</Text>
            <Text style={dateLine}>{cfg.label} — {dataStr}</Text>
          </Section>

          <Hr style={divider} />

          {orgao && (
            <Section style={bodySection}>
              <Text style={orgaoText}>{orgao.toUpperCase()}</Text>
              {codigo_uasg && <Text style={fieldText}>Código da UASG: {codigo_uasg}</Text>}
              {numero_pregao && (
                <Text style={fieldText}>
                  {numero_pregao}
                  {lei ? ` - (${lei})` : ''}
                </Text>
              )}
            </Section>
          )}

          {objeto && (
            <Section style={bodySection}>
              <Text style={objetoLabel}>Objeto: <span style={objetoValue}>{objeto}</span></Text>
            </Section>
          )}

          {(data_abertura || localStr || portal) && (
            <Section style={bodySection}>
              {data_abertura && <Text style={fieldText}>Abertura da Proposta: {data_abertura}</Text>}
              {localStr && <Text style={fieldText}>Local: {localStr}</Text>}
              {portal && <Text style={fieldText}>Portal: {portal}</Text>}
            </Section>
          )}

          {valor_estimado && (
            <Section style={bodySection}>
              <Text style={fieldText}>Valor Estimado: {valor_estimado}</Text>
            </Section>
          )}

          <Hr style={divider} />

          <Section style={footerSection}>
            <Text style={footerText}>
              Aviso enviado automaticamente pelo {SITE_NAME}.
            </Text>
            <Text style={footerText}>
              Gerencie suas preferências de boletim nas configurações do sistema.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BoletimDiarioEmail,
  subject: (data: Record<string, any>) => {
    if (data.numero_pregao) {
      const local = [data.municipio, data.uf].filter(Boolean).join('/')
      return `${data.numero_pregao}${local ? ` PM ${local}` : ''}`
    }
    const cfg = tipoLabels[data.tipo] || tipoLabels.manha
    return `${cfg.label} — ${data.data || new Date().toLocaleDateString('pt-BR')}`
  },
  displayName: 'Boletim Diário',
  previewData: {
    tipo: 'manha',
    data: '06/04/2026',
    numero_pregao: 'Pregão Eletrônico Nº 90014/2026',
    orgao: 'PREFEITURA MUNICIPAL DE IRITUIA',
    codigo_uasg: '980469',
    objeto: 'Aquisição DE CESTAS BÁSICAS PARA ATENDER AS NECESSIDADES DA SECRETARIA MUNICIPAL DE TRABALHO E PROMOÇÃO SOCIAL DO MUNICÍPIO DE IRITUIA/PA.',
    municipio: 'Irituía',
    uf: 'PA',
    valor_estimado: 'R$ 450.000,00',
    data_abertura: 'em 17/04/2026 às 09:00Hs, no endereço: www.compras.gov.br',
    modalidade: 'Pregão Eletrônico',
    lei: 'Lei Nº 14.133/2021',
    portal: 'www.compras.gov.br',
  },
} satisfies TemplateEntry

// Styles — clean, technical, minimal
const main = { backgroundColor: '#ffffff', fontFamily: "'Arial', 'Helvetica', sans-serif" }
const container = { backgroundColor: '#ffffff', padding: '0', margin: '0 auto', maxWidth: '640px' }
const headerSection = { padding: '20px 24px 12px' }
const senderLine = { fontSize: '13px', fontWeight: '700' as const, color: '#333333', letterSpacing: '2px', margin: '0 0 4px', textTransform: 'uppercase' as const }
const dateLine = { fontSize: '12px', color: '#666666', margin: '0' }
const divider = { borderColor: '#dddddd', margin: '0 24px' }
const bodySection = { padding: '12px 24px 0' }
const orgaoText = { fontSize: '14px', fontWeight: '700' as const, color: '#111111', margin: '0 0 4px', lineHeight: '1.5' }
const fieldText = { fontSize: '13px', color: '#333333', margin: '0 0 4px', lineHeight: '1.6' }
const objetoLabel = { fontSize: '13px', color: '#333333', margin: '0 0 4px', lineHeight: '1.6' }
const objetoValue = { fontWeight: '700' as const }
const footerSection = { padding: '16px 24px 20px' }
const footerText = { fontSize: '11px', color: '#999999', margin: '0 0 2px', lineHeight: '1.5' }
