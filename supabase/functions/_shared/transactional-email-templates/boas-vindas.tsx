/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PRAEFECTUS'

interface BoasVindasProps {
  nome?: string
}

const BoasVindasEmail = ({ nome }: BoasVindasProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo(a) ao {SITE_NAME}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoBar}>
          <Text style={logoText}>PRAEFECTUS</Text>
        </div>
        <Heading style={h1}>
          {nome ? `Bem-vindo(a), ${nome}!` : 'Bem-vindo(a) ao PRAEFECTUS!'}
        </Heading>
        <Text style={text}>
          Estamos muito felizes em ter você conosco! A plataforma inteligente de licitações está pronta para potencializar seus resultados.
        </Text>
        <Text style={text}>
          Aqui estão algumas ações para começar:
        </Text>
        <Text style={text}>
          ✅ Configure sua empresa e CNAEs de interesse{'\n'}
          ✅ Ative o monitoramento de editais{'\n'}
          ✅ Explore as ferramentas de precificação
        </Text>
        <Button style={button} href="https://praefectus.com.br/dashboard">
          Acessar Plataforma
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          Qualquer dúvida, nossa equipe de suporte está à disposição.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BoasVindasEmail,
  subject: 'Bem-vindo(a) ao PRAEFECTUS! 🎉',
  displayName: 'Boas-vindas',
  previewData: { nome: 'Maria' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { backgroundColor: '#ffffff', padding: '0', borderRadius: '8px', margin: '40px auto', maxWidth: '560px', overflow: 'hidden' as const }
const logoBar = { backgroundColor: 'hsl(215, 50%, 23%)', padding: '20px 25px', textAlign: 'center' as const }
const logoText = { color: '#ffffff', fontSize: '20px', fontWeight: 'bold' as const, letterSpacing: '3px', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(215, 40%, 16%)', margin: '30px 25px 20px' }
const text = { fontSize: '14px', color: 'hsl(215, 12%, 50%)', lineHeight: '1.6', margin: '0 25px 20px', whiteSpace: 'pre-line' as const }
const button = { backgroundColor: 'hsl(24, 95%, 53%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', display: 'block', textAlign: 'center' as const, margin: '0 25px 30px' }
const hr = { borderColor: '#eee', margin: '0 25px' }
const footer = { fontSize: '12px', color: '#999999', margin: '20px 25px 25px' }
