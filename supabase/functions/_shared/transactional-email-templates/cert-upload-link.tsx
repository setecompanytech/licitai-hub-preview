/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PRAEFECTUS'

interface CertUploadLinkProps {
  nome?: string
  empresa?: string
  cnpj?: string
  link?: string
  expira?: string
}

const CertUploadLinkEmail = ({ nome, empresa, cnpj, link, expira }: CertUploadLinkProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>🔐 Upload seguro de Certificado Digital — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoBar}>
          <Text style={logoText}>PRAEFECTUS</Text>
        </div>
        <Heading style={h1}>
          Upload de Certificado Digital
        </Heading>
        <Text style={text}>
          {nome ? `Olá, ${nome}!` : 'Olá!'}
        </Text>
        <Text style={text}>
          Seu Agente Cloud Enterprise foi ativado com sucesso para a empresa <strong>{empresa || 'sua empresa'}</strong>
          {cnpj ? ` (CNPJ: ${cnpj})` : ''}.
        </Text>
        <Text style={text}>
          Acesse o link abaixo para enviar seu certificado digital (.pfx/.p12) de forma segura para o container dedicado e isolado da sua empresa:
        </Text>
        {link && (
          <Button style={button} href={link}>
            Enviar Certificado Digital
          </Button>
        )}
        <Text style={warningText}>
          ⏰ Este link expira em <strong>24 horas</strong>{expira ? ` (${expira})` : ''}.
        </Text>
        <Text style={warningText}>
          ⚠️ O certificado será armazenado em container isolado e criptografado, exclusivo da sua empresa.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Em caso de dúvidas, entre em contato com nossa equipe de suporte.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CertUploadLinkEmail,
  subject: '🔐 Upload de Certificado Digital — PRAEFECTUS',
  displayName: 'Link de Upload de Certificado',
  previewData: {
    nome: 'João Silva',
    empresa: 'Empresa Exemplo LTDA',
    cnpj: '12.345.678/0001-90',
    link: 'https://praefectus.com.br/certificado-upload?token=abc123',
    expira: '01/04/2026 15:30',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '8px', margin: '40px auto', maxWidth: '560px', overflow: 'hidden' as const }
const logoBar = { backgroundColor: 'hsl(215, 50%, 23%)', padding: '20px 25px', textAlign: 'center' as const }
const logoText = { color: '#ffffff', fontSize: '20px', fontWeight: 'bold' as const, letterSpacing: '3px', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(215, 40%, 16%)', margin: '30px 25px 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 12%, 50%)', lineHeight: '1.6', margin: '0 25px 20px' }
const warningText = { fontSize: '13px', color: 'hsl(24, 70%, 45%)', lineHeight: '1.5', margin: '0 25px 15px' }
const button = { backgroundColor: 'hsl(24, 95%, 53%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', display: 'block', textAlign: 'center' as const, margin: '0 25px 30px' }
const hr = { borderColor: '#eee', margin: '0 25px' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 25px 25px' }
