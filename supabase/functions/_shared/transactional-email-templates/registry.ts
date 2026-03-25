/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as boasVindas } from './boas-vindas.tsx'
import { template as confirmacaoPedido } from './confirmacao-pedido.tsx'
import { template as notificacaoSistema } from './notificacao-sistema.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'boas-vindas': boasVindas,
  'confirmacao-pedido': confirmacaoPedido,
  'notificacao-sistema': notificacaoSistema,
}
