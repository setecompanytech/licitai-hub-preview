/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Button, Link,
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
  modalidade?: string
  lei?: string
  portal?: string
  url_edital?: string
  url_portal?: string
  urgencia?: 'critica' | 'alta' | 'normal'
  horas_restantes?: number
}

const tipoLabels: Record<string, { label: string; desc: string }> = {
  manha: { label: 'Novas Licitações — Manhã', desc: 'Nova oportunidade publicada' },
  meiodia: { label: 'Alterações e Avisos — Meio-dia', desc: 'Alteração ou aviso identificado' },
  tarde: { label: 'Resultados do Dia — Tarde', desc: 'Resultado publicado' },
  lembrete: { label: 'Lembrete de Prazo', desc: 'Abertura iminente' },
}

const urgenciaLabels: Record<string, { texto: string; cor: string }> = {
  critica: { texto: 'ABERTURA EM MENOS DE 24H', cor: '#b91c1c' },
  alta: { texto: 'ABERTURA NAS PROXIMAS 72H', cor: '#b45309' },
  normal: { texto: '', cor: '' },
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
    url_edital,
    url_portal,
    urgencia = 'normal',
    horas_restantes,
  } = props

  const cfg = tipoLabels[tipo] || tipoLabels.manha
  const dataStr = data || new Date().toLocaleDateString('pt-BR')
  const localStr = [municipio, uf].filter(Boolean).join('/')
  const urg = urgenciaLabels[urgencia] || urgenciaLabels.normal

  // Determine the best link to show
  const linkEdital = url_edital || url_portal || null

  const previewText = numero_pregao
    ? `${urgencia !== 'normal' ? urg.texto + ' — ' : ''}${numero_pregao} ${localStr ? `PM ${localStr}` : ''}`
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

          {urgencia !== 'normal' && (
            <Section style={{ padding: '12px 24px 0' }}>
              <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{
                      backgroundColor: urg.cor,
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '700' as const,
                      letterSpacing: '1px',
                      padding: '8px 14px',
                      textTransform: 'uppercase' as const,
                    }}>
                      {urg.texto}
                      {horas_restantes != null && horas_restantes > 0
                        ? ` — ${horas_restantes}h restantes`
                        : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}

          {orgao && (
            <Section style={bodySection}>
              <Text style={orgaoText}>{orgao.toUpperCase()}</Text>
              {codigo_uasg && <Text style={fieldText}>Codigo da UASG: {codigo_uasg}</Text>}
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

          {/* Link para o edital / portal */}
          {linkEdital && (
            <Section style={{ padding: '16px 24px 4px' }}>
              <Button
                href={linkEdital}
                style={btnEdital}
              >
                Acessar Edital no Portal
              </Button>
              <Text style={linkSmall}>
                <Link href={linkEdital} style={{ color: '#1a5276', fontSize: '11px' }}>
                  {linkEdital.length > 80 ? linkEdital.substring(0, 80) + '...' : linkEdital}
                </Link>
              </Text>
            </Section>
          )}

          <Hr style={divider} />

          <Section style={footerSection}>
            <Text style={footerText}>
              Aviso enviado automaticamente pelo {SITE_NAME}.
            </Text>
            <Text style={footerText}>
              Gerencie suas preferencias de boletim nas configuracoes do sistema.
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
    const urgPrefix = data.urgencia === 'critica'
      ? 'URGENTE — '
      : data.urgencia === 'alta'
        ? 'PRAZO — '
        : '';

    if (data.numero_pregao) {
      const local = [data.municipio, data.uf].filter(Boolean).join('/')
      return `${urgPrefix}${data.numero_pregao}${local ? ` - ${data.orgao?.substring(0, 30) || ''} ${local}` : ''}`
    }
    const cfg = tipoLabels[data.tipo] || tipoLabels.manha
    return `${urgPrefix}${cfg.label} — ${data.data || new Date().toLocaleDateString('pt-BR')}`
  },
  displayName: 'Boletim Diario',
  previewData: {
    tipo: 'lembrete',
    data: '07/04/2026',
    numero_pregao: 'Pregao Eletronico No PE/004.2026',
    orgao: 'CAMARA MUNICIPAL DE TRAIRAO',
    codigo_uasg: 'CMT',
    objeto: 'REGISTRO DE PRECO PARA FUTURA E EVENTUAL CONTRATACAO DE EMPRESA ESPECIALIZADA NO FORNECIMENTO DE REFEICOES PRONTAS TIPO MARMITA, REFEICAO COMERCIAL, SERVICOS DE COFFEE BREAK, PARA ATENDER AS DEMANDAS DA CAMARA MUNICIPAL DE TRAIRAO',
    municipio: 'Trairao',
    uf: 'PA',
    valor_estimado: 'R$ 388.711,50',
    data_abertura: '2026-04-07T10:00:00+00:00',
    modalidade: 'Pregao Eletronico',
    portal: 'PNCP',
    url_edital: 'https://pncp.gov.br/app/editais/12345678000190/2026/1',
    urgencia: 'critica',
    horas_restantes: 7,
  },
} satisfies TemplateEntry

// Styles
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
const btnEdital = {
  backgroundColor: '#0c2d48',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: '700' as const,
  padding: '10px 24px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  borderRadius: '4px',
}
const linkSmall = { fontSize: '11px', color: '#666666', margin: '6px 0 0', lineHeight: '1.4' }
