/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoBar}>
          <Text style={logoText}>PRAEFECTUS</Text>
        </div>
        <Heading style={h1}>Você foi convidado</Heading>
        <Text style={text}>
          Você foi convidado a participar da plataforma{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Clique no botão abaixo para aceitar o convite e criar sua conta.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Aceitar Convite
        </Button>
        <Text style={footer}>
          Se você não esperava este convite, pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#f5f6f8', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '8px', margin: '40px auto', maxWidth: '560px', overflow: 'hidden' as const }
const logoBar = { backgroundColor: 'hsl(215, 50%, 23%)', padding: '20px 25px', textAlign: 'center' as const }
const logoText = { color: '#ffffff', fontSize: '20px', fontWeight: 'bold' as const, letterSpacing: '3px', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(215, 40%, 16%)', margin: '30px 25px 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 12%, 50%)', lineHeight: '1.6', margin: '0 25px 20px' }
const link = { color: 'hsl(24, 95%, 53%)', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(24, 95%, 53%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', display: 'block', textAlign: 'center' as const, margin: '0 25px 30px' }
const footer = { fontSize: '12px', color: '#999999', margin: '0 25px 25px', borderTop: '1px solid #eee', paddingTop: '20px' }
