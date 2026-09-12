/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

/**
 * Digest de reajuste contratual — o aviso que evita a preclusão.
 *
 * Dispara nos marcos 90/60/30/7/0 dias antes do aniversário da data-base e,
 * depois de devido, uma vez por mês. A mensagem central é jurídica, não
 * decorativa: pedir o reajuste ANTES de assinar qualquer aditivo (Parecer
 * AGU 3/2023 — prorrogação aceita sem ressalva pode ser lida como renúncia).
 */

interface ContratoLinha {
  numero: string
  orgao: string
  indice: string
  aniversario: string // dd/mm/aaaa
  situacao: string    // "faltam 30 dias" | "devido desde …"
  urgente: boolean
}

interface ReajusteProps {
  nome?: string | null
  data?: string
  contratos?: ContratoLinha[]
}

const ReajusteEmail = ({ nome, data, contratos = [] }: ReajusteProps) => {
  const devidos = contratos.filter(c => c.urgente).length
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {devidos > 0
          ? `${devidos} contrato(s) com reajuste devido ou iminente`
          : 'Aniversário de reajuste contratual se aproximando'}
      </Preview>
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 8, padding: 24, maxWidth: 560 }}>
          <Heading as="h2" style={{ fontSize: 18, margin: '0 0 4px' }}>
            Reajuste contratual — relógio do interregno anual
          </Heading>
          <Text style={{ color: '#52525b', fontSize: 13, margin: '0 0 16px' }}>
            {nome ? `${nome}, ` : ''}o Praefectus vigia a data-base dos contratos. Situação em {data}:
          </Text>

          {contratos.map((c, i) => (
            <div key={i} style={{
              borderLeft: `4px solid ${c.urgente ? '#dc2626' : '#f59e0b'}`,
              background: c.urgente ? '#fef2f2' : '#fffbeb',
              padding: '10px 12px', borderRadius: 6, marginBottom: 8,
            }}>
              <Text style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                Contrato {c.numero} — {c.orgao}
              </Text>
              <Text style={{ margin: '2px 0 0', fontSize: 13, color: c.urgente ? '#991b1b' : '#92400e', fontWeight: 600 }}>
                {c.situacao} · aniversário {c.aniversario} · índice {c.indice}
              </Text>
            </div>
          ))}

          <Hr style={{ borderColor: '#e4e4e7', margin: '16px 0' }} />
          <Text style={{ fontSize: 12, color: '#52525b', lineHeight: '1.5' }}>
            <b>Por que este aviso importa:</b> o reajuste (Lei 14.133/2021, art. 92, §3º) exige
            interregno mínimo de 1 ano da data-base (Lei 10.192/2001) e se aplica por simples
            apostila (art. 136, I). Registre o pedido formal <b>antes</b> de assinar qualquer
            aditivo — prorrogação aceita sem ressalva pode ser lida como renúncia (preclusão
            lógica, Parecer AGU 3/2023). A calculadora exata, com a série oficial SGS/BCB e
            memória de cálculo, está no card Reajuste da página do contrato.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: ReajusteEmail,
  subject: (data) => {
    const contratos = (data.contratos as ContratoLinha[] | undefined) ?? []
    const devidos = contratos.filter(c => c.urgente).length
    return devidos > 0
      ? `🚨 Reajuste contratual devido/iminente — ${devidos} contrato(s)`
      : `⏳ Aniversário de reajuste se aproximando — ${contratos.length} contrato(s)`
  },
  displayName: 'Reajuste contratual (digest)',
  previewData: {
    nome: 'Contabilidade Exemplo',
    data: '12/09/2026',
    contratos: [
      { numero: '068/2025', orgao: 'SEDUC/PA', indice: 'IPCA', aniversario: '01/02/2026', situacao: 'devido desde 01/02/2026 (7 mês(es))', urgente: true },
      { numero: '022/2024', orgao: 'Prefeitura de Benevides', indice: 'IGP-M', aniversario: '15/10/2026', situacao: 'faltam 30 dias', urgente: false },
    ],
  },
}
