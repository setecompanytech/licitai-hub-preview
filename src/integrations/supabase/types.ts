export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agente_externo_config: {
        Row: {
          api_key_hash: string | null
          capacidades: Json | null
          created_at: string
          id: string
          max_sessoes_paralelas: number
          nome: string
          ram_mb: number | null
          sessoes_ativas: number
          status: string
          ultimo_heartbeat: string | null
          updated_at: string
          url_base: string
          user_id: string
          versao_agente: string | null
        }
        Insert: {
          api_key_hash?: string | null
          capacidades?: Json | null
          created_at?: string
          id?: string
          max_sessoes_paralelas?: number
          nome?: string
          ram_mb?: number | null
          sessoes_ativas?: number
          status?: string
          ultimo_heartbeat?: string | null
          updated_at?: string
          url_base: string
          user_id: string
          versao_agente?: string | null
        }
        Update: {
          api_key_hash?: string | null
          capacidades?: Json | null
          created_at?: string
          id?: string
          max_sessoes_paralelas?: number
          nome?: string
          ram_mb?: number | null
          sessoes_ativas?: number
          status?: string
          ultimo_heartbeat?: string | null
          updated_at?: string
          url_base?: string
          user_id?: string
          versao_agente?: string | null
        }
        Relationships: []
      }
      alerta_dispatches: {
        Row: {
          canal: string
          created_at: string
          enviado_em: string | null
          erro: string | null
          hash_enviado: string | null
          id: string
          licitacao_cache_id: string
          lido_em: string | null
          perfil_alerta_id: string
          status: string
          user_id: string
          versao_enviada: number | null
        }
        Insert: {
          canal?: string
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          hash_enviado?: string | null
          id?: string
          licitacao_cache_id: string
          lido_em?: string | null
          perfil_alerta_id: string
          status?: string
          user_id: string
          versao_enviada?: number | null
        }
        Update: {
          canal?: string
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          hash_enviado?: string | null
          id?: string
          licitacao_cache_id?: string
          lido_em?: string | null
          perfil_alerta_id?: string
          status?: string
          user_id?: string
          versao_enviada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alerta_dispatches_licitacao_cache_id_fkey"
            columns: ["licitacao_cache_id"]
            isOneToOne: false
            referencedRelation: "pncp_editais_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_dispatches_perfil_alerta_id_fkey"
            columns: ["perfil_alerta_id"]
            isOneToOne: false
            referencedRelation: "perfis_alerta"
            referencedColumns: ["id"]
          },
        ]
      }
      apoio_contabil: {
        Row: {
          conteudo: string | null
          created_at: string
          fundamentacao: string | null
          id: string
          licitacao_id: string | null
          status: string | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          fundamentacao?: string | null
          id?: string
          licitacao_id?: string | null
          status?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          fundamentacao?: string | null
          id?: string
          licitacao_id?: string | null
          status?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apoio_contabil_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      apoio_juridico: {
        Row: {
          conteudo: string | null
          created_at: string
          fundamentacao: string | null
          id: string
          licitacao_id: string | null
          status: string | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          fundamentacao?: string | null
          id?: string
          licitacao_id?: string | null
          status?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          fundamentacao?: string | null
          id?: string
          licitacao_id?: string | null
          status?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apoio_juridico_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          forma_pagamento: string | null
          id: string
          liberado_por: string | null
          observacoes: string | null
          plano_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          valor_pago: number | null
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          id?: string
          liberado_por?: string | null
          observacoes?: string | null
          plano_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          valor_pago?: number | null
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          id?: string
          liberado_por?: string | null
          observacoes?: string | null
          plano_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades_colaborador: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          metadata: Json | null
          modulo: string
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          metadata?: Json | null
          modulo?: string
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          metadata?: Json | null
          modulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_colaborador_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_lances: {
        Row: {
          created_at: string
          detalhes: Json
          evento: string
          hash_anterior: string | null
          hash_registro: string | null
          id: string
          ip_address: string | null
          licitacao_id: string | null
          nivel_automacao: number
          rodada: number | null
          sessao_id: string | null
          user_agent: string | null
          user_id: string
          valor_lance: number | null
        }
        Insert: {
          created_at?: string
          detalhes?: Json
          evento: string
          hash_anterior?: string | null
          hash_registro?: string | null
          id?: string
          ip_address?: string | null
          licitacao_id?: string | null
          nivel_automacao?: number
          rodada?: number | null
          sessao_id?: string | null
          user_agent?: string | null
          user_id: string
          valor_lance?: number | null
        }
        Update: {
          created_at?: string
          detalhes?: Json
          evento?: string
          hash_anterior?: string | null
          hash_registro?: string | null
          id?: string
          ip_address?: string | null
          licitacao_id?: string | null
          nivel_automacao?: number
          rodada?: number | null
          sessao_id?: string | null
          user_agent?: string | null
          user_id?: string
          valor_lance?: number | null
        }
        Relationships: []
      }
      backup_config: {
        Row: {
          alerta_calendario: boolean
          ativo: boolean
          backup_storage: boolean
          created_at: string
          dia_mes: number | null
          dia_semana: number | null
          email_destino: string | null
          enviar_email: boolean
          frequencia: string
          hora_execucao: string | null
          id: string
          proximo_backup: string | null
          ultimo_backup: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alerta_calendario?: boolean
          ativo?: boolean
          backup_storage?: boolean
          created_at?: string
          dia_mes?: number | null
          dia_semana?: number | null
          email_destino?: string | null
          enviar_email?: boolean
          frequencia?: string
          hora_execucao?: string | null
          id?: string
          proximo_backup?: string | null
          ultimo_backup?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alerta_calendario?: boolean
          ativo?: boolean
          backup_storage?: boolean
          created_at?: string
          dia_mes?: number | null
          dia_semana?: number | null
          email_destino?: string | null
          enviar_email?: boolean
          frequencia?: string
          hora_execucao?: string | null
          id?: string
          proximo_backup?: string | null
          ultimo_backup?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backup_historico: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          registros_total: number | null
          status: string
          storage_path: string | null
          tabelas_exportadas: string[] | null
          tamanho_bytes: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          registros_total?: number | null
          status?: string
          storage_path?: string | null
          tabelas_exportadas?: string[] | null
          tamanho_bytes?: number | null
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          registros_total?: number | null
          status?: string
          storage_path?: string | null
          tabelas_exportadas?: string[] | null
          tamanho_bytes?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      backup_verificacao: {
        Row: {
          created_at: string
          detalhes: Json | null
          erros: string[] | null
          id: string
          registros_verificados: number | null
          status: string
          tabelas_verificadas: string[] | null
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          erros?: string[] | null
          id?: string
          registros_verificados?: number | null
          status?: string
          tabelas_verificadas?: string[] | null
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          erros?: string[] | null
          id?: string
          registros_verificados?: number | null
          status?: string
          tabelas_verificadas?: string[] | null
        }
        Relationships: []
      }
      base_contabil: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          created_at: string
          data_documento: string | null
          ementa: string | null
          id: string
          numero_documento: string | null
          orgao_emissor: string | null
          tags: string[] | null
          texto_integral: string | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          created_at?: string
          data_documento?: string | null
          ementa?: string | null
          id?: string
          numero_documento?: string | null
          orgao_emissor?: string | null
          tags?: string[] | null
          texto_integral?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          created_at?: string
          data_documento?: string | null
          ementa?: string | null
          id?: string
          numero_documento?: string | null
          orgao_emissor?: string | null
          tags?: string[] | null
          texto_integral?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      base_juridica: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          created_at: string
          data_documento: string | null
          ementa: string | null
          id: string
          numero_processo: string | null
          tags: string[] | null
          texto_integral: string | null
          tipo: string
          titulo: string
          tribunal: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          created_at?: string
          data_documento?: string | null
          ementa?: string | null
          id?: string
          numero_processo?: string | null
          tags?: string[] | null
          texto_integral?: string | null
          tipo?: string
          titulo: string
          tribunal?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          created_at?: string
          data_documento?: string | null
          ementa?: string | null
          id?: string
          numero_processo?: string | null
          tags?: string[] | null
          texto_integral?: string | null
          tipo?: string
          titulo?: string
          tribunal?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_artigos: {
        Row: {
          autor: string
          caso_fortuito: boolean | null
          categoria: string
          conteudo: string
          created_at: string
          data_publicacao: string
          destaque: boolean | null
          fonte_nome: string | null
          fonte_url: string | null
          forca_maior: boolean | null
          id: string
          resumo: string
          tags: string[] | null
          tcu_referencia: string | null
          tempo_leitura: string
          titulo: string
          updated_at: string
        }
        Insert: {
          autor?: string
          caso_fortuito?: boolean | null
          categoria?: string
          conteudo: string
          created_at?: string
          data_publicacao?: string
          destaque?: boolean | null
          fonte_nome?: string | null
          fonte_url?: string | null
          forca_maior?: boolean | null
          id?: string
          resumo: string
          tags?: string[] | null
          tcu_referencia?: string | null
          tempo_leitura?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          autor?: string
          caso_fortuito?: boolean | null
          categoria?: string
          conteudo?: string
          created_at?: string
          data_publicacao?: string
          destaque?: boolean | null
          fonte_nome?: string | null
          fonte_url?: string | null
          forca_maior?: boolean | null
          id?: string
          resumo?: string
          tags?: string[] | null
          tcu_referencia?: string | null
          tempo_leitura?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      boletim_envios: {
        Row: {
          created_at: string
          email: string
          erro: string | null
          id: string
          resend_id: string | null
          status: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          erro?: string | null
          id?: string
          resend_id?: string | null
          status?: string
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          erro?: string | null
          id?: string
          resend_id?: string | null
          status?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      boletim_preferencias: {
        Row: {
          boletim_manha: boolean
          boletim_meiodia: boolean
          boletim_tarde: boolean
          created_at: string
          email: string
          id: string
          notificacao_push: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          boletim_manha?: boolean
          boletim_meiodia?: boolean
          boletim_tarde?: boolean
          created_at?: string
          email: string
          id?: string
          notificacao_push?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          boletim_manha?: boolean
          boletim_meiodia?: boolean
          boletim_tarde?: boolean
          created_at?: string
          email?: string
          id?: string
          notificacao_push?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      boletos: {
        Row: {
          api_response: Json | null
          codigo_barras: string | null
          conta_bancaria_id: string | null
          conta_receber_id: string | null
          contrato_id: string | null
          created_at: string
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string
          empresa_id: string | null
          id: string
          instrucoes: string | null
          linha_digitavel: string | null
          nosso_numero: string | null
          numero_documento: string | null
          observacoes: string | null
          sacado_cep: string | null
          sacado_cidade: string | null
          sacado_cnpj_cpf: string | null
          sacado_endereco: string | null
          sacado_nome: string | null
          sacado_uf: string | null
          status: string
          updated_at: string
          user_id: string
          valor_desconto: number | null
          valor_juros: number | null
          valor_multa: number | null
          valor_nominal: number
        }
        Insert: {
          api_response?: Json | null
          codigo_barras?: string | null
          conta_bancaria_id?: string | null
          conta_receber_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          empresa_id?: string | null
          id?: string
          instrucoes?: string | null
          linha_digitavel?: string | null
          nosso_numero?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          sacado_cep?: string | null
          sacado_cidade?: string | null
          sacado_cnpj_cpf?: string | null
          sacado_endereco?: string | null
          sacado_nome?: string | null
          sacado_uf?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_nominal?: number
        }
        Update: {
          api_response?: Json | null
          codigo_barras?: string | null
          conta_bancaria_id?: string | null
          conta_receber_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          empresa_id?: string | null
          id?: string
          instrucoes?: string | null
          linha_digitavel?: string | null
          nosso_numero?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          sacado_cep?: string | null
          sacado_cidade?: string | null
          sacado_cnpj_cpf?: string | null
          sacado_endereco?: string | null
          sacado_nome?: string | null
          sacado_uf?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_nominal?: number
        }
        Relationships: [
          {
            foreignKeyName: "boletos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_conta_receber_id_fkey"
            columns: ["conta_receber_id"]
            isOneToOne: false
            referencedRelation: "contas_receber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_itens_precificados: {
        Row: {
          bdi_percentual: number | null
          created_at: string
          custo_unitario: number
          descricao: string
          detalhes: Json | null
          fabricante: string | null
          frete_percentual: number | null
          id: string
          licitacao_id: string | null
          licitacao_numero: string | null
          licitacao_orgao: string | null
          marca: string | null
          margem_lucro: number | null
          modelo: string | null
          preco_total: number
          preco_unitario: number
          quantidade: number
          regime_tributario: string | null
          tipo_calculo: string
          tributos_total: number | null
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bdi_percentual?: number | null
          created_at?: string
          custo_unitario?: number
          descricao: string
          detalhes?: Json | null
          fabricante?: string | null
          frete_percentual?: number | null
          id?: string
          licitacao_id?: string | null
          licitacao_numero?: string | null
          licitacao_orgao?: string | null
          marca?: string | null
          margem_lucro?: number | null
          modelo?: string | null
          preco_total?: number
          preco_unitario?: number
          quantidade?: number
          regime_tributario?: string | null
          tipo_calculo?: string
          tributos_total?: number | null
          unidade?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bdi_percentual?: number | null
          created_at?: string
          custo_unitario?: number
          descricao?: string
          detalhes?: Json | null
          fabricante?: string | null
          frete_percentual?: number | null
          id?: string
          licitacao_id?: string | null
          licitacao_numero?: string | null
          licitacao_orgao?: string | null
          marca?: string | null
          margem_lucro?: number | null
          modelo?: string | null
          preco_total?: number
          preco_unitario?: number
          quantidade?: number
          regime_tributario?: string | null
          tipo_calculo?: string
          tributos_total?: number | null
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_itens_precificados_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string
          icone: string | null
          id: string
          nome: string
          tipo: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          nome: string
          tipo: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          nome?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      cert_upload_tokens: {
        Row: {
          cert_file_path: string | null
          created_at: string
          empresa_id: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          cert_file_path?: string | null
          created_at?: string
          empresa_id: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          cert_file_path?: string | null
          created_at?: string
          empresa_id?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cert_upload_tokens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      comissoes_config: {
        Row: {
          ativo: boolean | null
          created_at: string
          empresa_id: string
          id: string
          percentual: number | null
          regra_desconto: Json | null
          tipo_comissao: string
          updated_at: string
          user_id: string
          valor_fixo: number | null
          visibilidade_publica: boolean | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          empresa_id: string
          id?: string
          percentual?: number | null
          regra_desconto?: Json | null
          tipo_comissao?: string
          updated_at?: string
          user_id: string
          valor_fixo?: number | null
          visibilidade_publica?: boolean | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          empresa_id?: string
          id?: string
          percentual?: number | null
          regra_desconto?: Json | null
          tipo_comissao?: string
          updated_at?: string
          user_id?: string
          valor_fixo?: number | null
          visibilidade_publica?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes_lancamentos: {
        Row: {
          contrato_id: string | null
          contrato_pedido_id: string | null
          created_at: string
          desconto_percentual: number | null
          empresa_id: string
          id: string
          licitacao_id: string | null
          nota_fiscal: string | null
          observacoes: string | null
          pago_em: string | null
          percentual_comissao: number | null
          solicitado_por: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
          valor_base: number
          valor_comissao: number
        }
        Insert: {
          contrato_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          desconto_percentual?: number | null
          empresa_id: string
          id?: string
          licitacao_id?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          pago_em?: string | null
          percentual_comissao?: number | null
          solicitado_por?: string | null
          status?: string
          tipo: string
          updated_at?: string
          user_id: string
          valor_base?: number
          valor_comissao?: number
        }
        Update: {
          contrato_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          desconto_percentual?: number | null
          empresa_id?: string
          id?: string
          licitacao_id?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          pago_em?: string | null
          percentual_comissao?: number | null
          solicitado_por?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_base?: number
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_lancamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_lancamentos_contrato_pedido_id_fkey"
            columns: ["contrato_pedido_id"]
            isOneToOne: false
            referencedRelation: "contrato_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_lancamentos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      composicoes_custo: {
        Row: {
          created_at: string
          dados_json: Json
          descricao_item: string
          ia_result: string | null
          id: string
          licitacao_id: string | null
          licitacao_item_id: string | null
          regime_tributario: string | null
          uf: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados_json?: Json
          descricao_item?: string
          ia_result?: string | null
          id?: string
          licitacao_id?: string | null
          licitacao_item_id?: string | null
          regime_tributario?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados_json?: Json
          descricao_item?: string
          ia_result?: string | null
          id?: string
          licitacao_id?: string | null
          licitacao_item_id?: string | null
          regime_tributario?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "composicoes_custo_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composicoes_custo_licitacao_item_id_fkey"
            columns: ["licitacao_item_id"]
            isOneToOne: false
            referencedRelation: "licitacao_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacao_regras: {
        Row: {
          acao: string
          ativo: boolean | null
          categoria_destino: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          padrao_texto: string
          prioridade: number | null
          tipo_match: string
          updated_at: string
          user_id: string
          vezes_aplicada: number | null
        }
        Insert: {
          acao?: string
          ativo?: boolean | null
          categoria_destino?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          padrao_texto: string
          prioridade?: number | null
          tipo_match?: string
          updated_at?: string
          user_id: string
          vezes_aplicada?: number | null
        }
        Update: {
          acao?: string
          ativo?: boolean | null
          categoria_destino?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          padrao_texto?: string
          prioridade?: number | null
          tipo_match?: string
          updated_at?: string
          user_id?: string
          vezes_aplicada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      concorrentes: {
        Row: {
          capital_social: number | null
          cnae_principal: string | null
          cnaes_secundarios: string[] | null
          cnpj: string
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          municipio: string | null
          nome_fantasia: string | null
          notas: string | null
          porte: string | null
          razao_social: string
          situacao: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          capital_social?: number | null
          cnae_principal?: string | null
          cnaes_secundarios?: string[] | null
          cnpj: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          notas?: string | null
          porte?: string | null
          razao_social: string
          situacao?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          capital_social?: number | null
          cnae_principal?: string | null
          cnaes_secundarios?: string[] | null
          cnpj?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          notas?: string | null
          porte?: string | null
          razao_social?: string
          situacao?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          alerta_email: boolean | null
          alerta_sistema: boolean | null
          alerta_whatsapp: boolean | null
          cnaes_monitorados: string[] | null
          created_at: string
          diarios_monitorados: Json | null
          id: string
          municipio_sede: string | null
          municipios_interesse: string[] | null
          notificacoes_config: Json | null
          notificacoes_email: boolean | null
          notificacoes_push: boolean | null
          palavras_chave: string[] | null
          portais_monitorados: Json | null
          priorizar_regiao_sede: boolean | null
          segmentos_prioridade: string[] | null
          uf_sede: string | null
          ufs_interesse: string[] | null
          updated_at: string
          user_id: string
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          alerta_email?: boolean | null
          alerta_sistema?: boolean | null
          alerta_whatsapp?: boolean | null
          cnaes_monitorados?: string[] | null
          created_at?: string
          diarios_monitorados?: Json | null
          id?: string
          municipio_sede?: string | null
          municipios_interesse?: string[] | null
          notificacoes_config?: Json | null
          notificacoes_email?: boolean | null
          notificacoes_push?: boolean | null
          palavras_chave?: string[] | null
          portais_monitorados?: Json | null
          priorizar_regiao_sede?: boolean | null
          segmentos_prioridade?: string[] | null
          uf_sede?: string | null
          ufs_interesse?: string[] | null
          updated_at?: string
          user_id: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          alerta_email?: boolean | null
          alerta_sistema?: boolean | null
          alerta_whatsapp?: boolean | null
          cnaes_monitorados?: string[] | null
          created_at?: string
          diarios_monitorados?: Json | null
          id?: string
          municipio_sede?: string | null
          municipios_interesse?: string[] | null
          notificacoes_config?: Json | null
          notificacoes_email?: boolean | null
          notificacoes_push?: boolean | null
          palavras_chave?: string[] | null
          portais_monitorados?: Json | null
          priorizar_regiao_sede?: boolean | null
          segmentos_prioridade?: string[] | null
          uf_sede?: string | null
          ufs_interesse?: string[] | null
          updated_at?: string
          user_id?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: []
      }
      conhecimento_ia: {
        Row: {
          categoria: string
          confiabilidade: number | null
          conteudo: string
          created_at: string
          fontes: Json | null
          id: string
          metadata: Json | null
          tags: string[] | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
          verificado: boolean | null
        }
        Insert: {
          categoria?: string
          confiabilidade?: number | null
          conteudo: string
          created_at?: string
          fontes?: Json | null
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
          verificado?: boolean | null
        }
        Update: {
          categoria?: string
          confiabilidade?: number | null
          conteudo?: string
          created_at?: string
          fontes?: Json | null
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          verificado?: boolean | null
        }
        Relationships: []
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco_codigo: string | null
          banco_nome: string
          conta: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          saldo_atual: number | null
          saldo_inicial: number | null
          tipo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          banco_codigo?: string | null
          banco_nome: string
          conta?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          banco_codigo?: string | null
          banco_nome?: string
          conta?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar: {
        Row: {
          categoria: string | null
          conta_bancaria_id: string | null
          contrato_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          empresa_id: string
          fornecedor: string | null
          id: string
          juros_percentual: number | null
          multa_percentual: number | null
          nota_fiscal: string | null
          observacoes: string | null
          parcela_grupo_id: string | null
          parcela_numero: number | null
          parcela_total: number | null
          recorrente: boolean | null
          status: string | null
          updated_at: string
          user_id: string
          valor: number
          valor_desconto: number | null
          valor_juros: number | null
          valor_multa: number | null
          valor_pago: number | null
        }
        Insert: {
          categoria?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          empresa_id: string
          fornecedor?: string | null
          id?: string
          juros_percentual?: number | null
          multa_percentual?: number | null
          nota_fiscal?: string | null
          observacoes?: string | null
          parcela_grupo_id?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          recorrente?: boolean | null
          status?: string | null
          updated_at?: string
          user_id: string
          valor?: number
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_pago?: number | null
        }
        Update: {
          categoria?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          empresa_id?: string
          fornecedor?: string | null
          id?: string
          juros_percentual?: number | null
          multa_percentual?: number | null
          nota_fiscal?: string | null
          observacoes?: string | null
          parcela_grupo_id?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          recorrente?: boolean | null
          status?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber: {
        Row: {
          categoria: string | null
          cliente: string | null
          conta_bancaria_id: string | null
          contrato_id: string | null
          contrato_pedido_id: string | null
          created_at: string
          data_recebimento: string | null
          data_vencimento: string
          descricao: string
          empresa_id: string
          id: string
          juros_percentual: number | null
          multa_percentual: number | null
          nota_fiscal_id: string | null
          numero_nf: string | null
          observacoes: string | null
          parcela_grupo_id: string | null
          parcela_numero: number | null
          parcela_total: number | null
          status: string | null
          updated_at: string
          user_id: string
          valor: number
          valor_desconto: number | null
          valor_juros: number | null
          valor_multa: number | null
          valor_recebido: number | null
        }
        Insert: {
          categoria?: string | null
          cliente?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_vencimento: string
          descricao: string
          empresa_id: string
          id?: string
          juros_percentual?: number | null
          multa_percentual?: number | null
          nota_fiscal_id?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          parcela_grupo_id?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
          valor?: number
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_recebido?: number | null
        }
        Update: {
          categoria?: string | null
          cliente?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string
          empresa_id?: string
          id?: string
          juros_percentual?: number | null
          multa_percentual?: number | null
          nota_fiscal_id?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          parcela_grupo_id?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_contrato_pedido_id_fkey"
            columns: ["contrato_pedido_id"]
            isOneToOne: false
            referencedRelation: "contrato_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_receber_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_aditivos: {
        Row: {
          contrato_id: string
          created_at: string
          data_aditivo: string | null
          id: string
          justificativa: string | null
          numero_aditivo: string
          prazo_adicional_dias: number | null
          tipo: string
          user_id: string
          valor_aditivo: number | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          data_aditivo?: string | null
          id?: string
          justificativa?: string | null
          numero_aditivo: string
          prazo_adicional_dias?: number | null
          tipo?: string
          user_id: string
          valor_aditivo?: number | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          data_aditivo?: string | null
          id?: string
          justificativa?: string | null
          numero_aditivo?: string
          prazo_adicional_dias?: number | null
          tipo?: string
          user_id?: string
          valor_aditivo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_custos: {
        Row: {
          categoria: string | null
          contrato_id: string
          contrato_pedido_id: string | null
          created_at: string
          data_lancamento: string | null
          descricao: string
          id: string
          nota_fiscal: string | null
          observacoes: string | null
          tipo: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          contrato_id: string
          contrato_pedido_id?: string | null
          created_at?: string
          data_lancamento?: string | null
          descricao: string
          id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          contrato_id?: string
          contrato_pedido_id?: string | null
          created_at?: string
          data_lancamento?: string | null
          descricao?: string
          id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_custos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_custos_contrato_pedido_id_fkey"
            columns: ["contrato_pedido_id"]
            isOneToOne: false
            referencedRelation: "contrato_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_itens: {
        Row: {
          codigo_item: string | null
          contrato_id: string
          created_at: string
          descricao: string
          id: string
          observacoes: string | null
          quantidade_consumida: number
          quantidade_contratada: number
          saldo_financeiro: number
          saldo_quantitativo: number
          unidade: string
          updated_at: string
          user_id: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          codigo_item?: string | null
          contrato_id: string
          created_at?: string
          descricao: string
          id?: string
          observacoes?: string | null
          quantidade_consumida?: number
          quantidade_contratada?: number
          saldo_financeiro?: number
          saldo_quantitativo?: number
          unidade?: string
          updated_at?: string
          user_id: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          codigo_item?: string | null
          contrato_id?: string
          created_at?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          quantidade_consumida?: number
          quantidade_contratada?: number
          saldo_financeiro?: number
          saldo_quantitativo?: number
          unidade?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_itens_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_pedidos: {
        Row: {
          contrato_id: string
          contrato_item_id: string | null
          created_at: string
          data_entrega: string | null
          data_pedido: string | null
          data_quitacao: string | null
          descricao: string | null
          id: string
          nf_quitada: boolean | null
          nota_fiscal: string | null
          numero_pedido: string
          observacoes: string | null
          quantidade: number
          status: string
          updated_at: string
          user_id: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          contrato_id: string
          contrato_item_id?: string | null
          created_at?: string
          data_entrega?: string | null
          data_pedido?: string | null
          data_quitacao?: string | null
          descricao?: string | null
          id?: string
          nf_quitada?: boolean | null
          nota_fiscal?: string | null
          numero_pedido: string
          observacoes?: string | null
          quantidade?: number
          status?: string
          updated_at?: string
          user_id: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          contrato_id?: string
          contrato_item_id?: string | null
          created_at?: string
          data_entrega?: string | null
          data_pedido?: string | null
          data_quitacao?: string | null
          descricao?: string | null
          id?: string
          nf_quitada?: boolean | null
          nota_fiscal?: string | null
          numero_pedido?: string
          observacoes?: string | null
          quantidade?: number
          status?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_pedidos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_pedidos_contrato_item_id_fkey"
            columns: ["contrato_item_id"]
            isOneToOne: false
            referencedRelation: "contrato_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          created_at: string
          data_assinatura: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string | null
          fiscal_email: string | null
          fiscal_nome: string | null
          fiscal_telefone: string | null
          id: string
          licitacao_id: string | null
          modalidade: string | null
          municipio: string | null
          numero_contrato: string
          objeto: string
          observacoes: string | null
          orgao_contratante: string
          saldo_remanescente: number | null
          status: string
          uf: string | null
          updated_at: string
          user_id: string
          valor_consumido: number
          valor_global: number
          vigencia_meses: number | null
        }
        Insert: {
          created_at?: string
          data_assinatura?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          fiscal_email?: string | null
          fiscal_nome?: string | null
          fiscal_telefone?: string | null
          id?: string
          licitacao_id?: string | null
          modalidade?: string | null
          municipio?: string | null
          numero_contrato: string
          objeto: string
          observacoes?: string | null
          orgao_contratante: string
          saldo_remanescente?: number | null
          status?: string
          uf?: string | null
          updated_at?: string
          user_id: string
          valor_consumido?: number
          valor_global?: number
          vigencia_meses?: number | null
        }
        Update: {
          created_at?: string
          data_assinatura?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          fiscal_email?: string | null
          fiscal_nome?: string | null
          fiscal_telefone?: string | null
          id?: string
          licitacao_id?: string | null
          modalidade?: string | null
          municipio?: string | null
          numero_contrato?: string
          objeto?: string
          observacoes?: string | null
          orgao_contratante?: string
          saldo_remanescente?: number | null
          status?: string
          uf?: string | null
          updated_at?: string
          user_id?: string
          valor_consumido?: number
          valor_global?: number
          vigencia_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_gov: {
        Row: {
          ano: number
          created_at: string
          descricao: string | null
          id: string
          modalidade: string | null
          orgao: string
          quantidade_itens: number
          situacao: string | null
          tipo: string
          updated_at: string
          user_id: string
          valor_total: number
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          descricao?: string | null
          id?: string
          modalidade?: string | null
          orgao: string
          quantidade_itens?: number
          situacao?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
          valor_total?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          descricao?: string | null
          id?: string
          modalidade?: string | null
          orgao?: string
          quantidade_itens?: number
          situacao?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      convencoes_coletivas: {
        Row: {
          abrangencia_municipios: string[] | null
          abrangencia_uf: string | null
          arquivo_path: string | null
          beneficios: Json | null
          categoria_profissional: string
          created_at: string
          id: string
          indice_reajuste: string | null
          numero_registro_mte: string | null
          observacoes: string | null
          piso_salarial: number | null
          reajuste_percentual: number | null
          sindicato_laboral: string | null
          sindicato_patronal: string | null
          status: string | null
          updated_at: string
          user_id: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          abrangencia_municipios?: string[] | null
          abrangencia_uf?: string | null
          arquivo_path?: string | null
          beneficios?: Json | null
          categoria_profissional: string
          created_at?: string
          id?: string
          indice_reajuste?: string | null
          numero_registro_mte?: string | null
          observacoes?: string | null
          piso_salarial?: number | null
          reajuste_percentual?: number | null
          sindicato_laboral?: string | null
          sindicato_patronal?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          abrangencia_municipios?: string[] | null
          abrangencia_uf?: string | null
          arquivo_path?: string | null
          beneficios?: Json | null
          categoria_profissional?: string
          created_at?: string
          id?: string
          indice_reajuste?: string | null
          numero_registro_mte?: string | null
          observacoes?: string | null
          piso_salarial?: number | null
          reajuste_percentual?: number | null
          sindicato_laboral?: string | null
          sindicato_patronal?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      cotacoes_fornecedor: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          cnpj_fornecedor: string | null
          created_at: string
          data_cotacao: string | null
          id: string
          itens: Json
          nome_fornecedor: string
          observacoes: string | null
          updated_at: string
          user_id: string
          validade_dias: number | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          cnpj_fornecedor?: string | null
          created_at?: string
          data_cotacao?: string | null
          id?: string
          itens?: Json
          nome_fornecedor: string
          observacoes?: string | null
          updated_at?: string
          user_id: string
          validade_dias?: number | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          cnpj_fornecedor?: string | null
          created_at?: string
          data_cotacao?: string | null
          id?: string
          itens?: Json
          nome_fornecedor?: string
          observacoes?: string | null
          updated_at?: string
          user_id?: string
          validade_dias?: number | null
        }
        Relationships: []
      }
      credenciais_portais: {
        Row: {
          certificado_nome: string | null
          certificado_path: string | null
          certificado_tipo: string | null
          created_at: string
          id: string
          login: string | null
          portal_id: string
          portal_nome: string
          senha_hash: string | null
          status: string | null
          updated_at: string
          user_id: string
          validade_certificado: string | null
        }
        Insert: {
          certificado_nome?: string | null
          certificado_path?: string | null
          certificado_tipo?: string | null
          created_at?: string
          id?: string
          login?: string | null
          portal_id: string
          portal_nome: string
          senha_hash?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          validade_certificado?: string | null
        }
        Update: {
          certificado_nome?: string | null
          certificado_path?: string | null
          certificado_tipo?: string | null
          created_at?: string
          id?: string
          login?: string | null
          portal_id?: string
          portal_nome?: string
          senha_hash?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          validade_certificado?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          legislacao_base: string | null
          modelo_conteudo: string | null
          nome: string
          prompt_sistema: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          legislacao_base?: string | null
          modelo_conteudo?: string | null
          nome: string
          prompt_sistema: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          legislacao_base?: string | null
          modelo_conteudo?: string | null
          nome?: string
          prompt_sistema?: string
          updated_at?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          arquivo_path: string | null
          arquivo_url: string | null
          created_at: string
          descricao: string | null
          id: string
          licitacao_id: string | null
          nome: string
          tamanho_bytes: number | null
          tipo: string
          updated_at: string
          user_id: string
          validade: string | null
        }
        Insert: {
          arquivo_path?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          licitacao_id?: string | null
          nome: string
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          user_id: string
          validade?: string | null
        }
        Update: {
          arquivo_path?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          licitacao_id?: string | null
          nome?: string
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          user_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_categorias: {
        Row: {
          ativo: boolean | null
          created_at: string
          empresa_id: string | null
          grupo: string
          id: string
          nome: string
          ordem: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          empresa_id?: string | null
          grupo?: string
          id?: string
          nome: string
          ordem?: number | null
          tipo?: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          empresa_id?: string | null
          grupo?: string
          id?: string
          nome?: string
          ordem?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      editais_favoritos: {
        Row: {
          created_at: string
          data_abertura: string | null
          id: string
          modalidade: string | null
          municipio: string | null
          notas: string | null
          numero: string
          objeto: string
          orgao: string
          portal: string | null
          uf: string | null
          url: string | null
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string
          data_abertura?: string | null
          id?: string
          modalidade?: string | null
          municipio?: string | null
          notas?: string | null
          numero: string
          objeto: string
          orgao: string
          portal?: string | null
          uf?: string | null
          url?: string | null
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string
          data_abertura?: string | null
          id?: string
          modalidade?: string | null
          municipio?: string | null
          notas?: string | null
          numero?: string
          objeto?: string
          orgao?: string
          portal?: string | null
          uf?: string | null
          url?: string | null
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresa_membros: {
        Row: {
          created_at: string
          email: string | null
          empresa_id: string
          equipe: string | null
          id: string
          nome: string | null
          papel: Database["public"]["Enums"]["empresa_papel"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa_id: string
          equipe?: string | null
          id?: string
          nome?: string | null
          papel?: Database["public"]["Enums"]["empresa_papel"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa_id?: string
          equipe?: string | null
          id?: string
          nome?: string | null
          papel?: Database["public"]["Enums"]["empresa_papel"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_membros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          bairro: string | null
          cabecalho_path: string | null
          cabecalho_url: string | null
          cep: string | null
          certificado_nome: string | null
          certificado_path: string | null
          certificado_tipo: string | null
          certificado_validade: string | null
          cnae_principal: string | null
          cnpj: string
          complemento: string | null
          created_at: string
          created_by: string
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          municipio: string | null
          nome_fantasia: string | null
          razao_social: string
          regime_tributario: string | null
          rep_cargo: string | null
          rep_cpf: string | null
          rep_nacionalidade: string | null
          rep_naturalidade: string | null
          rep_nome: string | null
          rep_orgao_expedidor: string | null
          rep_rg: string | null
          rodape_path: string | null
          rodape_url: string | null
          telefone: string | null
          timbrado_path: string | null
          timbrado_url: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cabecalho_path?: string | null
          cabecalho_url?: string | null
          cep?: string | null
          certificado_nome?: string | null
          certificado_path?: string | null
          certificado_tipo?: string | null
          certificado_validade?: string | null
          cnae_principal?: string | null
          cnpj: string
          complemento?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social: string
          regime_tributario?: string | null
          rep_cargo?: string | null
          rep_cpf?: string | null
          rep_nacionalidade?: string | null
          rep_naturalidade?: string | null
          rep_nome?: string | null
          rep_orgao_expedidor?: string | null
          rep_rg?: string | null
          rodape_path?: string | null
          rodape_url?: string | null
          telefone?: string | null
          timbrado_path?: string | null
          timbrado_url?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cabecalho_path?: string | null
          cabecalho_url?: string | null
          cep?: string | null
          certificado_nome?: string | null
          certificado_path?: string | null
          certificado_tipo?: string | null
          certificado_validade?: string | null
          cnae_principal?: string | null
          cnpj?: string
          complemento?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          regime_tributario?: string | null
          rep_cargo?: string | null
          rep_cpf?: string | null
          rep_nacionalidade?: string | null
          rep_naturalidade?: string | null
          rep_nome?: string | null
          rep_orgao_expedidor?: string | null
          rep_rg?: string | null
          rodape_path?: string | null
          rodape_url?: string | null
          telefone?: string | null
          timbrado_path?: string | null
          timbrado_url?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estrategia_ia: {
        Row: {
          analise_ia: string | null
          categoria: string | null
          confianca: number | null
          created_at: string
          decremento_sugerido: number | null
          desconto_medio: number | null
          historico_disputas: number | null
          id: string
          licitacao_id: string | null
          objeto: string | null
          orgao: string | null
          preco_medio_fechamento: number | null
          updated_at: string
          user_id: string
          valor_minimo_sugerido: number | null
        }
        Insert: {
          analise_ia?: string | null
          categoria?: string | null
          confianca?: number | null
          created_at?: string
          decremento_sugerido?: number | null
          desconto_medio?: number | null
          historico_disputas?: number | null
          id?: string
          licitacao_id?: string | null
          objeto?: string | null
          orgao?: string | null
          preco_medio_fechamento?: number | null
          updated_at?: string
          user_id: string
          valor_minimo_sugerido?: number | null
        }
        Update: {
          analise_ia?: string | null
          categoria?: string | null
          confianca?: number | null
          created_at?: string
          decremento_sugerido?: number | null
          desconto_medio?: number | null
          historico_disputas?: number | null
          id?: string
          licitacao_id?: string | null
          objeto?: string | null
          orgao?: string | null
          preco_medio_fechamento?: number | null
          updated_at?: string
          user_id?: string
          valor_minimo_sugerido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estrategia_ia_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      faq: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string
          id: string
          ordem: number | null
          pergunta: string
          resposta: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string
          id?: string
          ordem?: number | null
          pergunta: string
          resposta: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string
          id?: string
          ordem?: number | null
          pergunta?: string
          resposta?: string
          updated_at?: string
        }
        Relationships: []
      }
      fontes_fabricantes: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          nome: string
          palavras_chave: string[] | null
          prioridade: number
          updated_at: string
          url_base: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          nome: string
          palavras_chave?: string[] | null
          prioridade?: number
          updated_at?: string
          url_base: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          nome?: string
          palavras_chave?: string[] | null
          prioridade?: number
          updated_at?: string
          url_base?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          arquivo_nome: string | null
          created_at: string
          erros: Json | null
          id: string
          registros_importados: number | null
          registros_total: number | null
          source_id: string | null
          status: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string
          erros?: Json | null
          id?: string
          registros_importados?: number | null
          registros_total?: number | null
          source_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string
          erros?: Json | null
          id?: string
          registros_importados?: number | null
          registros_total?: number | null
          source_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "search_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      indices_economicos: {
        Row: {
          acumulado_12m: number | null
          categoria: string
          created_at: string
          fonte: string
          id: string
          metadata: Json | null
          nome: string
          periodo: string
          sigla: string
          updated_at: string
          valor: number
          variacao_anual: number | null
          variacao_mensal: number | null
        }
        Insert: {
          acumulado_12m?: number | null
          categoria?: string
          created_at?: string
          fonte?: string
          id?: string
          metadata?: Json | null
          nome: string
          periodo: string
          sigla: string
          updated_at?: string
          valor: number
          variacao_anual?: number | null
          variacao_mensal?: number | null
        }
        Update: {
          acumulado_12m?: number | null
          categoria?: string
          created_at?: string
          fonte?: string
          id?: string
          metadata?: Json | null
          nome?: string
          periodo?: string
          sigla?: string
          updated_at?: string
          valor?: number
          variacao_anual?: number | null
          variacao_mensal?: number | null
        }
        Relationships: []
      }
      kanban_tasks: {
        Row: {
          created_at: string
          data_limite: string | null
          descricao: string | null
          id: string
          licitacao_id: string | null
          ordem: number | null
          prioridade: string | null
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          licitacao_id?: string | null
          ordem?: number | null
          prioridade?: string | null
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          licitacao_id?: string | null
          ordem?: number | null
          prioridade?: string | null
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_tasks_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      lances: {
        Row: {
          automatico: boolean | null
          created_at: string
          data_lance: string | null
          decremento: number | null
          id: string
          licitacao_id: string | null
          resultado: string | null
          status: string | null
          user_id: string
          valor_lance: number
          valor_minimo: number | null
        }
        Insert: {
          automatico?: boolean | null
          created_at?: string
          data_lance?: string | null
          decremento?: number | null
          id?: string
          licitacao_id?: string | null
          resultado?: string | null
          status?: string | null
          user_id: string
          valor_lance: number
          valor_minimo?: number | null
        }
        Update: {
          automatico?: boolean | null
          created_at?: string
          data_lance?: string | null
          decremento?: number | null
          id?: string
          licitacao_id?: string | null
          resultado?: string | null
          status?: string | null
          user_id?: string
          valor_lance?: number
          valor_minimo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lances_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      lances_historico: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          origem: string
          rodada: number
          sessao_id: string
          timestamp_lance: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          origem?: string
          rodada: number
          sessao_id: string
          timestamp_lance?: string
          tipo?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          origem?: string
          rodada?: number
          sessao_id?: string
          timestamp_lance?: string
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lances_historico_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_lance_real"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cargo: string | null
          cnpj: string | null
          convertido: boolean | null
          created_at: string
          data_conversao: string | null
          email: string
          empresa: string | null
          id: string
          interesse: string | null
          ip_address: string | null
          municipio: string | null
          nome: string
          notas: string | null
          origem: string | null
          plano_convertido: string | null
          referrer: string | null
          segmento: string | null
          status: string
          telefone: string | null
          uf: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_convertido: number | null
        }
        Insert: {
          cargo?: string | null
          cnpj?: string | null
          convertido?: boolean | null
          created_at?: string
          data_conversao?: string | null
          email: string
          empresa?: string | null
          id?: string
          interesse?: string | null
          ip_address?: string | null
          municipio?: string | null
          nome: string
          notas?: string | null
          origem?: string | null
          plano_convertido?: string | null
          referrer?: string | null
          segmento?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_convertido?: number | null
        }
        Update: {
          cargo?: string | null
          cnpj?: string | null
          convertido?: boolean | null
          created_at?: string
          data_conversao?: string | null
          email?: string
          empresa?: string | null
          id?: string
          interesse?: string | null
          ip_address?: string | null
          municipio?: string | null
          nome?: string
          notas?: string | null
          origem?: string | null
          plano_convertido?: string | null
          referrer?: string | null
          segmento?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_convertido?: number | null
        }
        Relationships: []
      }
      licitacao_itens: {
        Row: {
          created_at: string
          descricao: string
          fabricante: string | null
          id: string
          licitacao_id: string
          lote: string | null
          marca: string | null
          modelo: string | null
          numero: number
          origem: string | null
          quantidade: number
          unidade: string
          updated_at: string
          user_id: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          fabricante?: string | null
          id?: string
          licitacao_id: string
          lote?: string | null
          marca?: string | null
          modelo?: string | null
          numero?: number
          origem?: string | null
          quantidade?: number
          unidade?: string
          updated_at?: string
          user_id: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          fabricante?: string | null
          id?: string
          licitacao_id?: string
          lote?: string | null
          marca?: string | null
          modelo?: string | null
          numero?: number
          origem?: string | null
          quantidade?: number
          unidade?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "licitacao_itens_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacao_mensagens: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          licitacao_id: string
          metadata: Json | null
          tipo: string
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          licitacao_id: string
          metadata?: Json | null
          tipo?: string
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          licitacao_id?: string
          metadata?: Json | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licitacao_mensagens_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacao_scores: {
        Row: {
          classificacao: string
          created_at: string
          descartado: boolean | null
          id: string
          licitacao_cache_id: string
          notificado: boolean | null
          perfil_alerta_id: string
          salvo: boolean | null
          score_cnae: number | null
          score_modalidade: number | null
          score_palavra_chave: number | null
          score_regiao: number | null
          score_total: number
          score_urgencia: number | null
          score_valor: number | null
          user_id: string
        }
        Insert: {
          classificacao?: string
          created_at?: string
          descartado?: boolean | null
          id?: string
          licitacao_cache_id: string
          notificado?: boolean | null
          perfil_alerta_id: string
          salvo?: boolean | null
          score_cnae?: number | null
          score_modalidade?: number | null
          score_palavra_chave?: number | null
          score_regiao?: number | null
          score_total?: number
          score_urgencia?: number | null
          score_valor?: number | null
          user_id: string
        }
        Update: {
          classificacao?: string
          created_at?: string
          descartado?: boolean | null
          id?: string
          licitacao_cache_id?: string
          notificado?: boolean | null
          perfil_alerta_id?: string
          salvo?: boolean | null
          score_cnae?: number | null
          score_modalidade?: number | null
          score_palavra_chave?: number | null
          score_regiao?: number | null
          score_total?: number
          score_urgencia?: number | null
          score_valor?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licitacao_scores_perfil_alerta_id_fkey"
            columns: ["perfil_alerta_id"]
            isOneToOne: false
            referencedRelation: "perfis_alerta"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacoes: {
        Row: {
          arquivado_em: string | null
          created_at: string
          data_abertura: string | null
          data_encerramento: string | null
          data_homologacao: string | null
          empresa_id: string | null
          id: string
          modalidade: string
          municipio: string | null
          numero: string
          objeto: string
          observacoes: string | null
          operador_id: string | null
          orgao: string
          portal: string | null
          resultado: string | null
          status: string
          uf: string | null
          updated_at: string
          url_edital: string | null
          user_id: string
          valor_adjudicado: number | null
          valor_estimado: number | null
          vencedor: boolean | null
        }
        Insert: {
          arquivado_em?: string | null
          created_at?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          data_homologacao?: string | null
          empresa_id?: string | null
          id?: string
          modalidade?: string
          municipio?: string | null
          numero: string
          objeto: string
          observacoes?: string | null
          operador_id?: string | null
          orgao: string
          portal?: string | null
          resultado?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
          url_edital?: string | null
          user_id: string
          valor_adjudicado?: number | null
          valor_estimado?: number | null
          vencedor?: boolean | null
        }
        Update: {
          arquivado_em?: string | null
          created_at?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          data_homologacao?: string | null
          empresa_id?: string | null
          id?: string
          modalidade?: string
          municipio?: string | null
          numero?: string
          objeto?: string
          observacoes?: string | null
          operador_id?: string | null
          orgao?: string
          portal?: string | null
          resultado?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
          url_edital?: string | null
          user_id?: string
          valor_adjudicado?: number | null
          valor_estimado?: number | null
          vencedor?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "licitacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencao_agendada: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string
          data_fim: string
          data_inicio: string
          id: string
          mensagem: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por: string
          data_fim: string
          data_inicio: string
          id?: string
          mensagem: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          mensagem?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      monitoramento_editais: {
        Row: {
          cnae_compativel: boolean | null
          created_at: string
          data_abertura: string | null
          data_encerramento: string | null
          data_publicacao: string | null
          id: string
          lido: boolean | null
          municipio: string | null
          orgao: string
          palavras_chave: string[] | null
          portal: string | null
          relevancia_score: number | null
          status: string | null
          texto_integral: string | null
          tipo: string | null
          titulo: string
          uf: string | null
          updated_at: string
          url: string | null
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          cnae_compativel?: boolean | null
          created_at?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          data_publicacao?: string | null
          id?: string
          lido?: boolean | null
          municipio?: string | null
          orgao: string
          palavras_chave?: string[] | null
          portal?: string | null
          relevancia_score?: number | null
          status?: string | null
          texto_integral?: string | null
          tipo?: string | null
          titulo: string
          uf?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          cnae_compativel?: boolean | null
          created_at?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          data_publicacao?: string | null
          id?: string
          lido?: boolean | null
          municipio?: string | null
          orgao?: string
          palavras_chave?: string[] | null
          portal?: string | null
          relevancia_score?: number | null
          status?: string | null
          texto_integral?: string | null
          tipo?: string | null
          titulo?: string
          uf?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      nota_fiscal_itens: {
        Row: {
          cfop: string | null
          codigo_produto: string | null
          cofins_aliquota: number | null
          cofins_valor: number | null
          created_at: string
          descricao: string
          icms_aliquota: number | null
          icms_valor: number | null
          id: string
          ipi_aliquota: number | null
          ipi_valor: number | null
          iss_aliquota: number | null
          iss_valor: number | null
          ncm: string | null
          nota_fiscal_id: string
          numero_item: number | null
          pis_aliquota: number | null
          pis_valor: number | null
          quantidade: number | null
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          cfop?: string | null
          codigo_produto?: string | null
          cofins_aliquota?: number | null
          cofins_valor?: number | null
          created_at?: string
          descricao: string
          icms_aliquota?: number | null
          icms_valor?: number | null
          id?: string
          ipi_aliquota?: number | null
          ipi_valor?: number | null
          iss_aliquota?: number | null
          iss_valor?: number | null
          ncm?: string | null
          nota_fiscal_id: string
          numero_item?: number | null
          pis_aliquota?: number | null
          pis_valor?: number | null
          quantidade?: number | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          cfop?: string | null
          codigo_produto?: string | null
          cofins_aliquota?: number | null
          cofins_valor?: number | null
          created_at?: string
          descricao?: string
          icms_aliquota?: number | null
          icms_valor?: number | null
          id?: string
          ipi_aliquota?: number | null
          ipi_valor?: number | null
          iss_aliquota?: number | null
          iss_valor?: number | null
          ncm?: string | null
          nota_fiscal_id?: string
          numero_item?: number | null
          pis_aliquota?: number | null
          pis_valor?: number | null
          quantidade?: number | null
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          base_calculo_icms: number | null
          cfop: string | null
          chave_acesso: string | null
          contrato_id: string | null
          contrato_pedido_id: string | null
          created_at: string
          data_emissao: string | null
          destinatario_cnpj: string | null
          destinatario_endereco: string | null
          destinatario_ie: string | null
          destinatario_municipio: string | null
          destinatario_nome_fantasia: string | null
          destinatario_razao_social: string | null
          destinatario_uf: string | null
          empresa_id: string | null
          id: string
          informacoes_complementares: string | null
          modelo: string | null
          motivo_rejeicao: string | null
          natureza_operacao: string | null
          numero_nf: string | null
          nuvem_fiscal_id: string | null
          nuvem_fiscal_status: string | null
          observacoes: string | null
          pdf_danfe_path: string | null
          protocolo_autorizacao: string | null
          serie: string | null
          status: string | null
          tipo: string
          updated_at: string
          user_id: string
          valor_cofins: number | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_icms: number | null
          valor_iss: number | null
          valor_pis: number | null
          valor_produtos: number | null
          valor_servicos: number | null
          valor_total: number | null
          xml_envio: string | null
          xml_retorno: string | null
        }
        Insert: {
          base_calculo_icms?: number | null
          cfop?: string | null
          chave_acesso?: string | null
          contrato_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          data_emissao?: string | null
          destinatario_cnpj?: string | null
          destinatario_endereco?: string | null
          destinatario_ie?: string | null
          destinatario_municipio?: string | null
          destinatario_nome_fantasia?: string | null
          destinatario_razao_social?: string | null
          destinatario_uf?: string | null
          empresa_id?: string | null
          id?: string
          informacoes_complementares?: string | null
          modelo?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string | null
          numero_nf?: string | null
          nuvem_fiscal_id?: string | null
          nuvem_fiscal_status?: string | null
          observacoes?: string | null
          pdf_danfe_path?: string | null
          protocolo_autorizacao?: string | null
          serie?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number | null
          xml_envio?: string | null
          xml_retorno?: string | null
        }
        Update: {
          base_calculo_icms?: number | null
          cfop?: string | null
          chave_acesso?: string | null
          contrato_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          data_emissao?: string | null
          destinatario_cnpj?: string | null
          destinatario_endereco?: string | null
          destinatario_ie?: string | null
          destinatario_municipio?: string | null
          destinatario_nome_fantasia?: string | null
          destinatario_razao_social?: string | null
          destinatario_uf?: string | null
          empresa_id?: string | null
          id?: string
          informacoes_complementares?: string | null
          modelo?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string | null
          numero_nf?: string | null
          nuvem_fiscal_id?: string | null
          nuvem_fiscal_status?: string | null
          observacoes?: string | null
          pdf_danfe_path?: string | null
          protocolo_autorizacao?: string | null
          serie?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number | null
          xml_envio?: string | null
          xml_retorno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_contrato_pedido_id_fkey"
            columns: ["contrato_pedido_id"]
            isOneToOne: false
            referencedRelation: "contrato_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean | null
          link: string | null
          mensagem: string | null
          tipo: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string | null
          tipo?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string | null
          tipo?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      nuvem_fiscal_config: {
        Row: {
          ambiente: string | null
          api_key_encrypted: string | null
          ativo: boolean | null
          certificado_path: string | null
          certificado_validade: string | null
          created_at: string
          empresa_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ambiente?: string | null
          api_key_encrypted?: string | null
          ativo?: boolean | null
          certificado_path?: string | null
          certificado_validade?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ambiente?: string | null
          api_key_encrypted?: string | null
          ativo?: boolean | null
          certificado_path?: string | null
          certificado_validade?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nuvem_fiscal_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      offers_normalized: {
        Row: {
          coletado_em: string
          condicao: string | null
          created_at: string
          estoque: boolean | null
          frete: number | null
          id: string
          prazo_dias: number | null
          preco: number
          product_id: string | null
          source_id: string | null
          supplier_name: string | null
          total: number | null
          uf: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          coletado_em?: string
          condicao?: string | null
          created_at?: string
          estoque?: boolean | null
          frete?: number | null
          id?: string
          prazo_dias?: number | null
          preco: number
          product_id?: string | null
          source_id?: string | null
          supplier_name?: string | null
          total?: number | null
          uf?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          coletado_em?: string
          condicao?: string | null
          created_at?: string
          estoque?: boolean | null
          frete?: number | null
          id?: string
          prazo_dias?: number | null
          preco?: number
          product_id?: string | null
          source_id?: string | null
          supplier_name?: string | null
          total?: number | null
          uf?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_normalized_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_normalized"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_normalized_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "search_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_alerta: {
        Row: {
          ativo: boolean
          canal_email: boolean | null
          canal_sistema: boolean | null
          canal_whatsapp: boolean | null
          cnaes: string[] | null
          cor: string | null
          created_at: string
          empresa_id: string | null
          exclusividade_meepp: boolean | null
          frequencia: string | null
          horarios_disparo: string[] | null
          icone: string | null
          id: string
          modalidades: string[] | null
          municipios: string[] | null
          nome: string
          orgaos_bloqueados: string[] | null
          orgaos_favoritos: string[] | null
          palavras_chave: string[] | null
          palavras_negativas: string[] | null
          peso_cnae: number
          peso_modalidade: number
          peso_palavra_chave: number
          peso_regiao: number
          peso_urgencia: number
          peso_valor: number
          priorizar_regiao_sede: boolean | null
          regiao: string | null
          segmentos: string[] | null
          tipos_publicacao: string[] | null
          ufs: string[] | null
          updated_at: string
          user_id: string
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          ativo?: boolean
          canal_email?: boolean | null
          canal_sistema?: boolean | null
          canal_whatsapp?: boolean | null
          cnaes?: string[] | null
          cor?: string | null
          created_at?: string
          empresa_id?: string | null
          exclusividade_meepp?: boolean | null
          frequencia?: string | null
          horarios_disparo?: string[] | null
          icone?: string | null
          id?: string
          modalidades?: string[] | null
          municipios?: string[] | null
          nome?: string
          orgaos_bloqueados?: string[] | null
          orgaos_favoritos?: string[] | null
          palavras_chave?: string[] | null
          palavras_negativas?: string[] | null
          peso_cnae?: number
          peso_modalidade?: number
          peso_palavra_chave?: number
          peso_regiao?: number
          peso_urgencia?: number
          peso_valor?: number
          priorizar_regiao_sede?: boolean | null
          regiao?: string | null
          segmentos?: string[] | null
          tipos_publicacao?: string[] | null
          ufs?: string[] | null
          updated_at?: string
          user_id: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          ativo?: boolean
          canal_email?: boolean | null
          canal_sistema?: boolean | null
          canal_whatsapp?: boolean | null
          cnaes?: string[] | null
          cor?: string | null
          created_at?: string
          empresa_id?: string | null
          exclusividade_meepp?: boolean | null
          frequencia?: string | null
          horarios_disparo?: string[] | null
          icone?: string | null
          id?: string
          modalidades?: string[] | null
          municipios?: string[] | null
          nome?: string
          orgaos_bloqueados?: string[] | null
          orgaos_favoritos?: string[] | null
          palavras_chave?: string[] | null
          palavras_negativas?: string[] | null
          peso_cnae?: number
          peso_modalidade?: number
          peso_palavra_chave?: number
          peso_regiao?: number
          peso_urgencia?: number
          peso_valor?: number
          priorizar_regiao_sede?: boolean | null
          regiao?: string | null
          segmentos?: string[] | null
          tipos_publicacao?: string[] | null
          ufs?: string[] | null
          updated_at?: string
          user_id?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_alerta_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas_preco: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          resultado: string
          termo_busca: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          resultado: string
          termo_busca: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          resultado?: string
          termo_busca?: string
          user_id?: string
        }
        Relationships: []
      }
      planos: {
        Row: {
          ativo: boolean | null
          created_at: string
          descricao: string | null
          destaque: boolean | null
          id: string
          limite_licitacoes: number | null
          limite_usuarios: number | null
          nome: string
          preco_anual: number | null
          preco_bienal: number | null
          preco_mensal: number
          preco_semestral: number | null
          recursos: Json | null
          slug: string
          trial_dias: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean | null
          id?: string
          limite_licitacoes?: number | null
          limite_usuarios?: number | null
          nome: string
          preco_anual?: number | null
          preco_bienal?: number | null
          preco_mensal?: number
          preco_semestral?: number | null
          recursos?: Json | null
          slug: string
          trial_dias?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean | null
          id?: string
          limite_licitacoes?: number | null
          limite_usuarios?: number | null
          nome?: string
          preco_anual?: number | null
          preco_bienal?: number | null
          preco_mensal?: number
          preco_semestral?: number | null
          recursos?: Json | null
          slug?: string
          trial_dias?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pncp_editais_cache: {
        Row: {
          ano_compra: string | null
          cnpj_orgao: string | null
          codigo_unidade: string | null
          created_at: string | null
          data_abertura_proposta: string | null
          data_encerramento_proposta: string | null
          data_publicacao_pncp: string | null
          data_ultima_retificacao: string | null
          esfera_id: string | null
          hash_objeto: string | null
          id: string
          link_sistema_origem: string | null
          modalidade_id: number | null
          modalidade_nome: string | null
          municipio: string | null
          municipio_ibge: string | null
          numero_compra: string | null
          numero_controle_pncp: string | null
          objeto: string | null
          orgao: string | null
          pncp_id: string
          retificacao: boolean
          sequencial_compra: string | null
          situacao: string | null
          srp: boolean | null
          tipo_instrumento: string | null
          uf: string | null
          unidade_orgao: string | null
          updated_at: string | null
          url_pncp: string | null
          valor_total_estimado: number | null
          valor_total_homologado: number | null
          versao: number
          versao_anterior_hash: string | null
        }
        Insert: {
          ano_compra?: string | null
          cnpj_orgao?: string | null
          codigo_unidade?: string | null
          created_at?: string | null
          data_abertura_proposta?: string | null
          data_encerramento_proposta?: string | null
          data_publicacao_pncp?: string | null
          data_ultima_retificacao?: string | null
          esfera_id?: string | null
          hash_objeto?: string | null
          id?: string
          link_sistema_origem?: string | null
          modalidade_id?: number | null
          modalidade_nome?: string | null
          municipio?: string | null
          municipio_ibge?: string | null
          numero_compra?: string | null
          numero_controle_pncp?: string | null
          objeto?: string | null
          orgao?: string | null
          pncp_id: string
          retificacao?: boolean
          sequencial_compra?: string | null
          situacao?: string | null
          srp?: boolean | null
          tipo_instrumento?: string | null
          uf?: string | null
          unidade_orgao?: string | null
          updated_at?: string | null
          url_pncp?: string | null
          valor_total_estimado?: number | null
          valor_total_homologado?: number | null
          versao?: number
          versao_anterior_hash?: string | null
        }
        Update: {
          ano_compra?: string | null
          cnpj_orgao?: string | null
          codigo_unidade?: string | null
          created_at?: string | null
          data_abertura_proposta?: string | null
          data_encerramento_proposta?: string | null
          data_publicacao_pncp?: string | null
          data_ultima_retificacao?: string | null
          esfera_id?: string | null
          hash_objeto?: string | null
          id?: string
          link_sistema_origem?: string | null
          modalidade_id?: number | null
          modalidade_nome?: string | null
          municipio?: string | null
          municipio_ibge?: string | null
          numero_compra?: string | null
          numero_controle_pncp?: string | null
          objeto?: string | null
          orgao?: string | null
          pncp_id?: string
          retificacao?: boolean
          sequencial_compra?: string | null
          situacao?: string | null
          srp?: boolean | null
          tipo_instrumento?: string | null
          uf?: string | null
          unidade_orgao?: string | null
          updated_at?: string | null
          url_pncp?: string | null
          valor_total_estimado?: number | null
          valor_total_homologado?: number | null
          versao?: number
          versao_anterior_hash?: string | null
        }
        Relationships: []
      }
      portal_healthcheck: {
        Row: {
          created_at: string
          detalhes: Json | null
          id: string
          portal_id: string
          portal_nome: string
          proximo_check: string | null
          seletores_falhos: string[] | null
          seletores_ok: boolean | null
          status: string
          ultima_verificacao: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          id?: string
          portal_id: string
          portal_nome: string
          proximo_check?: string | null
          seletores_falhos?: string[] | null
          seletores_ok?: boolean | null
          status?: string
          ultima_verificacao?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          id?: string
          portal_id?: string
          portal_nome?: string
          proximo_check?: string | null
          seletores_falhos?: string[] | null
          seletores_ok?: boolean | null
          status?: string
          ultima_verificacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pre_nota_itens: {
        Row: {
          contrato_item_id: string | null
          contrato_pedido_id: string | null
          created_at: string
          descricao: string
          id: string
          pre_nota_id: string
          quantidade: number
          unidade: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          contrato_item_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          pre_nota_id: string
          quantidade?: number
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          contrato_item_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          pre_nota_id?: string
          quantidade?: number
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "pre_nota_itens_contrato_item_id_fkey"
            columns: ["contrato_item_id"]
            isOneToOne: false
            referencedRelation: "contrato_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_nota_itens_contrato_pedido_id_fkey"
            columns: ["contrato_pedido_id"]
            isOneToOne: false
            referencedRelation: "contrato_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_nota_itens_pre_nota_id_fkey"
            columns: ["pre_nota_id"]
            isOneToOne: false
            referencedRelation: "pre_notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_notas_fiscais: {
        Row: {
          contrato_id: string | null
          created_at: string
          data_revisao: string | null
          empresa_id: string
          endereco_entrega: string | null
          frete_modalidade: string | null
          frete_valor: number | null
          id: string
          justificativa: string | null
          motivo_devolucao: string | null
          motivo_rejeicao: string | null
          natureza_operacao: string
          nota_fiscal_id: string | null
          observacoes: string | null
          revisado_por: string | null
          status: string
          transportadora: string | null
          updated_at: string
          user_id: string
          valor_total: number
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          data_revisao?: string | null
          empresa_id: string
          endereco_entrega?: string | null
          frete_modalidade?: string | null
          frete_valor?: number | null
          id?: string
          justificativa?: string | null
          motivo_devolucao?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao: string
          nota_fiscal_id?: string | null
          observacoes?: string | null
          revisado_por?: string | null
          status?: string
          transportadora?: string | null
          updated_at?: string
          user_id: string
          valor_total?: number
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          data_revisao?: string | null
          empresa_id?: string
          endereco_entrega?: string | null
          frete_modalidade?: string | null
          frete_valor?: number | null
          id?: string
          justificativa?: string | null
          motivo_devolucao?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string
          nota_fiscal_id?: string | null
          observacoes?: string | null
          revisado_por?: string | null
          status?: string
          transportadora?: string | null
          updated_at?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pre_notas_fiscais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_notas_fiscais_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      precificacao: {
        Row: {
          bdi_percentual: number | null
          created_at: string
          custo_unitario: number | null
          descricao: string | null
          fonte_preco: string | null
          id: string
          item: string
          licitacao_id: string | null
          preco_total: number | null
          preco_unitario: number | null
          quantidade: number | null
          referencia_sinapi: string | null
          unidade: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bdi_percentual?: number | null
          created_at?: string
          custo_unitario?: number | null
          descricao?: string | null
          fonte_preco?: string | null
          id?: string
          item: string
          licitacao_id?: string | null
          preco_total?: number | null
          preco_unitario?: number | null
          quantidade?: number | null
          referencia_sinapi?: string | null
          unidade?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bdi_percentual?: number | null
          created_at?: string
          custo_unitario?: number | null
          descricao?: string | null
          fonte_preco?: string | null
          id?: string
          item?: string
          licitacao_id?: string | null
          preco_total?: number | null
          preco_unitario?: number | null
          quantidade?: number | null
          referencia_sinapi?: string | null
          unidade?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "precificacao_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_interesse: {
        Row: {
          alerta_1dia: boolean | null
          alerta_3dias: boolean | null
          alerta_7dias: boolean | null
          alerta_email: boolean | null
          alerta_sistema: boolean | null
          alerta_whatsapp: boolean | null
          aprovado_usuario: boolean | null
          auto_cadastro: boolean | null
          created_at: string
          data_abertura: string | null
          data_encerramento: string | null
          empresa_id: string | null
          ia_recomendacao: string | null
          ia_score: number | null
          id: string
          licitacao_id: string | null
          modalidade: string | null
          municipio: string | null
          notas: string | null
          numero: string
          objeto: string
          orgao: string
          portal: string | null
          preco_validado: boolean | null
          status: string
          uf: string | null
          ultimo_alerta_enviado: string | null
          updated_at: string
          url: string | null
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          alerta_1dia?: boolean | null
          alerta_3dias?: boolean | null
          alerta_7dias?: boolean | null
          alerta_email?: boolean | null
          alerta_sistema?: boolean | null
          alerta_whatsapp?: boolean | null
          aprovado_usuario?: boolean | null
          auto_cadastro?: boolean | null
          created_at?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          empresa_id?: string | null
          ia_recomendacao?: string | null
          ia_score?: number | null
          id?: string
          licitacao_id?: string | null
          modalidade?: string | null
          municipio?: string | null
          notas?: string | null
          numero: string
          objeto: string
          orgao: string
          portal?: string | null
          preco_validado?: boolean | null
          status?: string
          uf?: string | null
          ultimo_alerta_enviado?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          alerta_1dia?: boolean | null
          alerta_3dias?: boolean | null
          alerta_7dias?: boolean | null
          alerta_email?: boolean | null
          alerta_sistema?: boolean | null
          alerta_whatsapp?: boolean | null
          aprovado_usuario?: boolean | null
          auto_cadastro?: boolean | null
          created_at?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          empresa_id?: string | null
          ia_recomendacao?: string | null
          ia_score?: number | null
          id?: string
          licitacao_id?: string | null
          modalidade?: string | null
          municipio?: string | null
          notas?: string | null
          numero?: string
          objeto?: string
          orgao?: string
          portal?: string | null
          preco_validado?: boolean | null
          status?: string
          uf?: string | null
          ultimo_alerta_enviado?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_interesse_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_interesse_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      products_normalized: {
        Row: {
          atributos: Json | null
          categoria: string | null
          created_at: string
          id: string
          marca_normalizada: string | null
          modelo: string | null
          ncm: string | null
          nome_normalizado: string
          palavras_chave: string[] | null
          titulo_original: string | null
          unidade: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          atributos?: Json | null
          categoria?: string | null
          created_at?: string
          id?: string
          marca_normalizada?: string | null
          modelo?: string | null
          ncm?: string | null
          nome_normalizado: string
          palavras_chave?: string[] | null
          titulo_original?: string | null
          unidade?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          atributos?: Json | null
          categoria?: string | null
          created_at?: string
          id?: string
          marca_normalizada?: string | null
          modelo?: string | null
          ncm?: string | null
          nome_normalizado?: string
          palavras_chave?: string[] | null
          titulo_original?: string | null
          unidade?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          cnpj: string | null
          created_at: string
          empresa: string | null
          empresa_ativa_id: string | null
          id: string
          nome_completo: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          cnpj?: string | null
          created_at?: string
          empresa?: string | null
          empresa_ativa_id?: string | null
          id?: string
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          cnpj?: string | null
          created_at?: string
          empresa?: string | null
          empresa_ativa_id?: string | null
          id?: string
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_ativa_id_fkey"
            columns: ["empresa_ativa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          data_coleta: string | null
          descricao: string
          fonte: string | null
          fornecedor: string | null
          frete: number | null
          id: string
          marca: string | null
          observacoes: string | null
          preco_unitario: number
          quantidade: number
          quotation_id: string
          total: number | null
          uf: string | null
          unidade: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          data_coleta?: string | null
          descricao: string
          fonte?: string | null
          fornecedor?: string | null
          frete?: number | null
          id?: string
          marca?: string | null
          observacoes?: string | null
          preco_unitario?: number
          quantidade?: number
          quotation_id: string
          total?: number | null
          uf?: string | null
          unidade?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          data_coleta?: string | null
          descricao?: string
          fonte?: string | null
          fornecedor?: string | null
          frete?: number | null
          id?: string
          marca?: string | null
          observacoes?: string | null
          preco_unitario?: number
          quantidade?: number
          quotation_id?: string
          total?: number | null
          uf?: string | null
          unidade?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          id: string
          list_id: string | null
          nome: string
          observacoes: string | null
          orgao: string | null
          processo: string | null
          status: string | null
          updated_at: string
          user_id: string
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          list_id?: string | null
          nome: string
          observacoes?: string | null
          orgao?: string | null
          processo?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string | null
          nome?: string
          observacoes?: string | null
          orgao?: string | null
          processo?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      rascunhos: {
        Row: {
          created_at: string
          dados: Json
          id: string
          licitacao_id: string | null
          modulo: string
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json
          id?: string
          licitacao_id?: string | null
          modulo: string
          titulo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados?: Json
          id?: string
          licitacao_id?: string | null
          modulo?: string
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rascunhos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      robo_aceite_termos: {
        Row: {
          aceite_politica_uso: boolean
          aceite_responsabilidade: boolean
          codigo_2fa_hash: string | null
          created_at: string
          dupla_autenticacao_verificada: boolean
          id: string
          ip_aceite: string | null
          licitacao_id: string | null
          limite_financeiro: number
          nivel_automacao: number
          revogado_em: string | null
          sessao_id: string | null
          user_agent_aceite: string | null
          user_id: string
        }
        Insert: {
          aceite_politica_uso?: boolean
          aceite_responsabilidade?: boolean
          codigo_2fa_hash?: string | null
          created_at?: string
          dupla_autenticacao_verificada?: boolean
          id?: string
          ip_aceite?: string | null
          licitacao_id?: string | null
          limite_financeiro?: number
          nivel_automacao: number
          revogado_em?: string | null
          sessao_id?: string | null
          user_agent_aceite?: string | null
          user_id: string
        }
        Update: {
          aceite_politica_uso?: boolean
          aceite_responsabilidade?: boolean
          codigo_2fa_hash?: string | null
          created_at?: string
          dupla_autenticacao_verificada?: boolean
          id?: string
          ip_aceite?: string | null
          licitacao_id?: string | null
          limite_financeiro?: number
          nivel_automacao?: number
          revogado_em?: string | null
          sessao_id?: string | null
          user_agent_aceite?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "robo_aceite_termos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robo_aceite_termos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_lance_real"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          filtros: Json | null
          fontes_consultadas: string[] | null
          id: string
          resultados_count: number | null
          termo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filtros?: Json | null
          fontes_consultadas?: string[] | null
          id?: string
          resultados_count?: number | null
          termo: string
          user_id: string
        }
        Update: {
          created_at?: string
          filtros?: Json | null
          fontes_consultadas?: string[] | null
          id?: string
          resultados_count?: number | null
          termo?: string
          user_id?: string
        }
        Relationships: []
      }
      search_sources: {
        Row: {
          ativo: boolean
          campos_suportados: Json | null
          categoria: string | null
          created_at: string
          id: string
          logo_url: string | null
          metodo_ingestao: string
          nome: string
          tipo: string
          updated_at: string
          url_base: string
        }
        Insert: {
          ativo?: boolean
          campos_suportados?: Json | null
          categoria?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          metodo_ingestao?: string
          nome: string
          tipo?: string
          updated_at?: string
          url_base: string
        }
        Update: {
          ativo?: boolean
          campos_suportados?: Json | null
          categoria?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          metodo_ingestao?: string
          nome?: string
          tipo?: string
          updated_at?: string
          url_base?: string
        }
        Relationships: []
      }
      sessoes_lance_real: {
        Row: {
          aceite_id: string | null
          agente_id: string | null
          created_at: string
          decremento_min: number | null
          decremento_percentual: number | null
          edital: string
          erro: string | null
          id: string
          intervalo_segundos: number | null
          lance_config_id: string
          limite_financeiro: number | null
          max_lances: number | null
          modo: string
          nivel_automacao: number
          parada_emergencial: boolean
          parada_emergencial_em: string | null
          parada_emergencial_por: string | null
          portal_id: string
          portal_nome: string
          resultado: string | null
          rodada_atual: number | null
          status: string
          updated_at: string
          user_id: string
          valor_atual: number | null
          valor_inicial: number
          valor_minimo: number
          valor_referencia: number
        }
        Insert: {
          aceite_id?: string | null
          agente_id?: string | null
          created_at?: string
          decremento_min?: number | null
          decremento_percentual?: number | null
          edital: string
          erro?: string | null
          id?: string
          intervalo_segundos?: number | null
          lance_config_id: string
          limite_financeiro?: number | null
          max_lances?: number | null
          modo?: string
          nivel_automacao?: number
          parada_emergencial?: boolean
          parada_emergencial_em?: string | null
          parada_emergencial_por?: string | null
          portal_id: string
          portal_nome: string
          resultado?: string | null
          rodada_atual?: number | null
          status?: string
          updated_at?: string
          user_id: string
          valor_atual?: number | null
          valor_inicial: number
          valor_minimo: number
          valor_referencia: number
        }
        Update: {
          aceite_id?: string | null
          agente_id?: string | null
          created_at?: string
          decremento_min?: number | null
          decremento_percentual?: number | null
          edital?: string
          erro?: string | null
          id?: string
          intervalo_segundos?: number | null
          lance_config_id?: string
          limite_financeiro?: number | null
          max_lances?: number | null
          modo?: string
          nivel_automacao?: number
          parada_emergencial?: boolean
          parada_emergencial_em?: string | null
          parada_emergencial_por?: string | null
          portal_id?: string
          portal_nome?: string
          resultado?: string | null
          rodada_atual?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          valor_atual?: number | null
          valor_inicial?: number
          valor_minimo?: number
          valor_referencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_lance_real_aceite_id_fkey"
            columns: ["aceite_id"]
            isOneToOne: false
            referencedRelation: "robo_aceite_termos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_lance_real_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agente_externo_config"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          created_at: string
          descricao: string
          fonte_referencia: string | null
          id: string
          list_id: string
          marca: string | null
          observacoes: string | null
          preco_referencia: number | null
          product_id: string | null
          quantidade: number
          unidade: string | null
          url_referencia: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          fonte_referencia?: string | null
          id?: string
          list_id: string
          marca?: string | null
          observacoes?: string | null
          preco_referencia?: number | null
          product_id?: string | null
          quantidade?: number
          unidade?: string | null
          url_referencia?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          fonte_referencia?: string | null
          id?: string
          list_id?: string
          marca?: string | null
          observacoes?: string | null
          preco_referencia?: number | null
          product_id?: string | null
          quantidade?: number
          unidade?: string | null
          url_referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_normalized"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simulacoes_repactuacao: {
        Row: {
          categoria: string | null
          created_at: string
          data_base_original: string | null
          data_base_reajuste: string | null
          fundamentacao: string | null
          id: string
          indice_aplicado: string
          licitacao_id: string | null
          parecer_ia: string | null
          percentual_reajuste: number | null
          status: string | null
          tipo_servico: string | null
          titulo: string
          updated_at: string
          user_id: string
          valor_original: number
          valor_reajustado: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data_base_original?: string | null
          data_base_reajuste?: string | null
          fundamentacao?: string | null
          id?: string
          indice_aplicado?: string
          licitacao_id?: string | null
          parecer_ia?: string | null
          percentual_reajuste?: number | null
          status?: string | null
          tipo_servico?: string | null
          titulo: string
          updated_at?: string
          user_id: string
          valor_original?: number
          valor_reajustado?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data_base_original?: string | null
          data_base_reajuste?: string | null
          fundamentacao?: string | null
          id?: string
          indice_aplicado?: string
          licitacao_id?: string | null
          parecer_ia?: string | null
          percentual_reajuste?: number | null
          status?: string | null
          tipo_servico?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
          valor_original?: number
          valor_reajustado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacoes_repactuacao_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_tarefas: {
        Row: {
          concluida_em: string | null
          created_at: string
          criado_por: string
          id: string
          status: string
          tarefa_id: string
          titulo: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          criado_por: string
          id?: string
          status?: string
          tarefa_id: string
          titulo: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          criado_por?: string
          id?: string
          status?: string
          tarefa_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_tarefas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas_colaborador"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_scores: {
        Row: {
          confiabilidade: number | null
          consistencia_preco: number | null
          created_at: string
          id: string
          nota_usuario: number | null
          prazo_medio: number | null
          score_final: number | null
          supplier_id: string
          taxa_divergencia: number | null
          total_avaliacoes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confiabilidade?: number | null
          consistencia_preco?: number | null
          created_at?: string
          id?: string
          nota_usuario?: number | null
          prazo_medio?: number | null
          score_final?: number | null
          supplier_id: string
          taxa_divergencia?: number | null
          total_avaliacoes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confiabilidade?: number | null
          consistencia_preco?: number | null
          created_at?: string
          id?: string
          nota_usuario?: number | null
          prazo_medio?: number | null
          score_final?: number | null
          supplier_id?: string
          taxa_divergencia?: number | null
          total_avaliacoes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_scores_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          municipio: string | null
          nome: string
          source_id: string | null
          uf: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          municipio?: string | null
          nome: string
          source_id?: string | null
          uf?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          municipio?: string | null
          nome?: string
          source_id?: string | null
          uf?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "search_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tarefas_colaborador: {
        Row: {
          atribuido_a: string
          concluida_em: string | null
          created_at: string
          criado_por: string
          descricao: string | null
          empresa_id: string
          id: string
          licitacao_id: string | null
          prazo: string | null
          prioridade: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          atribuido_a: string
          concluida_em?: string | null
          created_at?: string
          criado_por: string
          descricao?: string | null
          empresa_id: string
          id?: string
          licitacao_id?: string | null
          prazo?: string | null
          prioridade?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          atribuido_a?: string
          concluida_em?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          licitacao_id?: string | null
          prazo?: string | null
          prioridade?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_colaborador_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_colaborador_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_suporte: {
        Row: {
          assunto: string
          categoria: string | null
          created_at: string
          descricao: string
          id: string
          prioridade: string | null
          respondido_em: string | null
          respondido_por: string | null
          resposta: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto: string
          categoria?: string | null
          created_at?: string
          descricao: string
          id?: string
          prioridade?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string
          categoria?: string | null
          created_at?: string
          descricao?: string
          id?: string
          prioridade?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transacoes_bancarias: {
        Row: {
          categoria: string | null
          conciliado: boolean | null
          conciliado_com_id: string | null
          conciliado_com_tipo: string | null
          conciliado_em: string | null
          conciliado_por: string | null
          conta_bancaria_id: string
          created_at: string
          data_transacao: string
          descricao: string
          documento: string | null
          hash_transacao: string | null
          historico: string | null
          id: string
          origem: string | null
          tipo: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          conciliado?: boolean | null
          conciliado_com_id?: string | null
          conciliado_com_tipo?: string | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id: string
          created_at?: string
          data_transacao: string
          descricao: string
          documento?: string | null
          hash_transacao?: string | null
          historico?: string | null
          id?: string
          origem?: string | null
          tipo?: string | null
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string | null
          conciliado?: boolean | null
          conciliado_com_id?: string | null
          conciliado_com_tipo?: string | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string
          created_at?: string
          data_transacao?: string
          descricao?: string
          documento?: string | null
          hash_transacao?: string | null
          historico?: string | null
          id?: string
          origem?: string | null
          tipo?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_bancarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      transparencia_empenhos: {
        Row: {
          ano: number
          categoria: string | null
          created_at: string
          fonte_recurso: string | null
          id: string
          municipio: string | null
          orgao: string
          quantidade_empenhos: number
          uf: string | null
          updated_at: string
          user_id: string
          valor_total: number
        }
        Insert: {
          ano: number
          categoria?: string | null
          created_at?: string
          fonte_recurso?: string | null
          id?: string
          municipio?: string | null
          orgao: string
          quantidade_empenhos?: number
          uf?: string | null
          updated_at?: string
          user_id: string
          valor_total?: number
        }
        Update: {
          ano?: number
          categoria?: string | null
          created_at?: string
          fonte_recurso?: string | null
          id?: string
          municipio?: string | null
          orgao?: string
          quantidade_empenhos?: number
          uf?: string | null
          updated_at?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_log: {
        Row: {
          created_at: string
          direcao: string
          erro: string | null
          id: string
          payload: Json
          resposta: Json | null
          status_code: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direcao?: string
          erro?: string | null
          id?: string
          payload?: Json
          resposta?: Json | null
          status_code?: number | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          direcao?: string
          erro?: string | null
          id?: string
          payload?: Json
          resposta?: Json | null
          status_code?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_campanha_destinatarios: {
        Row: {
          campanha_id: string
          created_at: string
          enviado_em: string | null
          erro: string | null
          id: string
          nome: string | null
          status: string
          telefone: string
          user_id: string
        }
        Insert: {
          campanha_id: string
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          nome?: string | null
          status?: string
          telefone: string
          user_id: string
        }
        Update: {
          campanha_id?: string
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          nome?: string | null
          status?: string
          telefone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campanha_destinatarios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campanhas: {
        Row: {
          agendado_para: string | null
          created_at: string
          enviados: number | null
          erros: number | null
          executado_em: string | null
          id: string
          mensagem: string
          nome: string
          setor: string | null
          status: string
          template_id: string | null
          total_destinatarios: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agendado_para?: string | null
          created_at?: string
          enviados?: number | null
          erros?: number | null
          executado_em?: string | null
          id?: string
          mensagem: string
          nome: string
          setor?: string | null
          status?: string
          template_id?: string | null
          total_destinatarios?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agendado_para?: string | null
          created_at?: string
          enviados?: number | null
          erros?: number | null
          executado_em?: string | null
          id?: string
          mensagem?: string
          nome?: string
          setor?: string | null
          status?: string
          template_id?: string | null
          total_destinatarios?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campanhas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversas: {
        Row: {
          atribuido_a: string | null
          auto_roteada: boolean | null
          classificacao_ia: string | null
          contato_avatar_url: string | null
          contato_empresa: string | null
          contato_nome: string
          contato_telefone: string
          created_at: string
          id: string
          lead_id: string | null
          provider_chat_id: string | null
          setor: string
          status: string
          tags: string[] | null
          ultima_mensagem: string | null
          ultima_mensagem_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          atribuido_a?: string | null
          auto_roteada?: boolean | null
          classificacao_ia?: string | null
          contato_avatar_url?: string | null
          contato_empresa?: string | null
          contato_nome: string
          contato_telefone: string
          created_at?: string
          id?: string
          lead_id?: string | null
          provider_chat_id?: string | null
          setor?: string
          status?: string
          tags?: string[] | null
          ultima_mensagem?: string | null
          ultima_mensagem_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          atribuido_a?: string | null
          auto_roteada?: boolean | null
          classificacao_ia?: string | null
          contato_avatar_url?: string | null
          contato_empresa?: string | null
          contato_nome?: string
          contato_telefone?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          provider_chat_id?: string | null
          setor?: string
          status?: string
          tags?: string[] | null
          ultima_mensagem?: string | null
          ultima_mensagem_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_envios: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          mensagem: string
          setor: string
          status: string
          telefone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          mensagem: string
          setor: string
          status?: string
          telefone: string
          user_id: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          mensagem?: string
          setor?: string
          status?: string
          telefone?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_leads: {
        Row: {
          created_at: string
          email: string | null
          empresa: string | null
          etapa: string
          id: string
          nome: string
          notas: string | null
          ordem: number | null
          origem: string | null
          setor: string
          telefone: string
          updated_at: string
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          etapa?: string
          id?: string
          nome: string
          notas?: string | null
          ordem?: number | null
          origem?: string | null
          setor?: string
          telefone: string
          updated_at?: string
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          etapa?: string
          id?: string
          nome?: string
          notas?: string | null
          ordem?: number | null
          origem?: string | null
          setor?: string
          telefone?: string
          updated_at?: string
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      whatsapp_mensagens: {
        Row: {
          auto_resposta: boolean | null
          confianca_classificacao: number | null
          conteudo: string
          conversa_id: string
          created_at: string
          direcao: string
          id: string
          metadata: Json | null
          provider_message_id: string | null
          setor_classificado: string | null
          status: string
          tipo: string
          user_id: string
        }
        Insert: {
          auto_resposta?: boolean | null
          confianca_classificacao?: number | null
          conteudo: string
          conversa_id: string
          created_at?: string
          direcao?: string
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          setor_classificado?: string | null
          status?: string
          tipo?: string
          user_id: string
        }
        Update: {
          auto_resposta?: boolean | null
          confianca_classificacao?: number | null
          conteudo?: string
          conversa_id?: string
          created_at?: string
          direcao?: string
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          setor_classificado?: string | null
          status?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_preferencias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          setor_documentos: boolean
          setor_financeiro: boolean
          setor_juridico: boolean
          setor_licitacoes: boolean
          telefone: string
          telefone_documentos: string | null
          telefone_financeiro: string | null
          telefone_juridico: string | null
          telefone_licitacoes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          setor_documentos?: boolean
          setor_financeiro?: boolean
          setor_juridico?: boolean
          setor_licitacoes?: boolean
          telefone: string
          telefone_documentos?: string | null
          telefone_financeiro?: string | null
          telefone_juridico?: string | null
          telefone_licitacoes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          setor_documentos?: boolean
          setor_financeiro?: boolean
          setor_juridico?: boolean
          setor_licitacoes?: boolean
          telefone?: string
          telefone_documentos?: string | null
          telefone_financeiro?: string | null
          telefone_juridico?: string | null
          telefone_licitacoes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_roteamento_config: {
        Row: {
          ativo: boolean
          created_at: string
          dias_semana: number[] | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          mensagem_boas_vindas: string | null
          mensagem_fora_horario: string | null
          provider: string | null
          provider_api_key_id: string | null
          provider_instance: string | null
          provider_url: string | null
          resposta_automatica: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          mensagem_boas_vindas?: string | null
          mensagem_fora_horario?: string | null
          provider?: string | null
          provider_api_key_id?: string | null
          provider_instance?: string | null
          provider_url?: string | null
          resposta_automatica?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[] | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          mensagem_boas_vindas?: string | null
          mensagem_fora_horario?: string | null
          provider?: string | null
          provider_api_key_id?: string | null
          provider_instance?: string | null
          provider_url?: string | null
          resposta_automatica?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_roteamento_log: {
        Row: {
          acao: string
          confianca: number | null
          conversa_id: string | null
          created_at: string
          id: string
          mensagem_id: string | null
          motivo: string | null
          setor_destino: string
          setor_origem: string | null
          user_id: string
        }
        Insert: {
          acao?: string
          confianca?: number | null
          conversa_id?: string | null
          created_at?: string
          id?: string
          mensagem_id?: string | null
          motivo?: string | null
          setor_destino: string
          setor_origem?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          confianca?: number | null
          conversa_id?: string | null
          created_at?: string
          id?: string
          mensagem_id?: string | null
          motivo?: string | null
          setor_destino?: string
          setor_origem?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_roteamento_log_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          ativo: boolean | null
          categoria: string
          conteudo: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
          uso_count: number | null
          variaveis: string[] | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string
          conteudo: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
          uso_count?: number | null
          variaveis?: string[] | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          conteudo?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
          uso_count?: number | null
          variaveis?: string[] | null
        }
        Relationships: []
      }
      workflow_ia: {
        Row: {
          aprovado: boolean | null
          created_at: string
          dados_json: Json | null
          descricao: string | null
          empresa_id: string | null
          etapa: string
          id: string
          processo_interesse_id: string | null
          resultado_ia: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aprovado?: boolean | null
          created_at?: string
          dados_json?: Json | null
          descricao?: string | null
          empresa_id?: string | null
          etapa?: string
          id?: string
          processo_interesse_id?: string | null
          resultado_ia?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aprovado?: boolean | null
          created_at?: string
          dados_json?: Json | null
          descricao?: string | null
          empresa_id?: string | null
          etapa?: string
          id?: string
          processo_interesse_id?: string | null
          resultado_ia?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_ia_processo_interesse_id_fkey"
            columns: ["processo_interesse_id"]
            isOneToOne: false
            referencedRelation: "processos_interesse"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_lead_rate_limit: { Args: { p_email: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_function_name: string
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_rate_limit_log: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_empresa_admin: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      is_empresa_creator: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      is_empresa_member: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer"
      empresa_papel: "admin" | "operador" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "viewer"],
      empresa_papel: ["admin", "operador", "viewer"],
    },
  },
} as const
