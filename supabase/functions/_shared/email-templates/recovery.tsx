/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefinir sua senha — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>
            <span style={logoPrae}>PRAE</span>
            <span style={logoFectus}>FECTUS</span>
          </Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Redefinir sua senha</Heading>
        <Text style={text}>
          Recebemos uma solicitação para redefinir sua senha no {siteName}.
          Clique no botão abaixo para escolher uma nova senha.
        </Text>
        <Section style={buttonContainer}>
          <Button style={button} href={confirmationUrl}>
            Redefinir Senha
          </Button>
        </Section>
        <Text style={footer}>
          Se você não solicitou a redefinição de senha, ignore este e-mail.
          Sua senha permanecerá inalterada.
        </Text>
        <Hr style={divider} />
        <Text style={footerBrand}>
          © {new Date().getFullYear()} PRAEFECTUS — Inteligência em Licitações
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logoText = { fontSize: '24px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '1px' }
const logoPrae = { color: '#1e3352' }
const logoFectus = { color: '#f97316' }
const divider = { borderColor: '#e5e7eb', margin: '20px 0' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#182a40', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#727d8a', lineHeight: '1.6', margin: '0 0 20px' }
const buttonContainer = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#1e3352',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
const footerBrand = { fontSize: '11px', color: '#b0b0b0', textAlign: 'center' as const, margin: '12px 0 0' }
