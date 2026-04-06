/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação — PRAEFECTUS</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>
            <span style={logoPrae}>PRAE</span>
            <span style={logoFectus}>FECTUS</span>
          </Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Código de verificação</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Section style={codeContainer}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={footer}>
          Este código expira em poucos minutos. Se você não solicitou este código,
          ignore este e-mail com segurança.
        </Text>
        <Hr style={divider} />
        <Text style={footerBrand}>
          © {new Date().getFullYear()} PRAEFECTUS — Inteligência em Licitações
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logoText = { fontSize: '24px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '1px' }
const logoPrae = { color: '#1e3352' }
const logoFectus = { color: '#f97316' }
const divider = { borderColor: '#e5e7eb', margin: '20px 0' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#182a40', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#727d8a', lineHeight: '1.6', margin: '0 0 20px' }
const codeContainer = { textAlign: 'center' as const, margin: '20px 0 28px' }
const codeStyle = {
  fontFamily: "'JetBrains Mono', Courier, monospace",
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#1e3352',
  letterSpacing: '4px',
  margin: '0',
  padding: '16px 24px',
  backgroundColor: '#f5f5f5',
  borderRadius: '8px',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
const footerBrand = { fontSize: '11px', color: '#b0b0b0', textAlign: 'center' as const, margin: '12px 0 0' }
