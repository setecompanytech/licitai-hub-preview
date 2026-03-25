/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PRAEFECTUS'

interface ConfirmacaoPedidoProps {
  nome?: string
  numeroPedido?: string
  contrato?: string
  itens?: string
  valorTotal?: string
}

const ConfirmacaoPedidoEmail = ({ nome, numeroPedido, contrato, itens, valorTotal }: ConfirmacaoPedidoProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Pedido {numeroPedido || ''} confirmado — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoBar}>
          <Text style={logoText}>PRAEFECTUS</Text>
        </div>
        <Heading style={h1}>Pedido Confirmado ✅</Heading>
        <Text style={text}>
          {nome ? `Olá, ${nome}!` : 'Olá!'}
        </Text>
        <Text style={text}>
          Seu pedido foi registrado com sucesso na plataforma.
        </Text>

        {numeroPedido && (
          <div style={infoBox}>
            <Text style={infoLabel}>Nº do Pedido</Text>
            <Text style={infoValue}>{numeroPedido}</Text>
          </div>
        )}

        {contrato && (
          <div style={infoBox}>
            <Text style={infoLabel}>Contrato</Text>
            <Text style={infoValue}>{contrato}</Text>
          </div>
        )}

        {itens && (
          <div style={infoBox}>
            <Text style={infoLabel}>Itens</Text>
            <Text style={infoValue}>{itens}</Text>
          </div>
        )}

        {valorTotal && (
          <div style={infoBox}>
            <Text style={infoLabel}>Valor Total</Text>
            <Text style={infoValue}>{valorTotal}</Text>
          </div>
        )}

        <Button style={button} href="https://praefectus.com.br/gestao-contratos">
          Ver Pedido
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          Acompanhe todos os seus pedidos na plataforma.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConfirmacaoPedidoEmail,
  subject: (data: Record<string, any>) => `Pedido ${data.numeroPedido || ''} confirmado — PRAEFECTUS`,
  displayName: 'Confirmação de pedido',
  previewData: { nome: 'João', numeroPedido: 'PED-2026-0042', contrato: 'CT-001/2026', itens: '3 itens', valorTotal: 'R$ 12.500,00' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '8px', margin: '40px auto', maxWidth: '560px', overflow: 'hidden' as const }
const logoBar = { backgroundColor: 'hsl(215, 50%, 23%)', padding: '20px 25px', textAlign: 'center' as const }
const logoText = { color: '#ffffff', fontSize: '20px', fontWeight: 'bold' as const, letterSpacing: '3px', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(215, 40%, 16%)', margin: '30px 25px 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 12%, 50%)', lineHeight: '1.6', margin: '0 25px 20px' }
const infoBox = { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '12px 16px', margin: '0 25px 8px' }
const infoLabel = { fontSize: '11px', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 4px' }
const infoValue = { fontSize: '15px', color: 'hsl(215, 40%, 16%)', fontWeight: '600' as const, margin: '0' }
const button = { backgroundColor: 'hsl(24, 95%, 53%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', display: 'block', textAlign: 'center' as const, margin: '16px 25px 30px' }
const hr = { borderColor: '#eee', margin: '0 25px' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 25px 25px' }
