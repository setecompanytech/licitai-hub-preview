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
          nome: string
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
          nome?: string
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
          nome?: string
          status?: string
          ultimo_heartbeat?: string | null
          updated_at?: string
          url_base?: string
          user_id?: string
          versao_agente?: string | null
        }
        Relationships: []
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
          cnaes_monitorados: string[] | null
          created_at: string
          id: string
          municipios_interesse: string[] | null
          notificacoes_email: boolean | null
          notificacoes_push: boolean | null
          palavras_chave: string[] | null
          ufs_interesse: string[] | null
          updated_at: string
          user_id: string
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          cnaes_monitorados?: string[] | null
          created_at?: string
          id?: string
          municipios_interesse?: string[] | null
          notificacoes_email?: boolean | null
          notificacoes_push?: boolean | null
          palavras_chave?: string[] | null
          ufs_interesse?: string[] | null
          updated_at?: string
          user_id: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          cnaes_monitorados?: string[] | null
          created_at?: string
          id?: string
          municipios_interesse?: string[] | null
          notificacoes_email?: boolean | null
          notificacoes_push?: boolean | null
          palavras_chave?: string[] | null
          ufs_interesse?: string[] | null
          updated_at?: string
          user_id?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: []
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
      empresa_membros: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          papel: Database["public"]["Enums"]["empresa_papel"]
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          papel?: Database["public"]["Enums"]["empresa_papel"]
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
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
          certificado_nome: string | null
          certificado_path: string | null
          certificado_tipo: string | null
          certificado_validade: string | null
          cnae_principal: string | null
          cnpj: string
          created_at: string
          created_by: string
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          municipio: string | null
          nome_fantasia: string | null
          razao_social: string
          timbrado_path: string | null
          timbrado_url: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          certificado_nome?: string | null
          certificado_path?: string | null
          certificado_tipo?: string | null
          certificado_validade?: string | null
          cnae_principal?: string | null
          cnpj: string
          created_at?: string
          created_by: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social: string
          timbrado_path?: string | null
          timbrado_url?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          certificado_nome?: string | null
          certificado_path?: string | null
          certificado_tipo?: string | null
          certificado_validade?: string | null
          cnae_principal?: string | null
          cnpj?: string
          created_at?: string
          created_by?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          timbrado_path?: string | null
          timbrado_url?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
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
      licitacoes: {
        Row: {
          arquivado_em: string | null
          created_at: string
          data_abertura: string | null
          data_encerramento: string | null
          data_homologacao: string | null
          id: string
          modalidade: string
          municipio: string | null
          numero: string
          objeto: string
          observacoes: string | null
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
          id?: string
          modalidade?: string
          municipio?: string | null
          numero: string
          objeto: string
          observacoes?: string | null
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
          id?: string
          modalidade?: string
          municipio?: string | null
          numero?: string
          objeto?: string
          observacoes?: string | null
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
        Relationships: []
      }
      monitoramento_editais: {
        Row: {
          cnae_compativel: boolean | null
          created_at: string
          data_abertura: string | null
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
          preco_mensal: number
          recursos: Json | null
          slug: string
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
          preco_mensal?: number
          recursos?: Json | null
          slug: string
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
          preco_mensal?: number
          recursos?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      sessoes_lance_real: {
        Row: {
          agente_id: string | null
          created_at: string
          decremento_min: number | null
          decremento_percentual: number | null
          edital: string
          erro: string | null
          id: string
          intervalo_segundos: number | null
          lance_config_id: string
          max_lances: number | null
          modo: string
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
          agente_id?: string | null
          created_at?: string
          decremento_min?: number | null
          decremento_percentual?: number | null
          edital: string
          erro?: string | null
          id?: string
          intervalo_segundos?: number | null
          lance_config_id: string
          max_lances?: number | null
          modo?: string
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
          agente_id?: string | null
          created_at?: string
          decremento_min?: number | null
          decremento_percentual?: number | null
          edital?: string
          erro?: string | null
          id?: string
          intervalo_segundos?: number | null
          lance_config_id?: string
          max_lances?: number | null
          modo?: string
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
            foreignKeyName: "sessoes_lance_real_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agente_externo_config"
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
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      is_empresa_member: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
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
