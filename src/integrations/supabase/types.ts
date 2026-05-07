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
      agent_acoes_log: {
        Row: {
          acao: string
          agente: string
          created_at: string | null
          duracao_ms: number | null
          erro_msg: string | null
          id: string
          licitacao_id: string | null
          payload_in: Json | null
          payload_out: Json | null
          status: string | null
        }
        Insert: {
          acao: string
          agente: string
          created_at?: string | null
          duracao_ms?: number | null
          erro_msg?: string | null
          id?: string
          licitacao_id?: string | null
          payload_in?: Json | null
          payload_out?: Json | null
          status?: string | null
        }
        Update: {
          acao?: string
          agente?: string
          created_at?: string | null
          duracao_ms?: number | null
          erro_msg?: string | null
          id?: string
          licitacao_id?: string | null
          payload_in?: Json | null
          payload_out?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_acoes_log_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "agent_licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_chat_monitor: {
        Row: {
          categoria: string | null
          conteudo: string
          created_at: string | null
          id: string
          licitacao_id: string | null
          mensagem_id: string | null
          portal: string | null
          remetente: string | null
          requer_acao: boolean | null
          respondido_em: string | null
          resposta_enviada: string | null
        }
        Insert: {
          categoria?: string | null
          conteudo: string
          created_at?: string | null
          id?: string
          licitacao_id?: string | null
          mensagem_id?: string | null
          portal?: string | null
          remetente?: string | null
          requer_acao?: boolean | null
          respondido_em?: string | null
          resposta_enviada?: string | null
        }
        Update: {
          categoria?: string | null
          conteudo?: string
          created_at?: string | null
          id?: string
          licitacao_id?: string | null
          mensagem_id?: string | null
          portal?: string | null
          remetente?: string | null
          requer_acao?: boolean | null
          respondido_em?: string | null
          resposta_enviada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_chat_monitor_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "agent_licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_concorrentes: {
        Row: {
          cnpj: string
          created_at: string | null
          data_verificacao: string | null
          estrategia_lance: string | null
          id: string
          preco_medio_desvio: number | null
          razao_social: string | null
          sancionado: boolean | null
          segmentos: string[] | null
          taxa_vitoria: number | null
          updated_at: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          data_verificacao?: string | null
          estrategia_lance?: string | null
          id?: string
          preco_medio_desvio?: number | null
          razao_social?: string | null
          sancionado?: boolean | null
          segmentos?: string[] | null
          taxa_vitoria?: number | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          data_verificacao?: string | null
          estrategia_lance?: string | null
          id?: string
          preco_medio_desvio?: number | null
          razao_social?: string | null
          sancionado?: boolean | null
          segmentos?: string[] | null
          taxa_vitoria?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_configuracoes: {
        Row: {
          agente_ativo: boolean | null
          alertar_whatsapp: boolean | null
          auto_responder_chat: boolean | null
          auto_submeter_prop: boolean | null
          confianca_minima_auto: number | null
          created_at: string | null
          empresa_id: string
          estrategia_lance: string | null
          fator_lance_inicial: number | null
          fator_preco_proposta: number | null
          horario_fim: string | null
          horario_inicio: string | null
          margem_alvo_perc: number | null
          margem_minima_perc: number | null
          preco_minimo_absoluto: number | null
          preco_minimo_perc: number | null
          score_minimo_auto: number | null
          score_minimo_notif: number | null
          updated_at: string | null
          valor_maximo: number | null
          valor_maximo_por_item: number | null
          valor_minimo: number | null
          whatsapp_numero: string | null
        }
        Insert: {
          agente_ativo?: boolean | null
          alertar_whatsapp?: boolean | null
          auto_responder_chat?: boolean | null
          auto_submeter_prop?: boolean | null
          confianca_minima_auto?: number | null
          created_at?: string | null
          empresa_id: string
          estrategia_lance?: string | null
          fator_lance_inicial?: number | null
          fator_preco_proposta?: number | null
          horario_fim?: string | null
          horario_inicio?: string | null
          margem_alvo_perc?: number | null
          margem_minima_perc?: number | null
          preco_minimo_absoluto?: number | null
          preco_minimo_perc?: number | null
          score_minimo_auto?: number | null
          score_minimo_notif?: number | null
          updated_at?: string | null
          valor_maximo?: number | null
          valor_maximo_por_item?: number | null
          valor_minimo?: number | null
          whatsapp_numero?: string | null
        }
        Update: {
          agente_ativo?: boolean | null
          alertar_whatsapp?: boolean | null
          auto_responder_chat?: boolean | null
          auto_submeter_prop?: boolean | null
          confianca_minima_auto?: number | null
          created_at?: string | null
          empresa_id?: string
          estrategia_lance?: string | null
          fator_lance_inicial?: number | null
          fator_preco_proposta?: number | null
          horario_fim?: string | null
          horario_inicio?: string | null
          margem_alvo_perc?: number | null
          margem_minima_perc?: number | null
          preco_minimo_absoluto?: number | null
          preco_minimo_perc?: number | null
          score_minimo_auto?: number | null
          score_minimo_notif?: number | null
          updated_at?: string | null
          valor_maximo?: number | null
          valor_maximo_por_item?: number | null
          valor_minimo?: number | null
          whatsapp_numero?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_configuracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_configuracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_contratos: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string | null
          id: string
          indice_reajuste: string | null
          licitacao_id: string | null
          numero_contrato: string | null
          objeto: string | null
          orgao: string | null
          proximo_reajuste: string | null
          status: string | null
          ultimo_reajuste: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          id?: string
          indice_reajuste?: string | null
          licitacao_id?: string | null
          numero_contrato?: string | null
          objeto?: string | null
          orgao?: string | null
          proximo_reajuste?: string | null
          status?: string | null
          ultimo_reajuste?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          id?: string
          indice_reajuste?: string | null
          licitacao_id?: string | null
          numero_contrato?: string | null
          objeto?: string | null
          orgao?: string | null
          proximo_reajuste?: string | null
          status?: string | null
          ultimo_reajuste?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_contratos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "agent_licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_documentos: {
        Row: {
          arquivo_url: string | null
          auto_renovar: boolean | null
          created_at: string | null
          empresa_id: string | null
          id: string
          status: string | null
          tipo: string
          ultima_coleta: string | null
          updated_at: string | null
          validade: string | null
        }
        Insert: {
          arquivo_url?: string | null
          auto_renovar?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          status?: string | null
          tipo: string
          ultima_coleta?: string | null
          updated_at?: string | null
          validade?: string | null
        }
        Update: {
          arquivo_url?: string | null
          auto_renovar?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          status?: string | null
          tipo?: string
          ultima_coleta?: string | null
          updated_at?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_historico_precos: {
        Row: {
          cnpj_vencedor: string | null
          codigo_catmat: string | null
          created_at: string | null
          data_registro: string | null
          descricao: string
          edital_id: string | null
          empresa_id: string | null
          id: string
          item_id: string | null
          marca: string | null
          modalidade: string | null
          modelo: string | null
          orgao: string | null
          posicao_final: number | null
          preco_lance_min: number | null
          preco_proposta: number | null
          preco_vencedor: number | null
          quantidade: number | null
          resultado: string | null
          uf_orgao: string | null
          unidade: string | null
        }
        Insert: {
          cnpj_vencedor?: string | null
          codigo_catmat?: string | null
          created_at?: string | null
          data_registro?: string | null
          descricao: string
          edital_id?: string | null
          empresa_id?: string | null
          id?: string
          item_id?: string | null
          marca?: string | null
          modalidade?: string | null
          modelo?: string | null
          orgao?: string | null
          posicao_final?: number | null
          preco_lance_min?: number | null
          preco_proposta?: number | null
          preco_vencedor?: number | null
          quantidade?: number | null
          resultado?: string | null
          uf_orgao?: string | null
          unidade?: string | null
        }
        Update: {
          cnpj_vencedor?: string | null
          codigo_catmat?: string | null
          created_at?: string | null
          data_registro?: string | null
          descricao?: string
          edital_id?: string | null
          empresa_id?: string | null
          id?: string
          item_id?: string | null
          marca?: string | null
          modalidade?: string | null
          modelo?: string | null
          orgao?: string | null
          posicao_final?: number | null
          preco_lance_min?: number | null
          preco_proposta?: number | null
          preco_vencedor?: number | null
          quantidade?: number | null
          resultado?: string | null
          uf_orgao?: string | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_historico_precos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_historico_precos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_historico_precos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "agent_itens_edital"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_itens_edital: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          codigo_catmat: string | null
          codigo_catser: string | null
          confianca_calculo: number | null
          created_at: string | null
          criterio_julgamento: string | null
          descricao: string
          edital_id: string | null
          empresa_id: string | null
          especificacoes_tecnicas: string | null
          exclusivo_me_epp: boolean | null
          fontes_consultadas: Json | null
          fontes_ecommerce_count: number | null
          id: string
          justificativa_marca: string | null
          licitacao_id: string | null
          lote: number | null
          marca_referencia: string | null
          marca_selecionada: string | null
          margem_bruta_perc: number | null
          modelo_selecionado: string | null
          motivo_status: string | null
          numero: number
          permite_equivalente: boolean | null
          preco_lance_inicial: number | null
          preco_lance_minimo: number | null
          preco_proposta: number | null
          preco_referencia: number | null
          preco_referencia_ecommerce: number | null
          quantidade: number | null
          status: string | null
          unidade: string | null
          updated_at: string | null
          valor_estimado_total: number | null
          valor_estimado_unitario: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo_catmat?: string | null
          codigo_catser?: string | null
          confianca_calculo?: number | null
          created_at?: string | null
          criterio_julgamento?: string | null
          descricao: string
          edital_id?: string | null
          empresa_id?: string | null
          especificacoes_tecnicas?: string | null
          exclusivo_me_epp?: boolean | null
          fontes_consultadas?: Json | null
          fontes_ecommerce_count?: number | null
          id?: string
          justificativa_marca?: string | null
          licitacao_id?: string | null
          lote?: number | null
          marca_referencia?: string | null
          marca_selecionada?: string | null
          margem_bruta_perc?: number | null
          modelo_selecionado?: string | null
          motivo_status?: string | null
          numero: number
          permite_equivalente?: boolean | null
          preco_lance_inicial?: number | null
          preco_lance_minimo?: number | null
          preco_proposta?: number | null
          preco_referencia?: number | null
          preco_referencia_ecommerce?: number | null
          quantidade?: number | null
          status?: string | null
          unidade?: string | null
          updated_at?: string | null
          valor_estimado_total?: number | null
          valor_estimado_unitario?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo_catmat?: string | null
          codigo_catser?: string | null
          confianca_calculo?: number | null
          created_at?: string | null
          criterio_julgamento?: string | null
          descricao?: string
          edital_id?: string | null
          empresa_id?: string | null
          especificacoes_tecnicas?: string | null
          exclusivo_me_epp?: boolean | null
          fontes_consultadas?: Json | null
          fontes_ecommerce_count?: number | null
          id?: string
          justificativa_marca?: string | null
          licitacao_id?: string | null
          lote?: number | null
          marca_referencia?: string | null
          marca_selecionada?: string | null
          margem_bruta_perc?: number | null
          modelo_selecionado?: string | null
          motivo_status?: string | null
          numero?: number
          permite_equivalente?: boolean | null
          preco_lance_inicial?: number | null
          preco_lance_minimo?: number | null
          preco_proposta?: number | null
          preco_referencia?: number | null
          preco_referencia_ecommerce?: number | null
          quantidade?: number | null
          status?: string | null
          unidade?: string | null
          updated_at?: string | null
          valor_estimado_total?: number | null
          valor_estimado_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_itens_edital_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_itens_edital_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_itens_edital_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "agent_licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_jurisprudencia: {
        Row: {
          conteudo: string | null
          created_at: string | null
          data_pub: string | null
          embedding: string | null
          ementa: string | null
          fonte: string | null
          id: string
          numero: string | null
          tags: string[] | null
        }
        Insert: {
          conteudo?: string | null
          created_at?: string | null
          data_pub?: string | null
          embedding?: string | null
          ementa?: string | null
          fonte?: string | null
          id?: string
          numero?: string | null
          tags?: string[] | null
        }
        Update: {
          conteudo?: string | null
          created_at?: string | null
          data_pub?: string | null
          embedding?: string | null
          ementa?: string | null
          fonte?: string | null
          id?: string
          numero?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      agent_licitacoes: {
        Row: {
          agente_atual: string | null
          aprovacao_humana: boolean | null
          created_at: string | null
          data_abertura: string | null
          decisao: string | null
          empresa_id: string | null
          erro_log: string | null
          id: string
          motivo_decisao: string | null
          nossa_posicao: number | null
          pncp_cache_id: string | null
          prazo_habilitacao: string | null
          prazo_proposta: string | null
          prazo_recurso: string | null
          preco_minimo: number | null
          preco_proposta: number | null
          preco_vencedor: number | null
          proxima_acao: string | null
          proxima_execucao: string | null
          score_relevancia: number | null
          tentativas: number | null
          ultima_acao: string | null
          updated_at: string | null
        }
        Insert: {
          agente_atual?: string | null
          aprovacao_humana?: boolean | null
          created_at?: string | null
          data_abertura?: string | null
          decisao?: string | null
          empresa_id?: string | null
          erro_log?: string | null
          id?: string
          motivo_decisao?: string | null
          nossa_posicao?: number | null
          pncp_cache_id?: string | null
          prazo_habilitacao?: string | null
          prazo_proposta?: string | null
          prazo_recurso?: string | null
          preco_minimo?: number | null
          preco_proposta?: number | null
          preco_vencedor?: number | null
          proxima_acao?: string | null
          proxima_execucao?: string | null
          score_relevancia?: number | null
          tentativas?: number | null
          ultima_acao?: string | null
          updated_at?: string | null
        }
        Update: {
          agente_atual?: string | null
          aprovacao_humana?: boolean | null
          created_at?: string | null
          data_abertura?: string | null
          decisao?: string | null
          empresa_id?: string | null
          erro_log?: string | null
          id?: string
          motivo_decisao?: string | null
          nossa_posicao?: number | null
          pncp_cache_id?: string | null
          prazo_habilitacao?: string | null
          prazo_proposta?: string | null
          prazo_recurso?: string | null
          preco_minimo?: number | null
          preco_proposta?: number | null
          preco_vencedor?: number | null
          proxima_acao?: string | null
          proxima_execucao?: string | null
          score_relevancia?: number | null
          tentativas?: number | null
          ultima_acao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_licitacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_licitacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_licitacoes_pncp_cache_id_fkey"
            columns: ["pncp_cache_id"]
            isOneToOne: false
            referencedRelation: "pncp_editais_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessoes: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          empresa_id: string | null
          expirada_em: string | null
          id: string
          iniciada_em: string | null
          jsessionid: string | null
          portal: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          expirada_em?: string | null
          id?: string
          iniciada_em?: string | null
          jsessionid?: string | null
          portal: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          expirada_em?: string | null
          id?: string
          iniciada_em?: string | null
          jsessionid?: string | null
          portal?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
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
      alertas_gerados: {
        Row: {
          arquivado: boolean | null
          cnpj_orgao: string | null
          created_at: string | null
          data_abertura: string | null
          descricao: string
          fonte: string
          id: string
          lido: boolean | null
          numero_pregao: string | null
          numero_processo: string | null
          orgao: string | null
          segmento: string | null
          tipo: string
          titulo: string
          uf: string | null
          urgente: boolean | null
          url_edital: string | null
          url_publicacao: string | null
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          arquivado?: boolean | null
          cnpj_orgao?: string | null
          created_at?: string | null
          data_abertura?: string | null
          descricao: string
          fonte: string
          id?: string
          lido?: boolean | null
          numero_pregao?: string | null
          numero_processo?: string | null
          orgao?: string | null
          segmento?: string | null
          tipo: string
          titulo: string
          uf?: string | null
          urgente?: boolean | null
          url_edital?: string | null
          url_publicacao?: string | null
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          arquivado?: boolean | null
          cnpj_orgao?: string | null
          created_at?: string | null
          data_abertura?: string | null
          descricao?: string
          fonte?: string
          id?: string
          lido?: boolean | null
          numero_pregao?: string | null
          numero_processo?: string | null
          orgao?: string | null
          segmento?: string | null
          tipo?: string
          titulo?: string
          uf?: string | null
          urgente?: boolean | null
          url_edital?: string | null
          url_publicacao?: string | null
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: []
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
            foreignKeyName: "assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
          {
            foreignKeyName: "atividades_colaborador_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
      aurelia_cache: {
        Row: {
          acessos: number | null
          cache_key: string
          criado_em: string
          edital_id: string | null
          expira_em: string
          id: string
          modelo_usado: string | null
          resultado: string
          tipo_analise: string
          tokens_gastos: number | null
          ultimo_acesso: string | null
        }
        Insert: {
          acessos?: number | null
          cache_key: string
          criado_em?: string
          edital_id?: string | null
          expira_em: string
          id?: string
          modelo_usado?: string | null
          resultado: string
          tipo_analise?: string
          tokens_gastos?: number | null
          ultimo_acesso?: string | null
        }
        Update: {
          acessos?: number | null
          cache_key?: string
          criado_em?: string
          edital_id?: string | null
          expira_em?: string
          id?: string
          modelo_usado?: string | null
          resultado?: string
          tipo_analise?: string
          tokens_gastos?: number | null
          ultimo_acesso?: string | null
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
          filtrar_alteracoes_por_cnpj: boolean | null
          filtrar_resultados_por_participacao: boolean | null
          id: string
          notificacao_push: boolean
          segmentos: string[] | null
          ufs_interesse: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          boletim_manha?: boolean
          boletim_meiodia?: boolean
          boletim_tarde?: boolean
          created_at?: string
          email: string
          filtrar_alteracoes_por_cnpj?: boolean | null
          filtrar_resultados_por_participacao?: boolean | null
          id?: string
          notificacao_push?: boolean
          segmentos?: string[] | null
          ufs_interesse?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          boletim_manha?: boolean
          boletim_meiodia?: boolean
          boletim_tarde?: boolean
          created_at?: string
          email?: string
          filtrar_alteracoes_por_cnpj?: boolean | null
          filtrar_resultados_por_participacao?: boolean | null
          id?: string
          notificacao_push?: boolean
          segmentos?: string[] | null
          ufs_interesse?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "cert_upload_tokens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
          {
            foreignKeyName: "comissoes_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "comissoes_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
      contrato_aditivos: {
        Row: {
          arquivo_id: string | null
          contrato_id: string
          created_at: string
          data_aditivo: string | null
          data_assinatura: string | null
          id: string
          justificativa: string | null
          nova_data_fim: string | null
          numero_aditivo: string
          observacoes: string | null
          prazo_adicional_dias: number | null
          quantidade_acrescimo: number
          quantidade_supressao: number
          referencia_tipo: string
          tipo: string
          updated_at: string
          user_id: string
          valor_acrescimo: number
          valor_aditivo: number | null
          valor_supressao: number
        }
        Insert: {
          arquivo_id?: string | null
          contrato_id: string
          created_at?: string
          data_aditivo?: string | null
          data_assinatura?: string | null
          id?: string
          justificativa?: string | null
          nova_data_fim?: string | null
          numero_aditivo: string
          observacoes?: string | null
          prazo_adicional_dias?: number | null
          quantidade_acrescimo?: number
          quantidade_supressao?: number
          referencia_tipo?: string
          tipo?: string
          updated_at?: string
          user_id: string
          valor_acrescimo?: number
          valor_aditivo?: number | null
          valor_supressao?: number
        }
        Update: {
          arquivo_id?: string | null
          contrato_id?: string
          created_at?: string
          data_aditivo?: string | null
          data_assinatura?: string | null
          id?: string
          justificativa?: string | null
          nova_data_fim?: string | null
          numero_aditivo?: string
          observacoes?: string | null
          prazo_adicional_dias?: number | null
          quantidade_acrescimo?: number
          quantidade_supressao?: number
          referencia_tipo?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_acrescimo?: number
          valor_aditivo?: number | null
          valor_supressao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_aditivos_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "contrato_arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_arquivos: {
        Row: {
          contrato_id: string
          created_at: string
          descricao: string | null
          id: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
          updated_at: string
          user_id: string
          versao_atual: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          user_id: string
          versao_atual?: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          user_id?: string
          versao_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_arquivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_arquivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_arquivos_versoes: {
        Row: {
          arquivo_id: string
          contrato_id: string
          created_at: string
          id: string
          motivo: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          user_id: string
          versao: number
        }
        Insert: {
          arquivo_id: string
          contrato_id: string
          created_at?: string
          id?: string
          motivo?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          user_id: string
          versao: number
        }
        Update: {
          arquivo_id?: string
          contrato_id?: string
          created_at?: string
          id?: string
          motivo?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          user_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_arquivos_versoes_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "contrato_arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_arquivos_versoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_arquivos_versoes_contrato_id_fkey"
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
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
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
      contrato_ia_auditoria: {
        Row: {
          arquivo_id: string | null
          arquivo_nome: string | null
          campo: string
          contrato_id: string
          created_at: string
          id: string
          origem: string
          user_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          arquivo_id?: string | null
          arquivo_nome?: string | null
          campo: string
          contrato_id: string
          created_at?: string
          id?: string
          origem?: string
          user_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          arquivo_id?: string | null
          arquivo_nome?: string | null
          campo?: string
          contrato_id?: string
          created_at?: string
          id?: string
          origem?: string
          user_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_ia_auditoria_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "contrato_arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_ia_auditoria_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_ia_auditoria_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_itens: {
        Row: {
          ata_item_id: string | null
          codigo_item: string | null
          contrato_id: string
          created_at: string
          custo_total: number | null
          custo_unitario: number
          descricao: string
          descricao_lote: string | null
          estrutura: string | null
          id: string
          numero_lote: string | null
          observacoes: string | null
          origem_aditivo_id: string | null
          quantidade_ata_consumida: number | null
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
          ata_item_id?: string | null
          codigo_item?: string | null
          contrato_id: string
          created_at?: string
          custo_total?: number | null
          custo_unitario?: number
          descricao: string
          descricao_lote?: string | null
          estrutura?: string | null
          id?: string
          numero_lote?: string | null
          observacoes?: string | null
          origem_aditivo_id?: string | null
          quantidade_ata_consumida?: number | null
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
          ata_item_id?: string | null
          codigo_item?: string | null
          contrato_id?: string
          created_at?: string
          custo_total?: number | null
          custo_unitario?: number
          descricao?: string
          descricao_lote?: string | null
          estrutura?: string | null
          id?: string
          numero_lote?: string | null
          observacoes?: string | null
          origem_aditivo_id?: string | null
          quantidade_ata_consumida?: number | null
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
            foreignKeyName: "contrato_itens_ata_item_id_fkey"
            columns: ["ata_item_id"]
            isOneToOne: false
            referencedRelation: "contrato_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_itens_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_itens_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_itens_origem_aditivo_id_fkey"
            columns: ["origem_aditivo_id"]
            isOneToOne: false
            referencedRelation: "contrato_aditivos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_pedidos: {
        Row: {
          contrato_id: string
          contrato_item_id: string | null
          created_at: string
          custo_total: number
          custo_unitario: number
          data_entrega: string | null
          data_pedido: string | null
          data_quitacao: string | null
          descricao: string | null
          id: string
          nf_quitada: boolean | null
          nota_fiscal: string | null
          numero_pedido: string
          observacoes: string | null
          origem_aditivo_id: string | null
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
          custo_total?: number
          custo_unitario?: number
          data_entrega?: string | null
          data_pedido?: string | null
          data_quitacao?: string | null
          descricao?: string | null
          id?: string
          nf_quitada?: boolean | null
          nota_fiscal?: string | null
          numero_pedido: string
          observacoes?: string | null
          origem_aditivo_id?: string | null
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
          custo_total?: number
          custo_unitario?: number
          data_entrega?: string | null
          data_pedido?: string | null
          data_quitacao?: string | null
          descricao?: string | null
          id?: string
          nf_quitada?: boolean | null
          nota_fiscal?: string | null
          numero_pedido?: string
          observacoes?: string | null
          origem_aditivo_id?: string | null
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
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "contrato_pedidos_origem_aditivo_id_fkey"
            columns: ["origem_aditivo_id"]
            isOneToOne: false
            referencedRelation: "contrato_aditivos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          ata_srp_id: string | null
          created_at: string
          custo_total_pedidos: number
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
          numero_ata: string | null
          numero_contrato: string
          objeto: string
          observacoes: string | null
          orgao_contratante: string
          permite_carona: boolean | null
          saldo_remanescente: number | null
          status: string
          tipo_documento: string
          tipo_estrutura: string
          tipo_estrutura_confianca: number | null
          tipo_estrutura_detectado_ia: string | null
          uf: string | null
          updated_at: string
          user_id: string
          validade_ata_meses: number | null
          valor_consumido: number
          valor_global: number
          valor_global_original: number
          vendedor_user_id: string | null
          vigencia_meses: number | null
        }
        Insert: {
          ata_srp_id?: string | null
          created_at?: string
          custo_total_pedidos?: number
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
          numero_ata?: string | null
          numero_contrato: string
          objeto: string
          observacoes?: string | null
          orgao_contratante: string
          permite_carona?: boolean | null
          saldo_remanescente?: number | null
          status?: string
          tipo_documento?: string
          tipo_estrutura?: string
          tipo_estrutura_confianca?: number | null
          tipo_estrutura_detectado_ia?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
          validade_ata_meses?: number | null
          valor_consumido?: number
          valor_global?: number
          valor_global_original?: number
          vendedor_user_id?: string | null
          vigencia_meses?: number | null
        }
        Update: {
          ata_srp_id?: string | null
          created_at?: string
          custo_total_pedidos?: number
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
          numero_ata?: string | null
          numero_contrato?: string
          objeto?: string
          observacoes?: string | null
          orgao_contratante?: string
          permite_carona?: boolean | null
          saldo_remanescente?: number | null
          status?: string
          tipo_documento?: string
          tipo_estrutura?: string
          tipo_estrutura_confianca?: number | null
          tipo_estrutura_detectado_ia?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
          validade_ata_meses?: number | null
          valor_consumido?: number
          valor_global?: number
          valor_global_original?: number
          vendedor_user_id?: string | null
          vigencia_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_ata_srp_id_fkey"
            columns: ["ata_srp_id"]
            isOneToOne: false
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_ata_srp_id_fkey"
            columns: ["ata_srp_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
      diarios_oficiais_cache: {
        Row: {
          cnpj_orgao: string | null
          created_at: string | null
          data_publicacao: string
          edicao: string | null
          fonte: string
          fonte_id: string
          hash_conteudo: string | null
          id: string
          link_html: string | null
          link_pdf: string | null
          metadata: Json | null
          modalidade: string | null
          municipio: string | null
          numero_processo: string | null
          objeto: string | null
          orgao: string | null
          secao: string | null
          texto_completo: string | null
          texto_tsv: unknown
          tipo_publicacao: string | null
          uf: string | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          cnpj_orgao?: string | null
          created_at?: string | null
          data_publicacao: string
          edicao?: string | null
          fonte: string
          fonte_id: string
          hash_conteudo?: string | null
          id?: string
          link_html?: string | null
          link_pdf?: string | null
          metadata?: Json | null
          modalidade?: string | null
          municipio?: string | null
          numero_processo?: string | null
          objeto?: string | null
          orgao?: string | null
          secao?: string | null
          texto_completo?: string | null
          texto_tsv?: unknown
          tipo_publicacao?: string | null
          uf?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Update: {
          cnpj_orgao?: string | null
          created_at?: string | null
          data_publicacao?: string
          edicao?: string | null
          fonte?: string
          fonte_id?: string
          hash_conteudo?: string | null
          id?: string
          link_html?: string | null
          link_pdf?: string | null
          metadata?: Json | null
          modalidade?: string | null
          municipio?: string | null
          numero_processo?: string | null
          objeto?: string | null
          orgao?: string | null
          secao?: string | null
          texto_completo?: string | null
          texto_tsv?: unknown
          tipo_publicacao?: string | null
          uf?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      diarios_portais_config: {
        Row: {
          ativo: boolean | null
          config: Json | null
          created_at: string | null
          fonte: string
          id: string
          metodo: string
          uf: string | null
          ultima_sync: string | null
          url_base: string
        }
        Insert: {
          ativo?: boolean | null
          config?: Json | null
          created_at?: string | null
          fonte: string
          id?: string
          metodo: string
          uf?: string | null
          ultima_sync?: string | null
          url_base: string
        }
        Update: {
          ativo?: boolean | null
          config?: Json | null
          created_at?: string | null
          fonte?: string
          id?: string
          metodo?: string
          uf?: string | null
          ultima_sync?: string | null
          url_base?: string
        }
        Relationships: []
      }
      distribuicoes_realizadas: {
        Row: {
          canal: string
          edital_id: string | null
          enviado_em: string | null
          erro: string | null
          id: string
          status: string
          tentativas: number | null
          user_id: string
          wamid: string | null
        }
        Insert: {
          canal?: string
          edital_id?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          status?: string
          tentativas?: number | null
          user_id: string
          wamid?: string | null
        }
        Update: {
          canal?: string
          edital_id?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          status?: string
          tentativas?: number | null
          user_id?: string
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribuicoes_realizadas_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais_coletados"
            referencedColumns: ["id"]
          },
        ]
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
          dados_extraidos: Json | null
          descricao: string | null
          id: string
          licitacao_id: string | null
          nome: string
          segmento: string | null
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
          dados_extraidos?: Json | null
          descricao?: string | null
          id?: string
          licitacao_id?: string | null
          nome: string
          segmento?: string | null
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
          dados_extraidos?: Json | null
          descricao?: string | null
          id?: string
          licitacao_id?: string | null
          nome?: string
          segmento?: string | null
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
          {
            foreignKeyName: "dre_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      editais_coletados: {
        Row: {
          created_at: string | null
          data_abertura: string | null
          data_publicacao: string | null
          distribuido: boolean | null
          id: string
          identificador_ext: string
          modalidade: string | null
          municipio: string | null
          numero: string | null
          objeto: string
          orgao: string
          palavras_chave: string[] | null
          pdf_storage_path: string | null
          portal_id: string | null
          segmento_codigo: string | null
          segmento_nome: string | null
          uf: string | null
          url_edital: string | null
          url_pdf: string | null
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string | null
          data_abertura?: string | null
          data_publicacao?: string | null
          distribuido?: boolean | null
          id?: string
          identificador_ext: string
          modalidade?: string | null
          municipio?: string | null
          numero?: string | null
          objeto: string
          orgao: string
          palavras_chave?: string[] | null
          pdf_storage_path?: string | null
          portal_id?: string | null
          segmento_codigo?: string | null
          segmento_nome?: string | null
          uf?: string | null
          url_edital?: string | null
          url_pdf?: string | null
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string | null
          data_abertura?: string | null
          data_publicacao?: string | null
          distribuido?: boolean | null
          id?: string
          identificador_ext?: string
          modalidade?: string | null
          municipio?: string | null
          numero?: string | null
          objeto?: string
          orgao?: string
          palavras_chave?: string[] | null
          pdf_storage_path?: string | null
          portal_id?: string | null
          segmento_codigo?: string | null
          segmento_nome?: string | null
          uf?: string | null
          url_edital?: string | null
          url_pdf?: string | null
          valor_estimado?: number | null
        }
        Relationships: []
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
      edital_itens_extraidos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          codigo_catmat: string | null
          confidence_score: number | null
          created_at: string | null
          descricao: string
          empresa_id: string | null
          erros: Json | null
          especificacoes: string | null
          estrategia_extracao: string | null
          exclusivo_me_epp: boolean | null
          fabricante: string | null
          fonte_extracao: string | null
          id: string
          licitacao_id: string | null
          marca: string | null
          modelo: string | null
          numero_item: number | null
          numero_lote: number | null
          quantidade: number | null
          requer_revisao: boolean | null
          status: string | null
          unidade: string | null
          updated_at: string | null
          user_id: string
          valor_total: number | null
          valor_unitario: number | null
          warnings: Json | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo_catmat?: string | null
          confidence_score?: number | null
          created_at?: string | null
          descricao: string
          empresa_id?: string | null
          erros?: Json | null
          especificacoes?: string | null
          estrategia_extracao?: string | null
          exclusivo_me_epp?: boolean | null
          fabricante?: string | null
          fonte_extracao?: string | null
          id?: string
          licitacao_id?: string | null
          marca?: string | null
          modelo?: string | null
          numero_item?: number | null
          numero_lote?: number | null
          quantidade?: number | null
          requer_revisao?: boolean | null
          status?: string | null
          unidade?: string | null
          updated_at?: string | null
          user_id: string
          valor_total?: number | null
          valor_unitario?: number | null
          warnings?: Json | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo_catmat?: string | null
          confidence_score?: number | null
          created_at?: string | null
          descricao?: string
          empresa_id?: string | null
          erros?: Json | null
          especificacoes?: string | null
          estrategia_extracao?: string | null
          exclusivo_me_epp?: boolean | null
          fabricante?: string | null
          fonte_extracao?: string | null
          id?: string
          licitacao_id?: string | null
          marca?: string | null
          modelo?: string | null
          numero_item?: number | null
          numero_lote?: number | null
          quantidade?: number | null
          requer_revisao?: boolean | null
          status?: string | null
          unidade?: string | null
          updated_at?: string | null
          user_id?: string
          valor_total?: number | null
          valor_unitario?: number | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "edital_itens_extraidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_itens_extraidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_itens_extraidos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
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
          identificacao_completa: boolean
          login_individual: string | null
          nome: string | null
          nome_individual: string | null
          papel: Database["public"]["Enums"]["empresa_papel"]
          permissoes: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa_id: string
          equipe?: string | null
          id?: string
          identificacao_completa?: boolean
          login_individual?: string | null
          nome?: string | null
          nome_individual?: string | null
          papel?: Database["public"]["Enums"]["empresa_papel"]
          permissoes?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa_id?: string
          equipe?: string | null
          id?: string
          identificacao_completa?: boolean
          login_individual?: string | null
          nome?: string | null
          nome_individual?: string | null
          papel?: Database["public"]["Enums"]["empresa_papel"]
          permissoes?: Json | null
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
          {
            foreignKeyName: "empresa_membros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
          cnaes_secundarios: string[] | null
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
          cnaes_secundarios?: string[] | null
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
          cnaes_secundarios?: string[] | null
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
      faturamento_mensal: {
        Row: {
          ano_mes: string
          created_at: string
          empresa_id: string
          id: string
          observacoes: string | null
          updated_at: string
          user_id: string
          valor_faturamento: number
        }
        Insert: {
          ano_mes: string
          created_at?: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id: string
          valor_faturamento?: number
        }
        Update: {
          ano_mes?: string
          created_at?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id?: string
          valor_faturamento?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_mensal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_mensal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_apuracao_impostos: {
        Row: {
          aliquota: number | null
          base_calculo: number | null
          competencia: string
          created_at: string | null
          divergencia: number | null
          empresa_id: string
          id: string
          origem: Json | null
          status: string | null
          tributo: string
          updated_at: string | null
          user_id: string
          valor_apurado: number | null
          valor_devido: number | null
          valor_pago: number | null
          valor_retido: number | null
        }
        Insert: {
          aliquota?: number | null
          base_calculo?: number | null
          competencia: string
          created_at?: string | null
          divergencia?: number | null
          empresa_id: string
          id?: string
          origem?: Json | null
          status?: string | null
          tributo: string
          updated_at?: string | null
          user_id?: string
          valor_apurado?: number | null
          valor_devido?: number | null
          valor_pago?: number | null
          valor_retido?: number | null
        }
        Update: {
          aliquota?: number | null
          base_calculo?: number | null
          competencia?: string
          created_at?: string | null
          divergencia?: number | null
          empresa_id?: string
          id?: string
          origem?: Json | null
          status?: string | null
          tributo?: string
          updated_at?: string | null
          user_id?: string
          valor_apurado?: number | null
          valor_devido?: number | null
          valor_pago?: number | null
          valor_retido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_apuracao_impostos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_apuracao_impostos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_categorias: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          nome: string
          pai_id: string | null
          tipo: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          pai_id?: string | null
          tipo?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          pai_id?: string | null
          tipo?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_categorias_pai_fk"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_centros_custo: {
        Row: {
          ativo: boolean | null
          codigo: string | null
          created_at: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_comissoes: {
        Row: {
          conta_pagar_id: string | null
          contrato_ref: string | null
          created_at: string | null
          data_competencia: string
          data_pagamento: string | null
          edital_id: string | null
          empresa_id: string | null
          id: string
          lancamento_id: string | null
          nome_comissionado: string
          observacoes: string | null
          percentual: number | null
          status: string | null
          tipo_origem: string | null
          usuario_id: string | null
          valor_base: number | null
          valor_comissao: number
        }
        Insert: {
          conta_pagar_id?: string | null
          contrato_ref?: string | null
          created_at?: string | null
          data_competencia: string
          data_pagamento?: string | null
          edital_id?: string | null
          empresa_id?: string | null
          id?: string
          lancamento_id?: string | null
          nome_comissionado: string
          observacoes?: string | null
          percentual?: number | null
          status?: string | null
          tipo_origem?: string | null
          usuario_id?: string | null
          valor_base?: number | null
          valor_comissao: number
        }
        Update: {
          conta_pagar_id?: string | null
          contrato_ref?: string | null
          created_at?: string | null
          data_competencia?: string
          data_pagamento?: string | null
          edital_id?: string | null
          empresa_id?: string | null
          id?: string
          lancamento_id?: string | null
          nome_comissionado?: string
          observacoes?: string | null
          percentual?: number | null
          status?: string | null
          tipo_origem?: string | null
          usuario_id?: string | null
          valor_base?: number | null
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_comissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_comissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_comissoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_conciliacao_log: {
        Row: {
          acao: string
          confianca: number | null
          created_at: string
          detalhes: Json | null
          empresa_id: string
          id: string
          lancamento_id: string | null
          metodo: string
          movimento_id: string | null
          revertido: boolean | null
          revertido_em: string | null
          revertido_por: string | null
          user_id: string
        }
        Insert: {
          acao: string
          confianca?: number | null
          created_at?: string
          detalhes?: Json | null
          empresa_id: string
          id?: string
          lancamento_id?: string | null
          metodo: string
          movimento_id?: string | null
          revertido?: boolean | null
          revertido_em?: string | null
          revertido_por?: string | null
          user_id?: string
        }
        Update: {
          acao?: string
          confianca?: number | null
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string
          id?: string
          lancamento_id?: string | null
          metodo?: string
          movimento_id?: string | null
          revertido?: boolean | null
          revertido_em?: string | null
          revertido_por?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_conciliacao_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_conciliacao_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_conciliacao_regras: {
        Row: {
          ativo: boolean | null
          categoria_id: string | null
          confianca: number | null
          created_at: string | null
          empresa_id: string
          id: string
          origem: string | null
          padrao_descritor: string
          pessoa_id: string | null
          plano_conta_id: string | null
          updated_at: string | null
          vezes_usada: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria_id?: string | null
          confianca?: number | null
          created_at?: string | null
          empresa_id: string
          id?: string
          origem?: string | null
          padrao_descritor: string
          pessoa_id?: string | null
          plano_conta_id?: string | null
          updated_at?: string | null
          vezes_usada?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string | null
          confianca?: number | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          origem?: string | null
          padrao_descritor?: string
          pessoa_id?: string | null
          plano_conta_id?: string | null
          updated_at?: string | null
          vezes_usada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_conciliacao_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_conciliacao_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_conciliacao_regras_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_config_fiscal: {
        Row: {
          ambiente: number | null
          bairro: string | null
          cep: string | null
          cert_serial: string | null
          cert_tipo: string | null
          cert_validade: string | null
          cfop_padrao_servico: string | null
          cnae_principal: string | null
          cnpj: string
          cod_municipio: number | null
          cod_pais: number | null
          cofins_cst_padrao: string | null
          complemento: string | null
          contador_cpf: string | null
          contador_crc: string | null
          contador_nome: string | null
          created_at: string | null
          crt: number
          empresa_id: string | null
          id: string
          ie: string | null
          im: string | null
          logradouro: string | null
          municipio: string | null
          numero: string | null
          pis_cst_padrao: string | null
          proximo_nf: number | null
          regime_desc: string | null
          serie_nfe: number | null
          tipo_emissao: number | null
          tipo_impressao: number | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          ambiente?: number | null
          bairro?: string | null
          cep?: string | null
          cert_serial?: string | null
          cert_tipo?: string | null
          cert_validade?: string | null
          cfop_padrao_servico?: string | null
          cnae_principal?: string | null
          cnpj?: string
          cod_municipio?: number | null
          cod_pais?: number | null
          cofins_cst_padrao?: string | null
          complemento?: string | null
          contador_cpf?: string | null
          contador_crc?: string | null
          contador_nome?: string | null
          created_at?: string | null
          crt?: number
          empresa_id?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          logradouro?: string | null
          municipio?: string | null
          numero?: string | null
          pis_cst_padrao?: string | null
          proximo_nf?: number | null
          regime_desc?: string | null
          serie_nfe?: number | null
          tipo_emissao?: number | null
          tipo_impressao?: number | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          ambiente?: number | null
          bairro?: string | null
          cep?: string | null
          cert_serial?: string | null
          cert_tipo?: string | null
          cert_validade?: string | null
          cfop_padrao_servico?: string | null
          cnae_principal?: string | null
          cnpj?: string
          cod_municipio?: number | null
          cod_pais?: number | null
          cofins_cst_padrao?: string | null
          complemento?: string | null
          contador_cpf?: string | null
          contador_crc?: string | null
          contador_nome?: string | null
          created_at?: string | null
          crt?: number
          empresa_id?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          logradouro?: string | null
          municipio?: string | null
          numero?: string | null
          pis_cst_padrao?: string | null
          proximo_nf?: number | null
          regime_desc?: string | null
          serie_nfe?: number | null
          tipo_emissao?: number | null
          tipo_impressao?: number | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_config_fiscal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_config_fiscal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_config_nfe: {
        Row: {
          ambiente: string
          api_token: string | null
          api_token_secundario: string | null
          ativo: boolean
          certificado_pfx_url: string | null
          created_at: string
          empresa_id: string
          id: string
          observacoes: string | null
          provedor: string
          proximo_numero: number | null
          senha_certificado: string | null
          serie_padrao: number | null
          updated_at: string
        }
        Insert: {
          ambiente?: string
          api_token?: string | null
          api_token_secundario?: string | null
          ativo?: boolean
          certificado_pfx_url?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          provedor?: string
          proximo_numero?: number | null
          senha_certificado?: string | null
          serie_padrao?: number | null
          updated_at?: string
        }
        Update: {
          ambiente?: string
          api_token?: string | null
          api_token_secundario?: string | null
          ativo?: boolean
          certificado_pfx_url?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          provedor?: string
          proximo_numero?: number | null
          senha_certificado?: string | null
          serie_padrao?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_config_nfe_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_config_nfe_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_contas: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco_codigo: string | null
          banco_ispb: string | null
          banco_logo_url: string | null
          banco_nome: string | null
          considerar_fluxo: boolean | null
          considerar_orcamento: boolean | null
          considerar_resumo: boolean | null
          conta_vinculada: string | null
          created_at: string | null
          data_saldo_ini: string | null
          empresa_id: string | null
          id: string
          inativo_motivo: string | null
          limite_credito: number | null
          nome: string
          numero_conta: string | null
          observacao: string | null
          saldo_inicial: number | null
          tipo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          banco_codigo?: string | null
          banco_ispb?: string | null
          banco_logo_url?: string | null
          banco_nome?: string | null
          considerar_fluxo?: boolean | null
          considerar_orcamento?: boolean | null
          considerar_resumo?: boolean | null
          conta_vinculada?: string | null
          created_at?: string | null
          data_saldo_ini?: string | null
          empresa_id?: string | null
          id?: string
          inativo_motivo?: string | null
          limite_credito?: number | null
          nome: string
          numero_conta?: string | null
          observacao?: string | null
          saldo_inicial?: number | null
          tipo?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          banco_codigo?: string | null
          banco_ispb?: string | null
          banco_logo_url?: string | null
          banco_nome?: string | null
          considerar_fluxo?: boolean | null
          considerar_orcamento?: boolean | null
          considerar_resumo?: boolean | null
          conta_vinculada?: string | null
          created_at?: string | null
          data_saldo_ini?: string | null
          empresa_id?: string | null
          id?: string
          inativo_motivo?: string | null
          limite_credito?: number | null
          nome?: string
          numero_conta?: string | null
          observacao?: string | null
          saldo_inicial?: number | null
          tipo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_conta_vinculada_fkey"
            columns: ["conta_vinculada"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_conta_vinculada_fkey"
            columns: ["conta_vinculada"]
            isOneToOne: false
            referencedRelation: "vw_fin_saldo_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_conta_vinculada_fkey"
            columns: ["conta_vinculada"]
            isOneToOne: false
            referencedRelation: "vw_saldo_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_contas_pagar: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          arquivo_url: string | null
          categoria_id: string | null
          centro_custo: string | null
          chave_nfe: string | null
          codigo_barras: string | null
          cofins_retido: number | null
          conta_corrente_id: string | null
          contrato_ref: string | null
          created_at: string | null
          csll_retido: number | null
          data_emissao: string | null
          data_pagamento: string | null
          data_registro: string | null
          data_vencimento: string
          departamento: string | null
          desconto: number | null
          edital_id: string | null
          empresa_id: string | null
          favorecido_id: string | null
          favorecido_nome: string | null
          grupo_parcela_id: string | null
          id: string
          inss_retido: number | null
          ir_retido: number | null
          iss_retido: number | null
          juros: number | null
          multa: number | null
          nota_fiscal: string | null
          numero_documento: string | null
          observacoes: string | null
          origem: string | null
          parcela_grupo_id: string | null
          parcela_numero: number | null
          parcela_total: number | null
          pedido_ref: string | null
          pis_retido: number | null
          plano_conta_id: string | null
          previsao_pagamento: string | null
          projeto_id: string | null
          repeticao_ate: string | null
          repeticao_tipo: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          valor_documento: number
          valor_pago: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_url?: string | null
          categoria_id?: string | null
          centro_custo?: string | null
          chave_nfe?: string | null
          codigo_barras?: string | null
          cofins_retido?: number | null
          conta_corrente_id?: string | null
          contrato_ref?: string | null
          created_at?: string | null
          csll_retido?: number | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_registro?: string | null
          data_vencimento?: string
          departamento?: string | null
          desconto?: number | null
          edital_id?: string | null
          empresa_id?: string | null
          favorecido_id?: string | null
          favorecido_nome?: string | null
          grupo_parcela_id?: string | null
          id?: string
          inss_retido?: number | null
          ir_retido?: number | null
          iss_retido?: number | null
          juros?: number | null
          multa?: number | null
          nota_fiscal?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_grupo_id?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          pedido_ref?: string | null
          pis_retido?: number | null
          plano_conta_id?: string | null
          previsao_pagamento?: string | null
          projeto_id?: string | null
          repeticao_ate?: string | null
          repeticao_tipo?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          valor_documento?: number
          valor_pago?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_url?: string | null
          categoria_id?: string | null
          centro_custo?: string | null
          chave_nfe?: string | null
          codigo_barras?: string | null
          cofins_retido?: number | null
          conta_corrente_id?: string | null
          contrato_ref?: string | null
          created_at?: string | null
          csll_retido?: number | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_registro?: string | null
          data_vencimento?: string
          departamento?: string | null
          desconto?: number | null
          edital_id?: string | null
          empresa_id?: string | null
          favorecido_id?: string | null
          favorecido_nome?: string | null
          grupo_parcela_id?: string | null
          id?: string
          inss_retido?: number | null
          ir_retido?: number | null
          iss_retido?: number | null
          juros?: number | null
          multa?: number | null
          nota_fiscal?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_grupo_id?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          pedido_ref?: string | null
          pis_retido?: number | null
          plano_conta_id?: string | null
          previsao_pagamento?: string | null
          projeto_id?: string | null
          repeticao_ate?: string | null
          repeticao_tipo?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          valor_documento?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_conta_corrente_id_fkey"
            columns: ["conta_corrente_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_conta_corrente_id_fkey"
            columns: ["conta_corrente_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_saldo_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_conta_corrente_id_fkey"
            columns: ["conta_corrente_id"]
            isOneToOne: false
            referencedRelation: "vw_saldo_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_favorecido_id_fkey"
            columns: ["favorecido_id"]
            isOneToOne: false
            referencedRelation: "fin_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_contas_receber: {
        Row: {
          arquivo_url: string | null
          categoria_id: string | null
          centro_custo: string | null
          chave_nfe: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cofins_retido: number | null
          conta_corrente_id: string | null
          contrato_ref: string | null
          created_at: string | null
          csll_retido: number | null
          data_emissao: string | null
          data_recebimento: string | null
          data_registro: string | null
          data_vencimento: string
          departamento: string | null
          desconto: number | null
          edital_id: string | null
          empresa_id: string | null
          id: string
          inss_retido: number | null
          ir_retido: number | null
          iss_retido: number | null
          juros: number | null
          multa: number | null
          nota_fiscal: string | null
          numero_documento: string | null
          observacoes: string | null
          origem: string | null
          parcela_grupo_id: string | null
          parcela_numero: number | null
          parcela_total: number | null
          pis_retido: number | null
          plano_conta_id: string | null
          previsao_recebimento: string | null
          projeto_id: string | null
          repeticao_ate: string | null
          repeticao_tipo: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          valor_documento: number
          valor_recebido: number | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          arquivo_url?: string | null
          categoria_id?: string | null
          centro_custo?: string | null
          chave_nfe?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cofins_retido?: number | null
          conta_corrente_id?: string | null
          contrato_ref?: string | null
          created_at?: string | null
          csll_retido?: number | null
          data_emissao?: string | null
          data_recebimento?: string | null
          data_registro?: string | null
          data_vencimento?: string
          departamento?: string | null
          desconto?: number | null
          edital_id?: string | null
          empresa_id?: string | null
          id?: string
          inss_retido?: number | null
          ir_retido?: number | null
          iss_retido?: number | null
          juros?: number | null
          multa?: number | null
          nota_fiscal?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_grupo_id?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          pis_retido?: number | null
          plano_conta_id?: string | null
          previsao_recebimento?: string | null
          projeto_id?: string | null
          repeticao_ate?: string | null
          repeticao_tipo?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          valor_documento?: number
          valor_recebido?: number | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          arquivo_url?: string | null
          categoria_id?: string | null
          centro_custo?: string | null
          chave_nfe?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cofins_retido?: number | null
          conta_corrente_id?: string | null
          contrato_ref?: string | null
          created_at?: string | null
          csll_retido?: number | null
          data_emissao?: string | null
          data_recebimento?: string | null
          data_registro?: string | null
          data_vencimento?: string
          departamento?: string | null
          desconto?: number | null
          edital_id?: string | null
          empresa_id?: string | null
          id?: string
          inss_retido?: number | null
          ir_retido?: number | null
          iss_retido?: number | null
          juros?: number | null
          multa?: number | null
          nota_fiscal?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_grupo_id?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          pis_retido?: number | null
          plano_conta_id?: string | null
          previsao_recebimento?: string | null
          projeto_id?: string | null
          repeticao_ate?: string | null
          repeticao_tipo?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          valor_documento?: number
          valor_recebido?: number | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_receber_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "fin_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_conta_corrente_id_fkey"
            columns: ["conta_corrente_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_conta_corrente_id_fkey"
            columns: ["conta_corrente_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_saldo_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_conta_corrente_id_fkey"
            columns: ["conta_corrente_id"]
            isOneToOne: false
            referencedRelation: "vw_saldo_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_receber_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_documentos: {
        Row: {
          arquivo_url: string
          created_at: string | null
          criado_por: string | null
          empresa_id: string | null
          id: string
          nome_arquivo: string
          resultado: Json | null
          status_proc: string | null
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string | null
          criado_por?: string | null
          empresa_id?: string | null
          id?: string
          nome_arquivo: string
          resultado?: Json | null
          status_proc?: string | null
          tamanho_bytes?: number | null
          tipo?: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string | null
          criado_por?: string | null
          empresa_id?: string | null
          id?: string
          nome_arquivo?: string
          resultado?: Json | null
          status_proc?: string | null
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_folha_competencias: {
        Row: {
          competencia: string
          created_at: string
          data_pagamento: string | null
          id: string
          observacoes: string | null
          status: string
          total_descontos: number | null
          total_encargos: number | null
          total_liquido: number | null
          total_proventos: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          competencia: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          total_descontos?: number | null
          total_encargos?: number | null
          total_liquido?: number | null
          total_proventos?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          competencia?: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          total_descontos?: number | null
          total_encargos?: number | null
          total_liquido?: number | null
          total_proventos?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_folha_encargos: {
        Row: {
          base_calculo: number | null
          competencia_id: string
          created_at: string
          fgts_patronal: number | null
          id: string
          inss_patronal: number | null
          observacoes: string | null
          pis_folha: number | null
          rat: number | null
          terceiros: number | null
          total_encargos: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_calculo?: number | null
          competencia_id: string
          created_at?: string
          fgts_patronal?: number | null
          id?: string
          inss_patronal?: number | null
          observacoes?: string | null
          pis_folha?: number | null
          rat?: number | null
          terceiros?: number | null
          total_encargos?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_calculo?: number | null
          competencia_id?: string
          created_at?: string
          fgts_patronal?: number | null
          id?: string
          inss_patronal?: number | null
          observacoes?: string | null
          pis_folha?: number | null
          rat?: number | null
          terceiros?: number | null
          total_encargos?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_folha_encargos_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "fin_folha_competencias"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_folha_funcionarios: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco: string | null
          carga_horaria_mensal: number | null
          cargo: string | null
          conta: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          departamento: string | null
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          num_dependentes: number | null
          observacoes: string | null
          pix: string | null
          plano_saude: number | null
          rg: string | null
          salario_base: number
          telefone: string | null
          tipo_vinculo: string
          updated_at: string
          user_id: string
          vale_refeicao: number | null
          vale_transporte: boolean | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          carga_horaria_mensal?: number | null
          cargo?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          num_dependentes?: number | null
          observacoes?: string | null
          pix?: string | null
          plano_saude?: number | null
          rg?: string | null
          salario_base?: number
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string
          user_id: string
          vale_refeicao?: number | null
          vale_transporte?: boolean | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          carga_horaria_mensal?: number | null
          cargo?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          num_dependentes?: number | null
          observacoes?: string | null
          pix?: string | null
          plano_saude?: number | null
          rg?: string | null
          salario_base?: number
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string
          user_id?: string
          vale_refeicao?: number | null
          vale_transporte?: boolean | null
        }
        Relationships: []
      }
      fin_folha_holerite_itens: {
        Row: {
          codigo: string | null
          created_at: string
          descricao: string
          holerite_id: string
          id: string
          ordem: number | null
          referencia: string | null
          rubrica_id: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descricao: string
          holerite_id: string
          id?: string
          ordem?: number | null
          referencia?: string | null
          rubrica_id?: string | null
          tipo: string
          user_id: string
          valor?: number
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descricao?: string
          holerite_id?: string
          id?: string
          ordem?: number | null
          referencia?: string | null
          rubrica_id?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_folha_holerite_itens_holerite_id_fkey"
            columns: ["holerite_id"]
            isOneToOne: false
            referencedRelation: "fin_folha_holerites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_folha_holerite_itens_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "fin_folha_rubricas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_folha_holerites: {
        Row: {
          base_fgts: number | null
          base_inss: number | null
          base_irrf: number | null
          competencia_id: string
          created_at: string
          data_pagamento: string | null
          funcionario_id: string
          id: string
          observacoes: string | null
          status: string
          total_descontos: number | null
          total_liquido: number | null
          total_proventos: number | null
          updated_at: string
          user_id: string
          valor_fgts: number | null
          valor_inss: number | null
          valor_irrf: number | null
        }
        Insert: {
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          competencia_id: string
          created_at?: string
          data_pagamento?: string | null
          funcionario_id: string
          id?: string
          observacoes?: string | null
          status?: string
          total_descontos?: number | null
          total_liquido?: number | null
          total_proventos?: number | null
          updated_at?: string
          user_id: string
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
        }
        Update: {
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          competencia_id?: string
          created_at?: string
          data_pagamento?: string | null
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          total_descontos?: number | null
          total_liquido?: number | null
          total_proventos?: number | null
          updated_at?: string
          user_id?: string
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_folha_holerites_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "fin_folha_competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_folha_holerites_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "fin_folha_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_folha_rubricas: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string
          descricao: string
          formula: string | null
          id: string
          incide_fgts: boolean | null
          incide_inss: boolean | null
          incide_irrf: boolean | null
          natureza: string | null
          ordem: number | null
          percentual: number | null
          tipo: string
          updated_at: string
          user_id: string
          valor_fixo: number | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string
          descricao: string
          formula?: string | null
          id?: string
          incide_fgts?: boolean | null
          incide_inss?: boolean | null
          incide_irrf?: boolean | null
          natureza?: string | null
          ordem?: number | null
          percentual?: number | null
          tipo: string
          updated_at?: string
          user_id: string
          valor_fixo?: number | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string
          descricao?: string
          formula?: string | null
          id?: string
          incide_fgts?: boolean | null
          incide_inss?: boolean | null
          incide_irrf?: boolean | null
          natureza?: string | null
          ordem?: number | null
          percentual?: number | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor_fixo?: number | null
        }
        Relationships: []
      }
      fin_lancamento_rateios: {
        Row: {
          centro_custo_id: string
          created_at: string
          id: string
          lancamento_id: string
          percentual: number
          valor: number
        }
        Insert: {
          centro_custo_id: string
          created_at?: string
          id?: string
          lancamento_id: string
          percentual: number
          valor?: number
        }
        Update: {
          centro_custo_id?: string
          created_at?: string
          id?: string
          lancamento_id?: string
          percentual?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_lancamento_rateios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "fin_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamento_rateios_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_lancamentos: {
        Row: {
          arquivo_url: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          conta_id: string | null
          contrato_ref: string | null
          created_at: string | null
          created_by: string | null
          data_competencia: string
          data_pagamento: string | null
          descricao: string
          documento_ref: string | null
          documento_tipo: string | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          parcela_numero: number | null
          parcela_pai_id: string | null
          parcela_total: number | null
          projeto_id: string | null
          status: string | null
          tipo: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          arquivo_url?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_id?: string | null
          contrato_ref?: string | null
          created_at?: string | null
          created_by?: string | null
          data_competencia: string
          data_pagamento?: string | null
          descricao: string
          documento_ref?: string | null
          documento_tipo?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          parcela_numero?: number | null
          parcela_pai_id?: string | null
          parcela_total?: number | null
          projeto_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          arquivo_url?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_id?: string | null
          contrato_ref?: string | null
          created_at?: string | null
          created_by?: string | null
          data_competencia?: string
          data_pagamento?: string | null
          descricao?: string
          documento_ref?: string | null
          documento_tipo?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          parcela_numero?: number | null
          parcela_pai_id?: string | null
          parcela_total?: number | null
          projeto_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_parcela_pai_id_fkey"
            columns: ["parcela_pai_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "fin_projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fin_lanc_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "fin_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fin_lanc_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "fin_centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_movimentacoes: {
        Row: {
          categoria_id: string | null
          conciliado_em: string | null
          conciliado_por: string | null
          conta_id: string
          conta_pagar_id: string | null
          conta_receber_id: string | null
          created_at: string | null
          data_lancamento: string
          descricao: string
          empresa_id: string | null
          fitid: string | null
          id: string
          nosso_numero: string | null
          nota_fiscal: string | null
          numero_documento: string | null
          observacoes: string | null
          origem: string | null
          parcela_ref: string | null
          pedido_ref: string | null
          pessoa_cnpj_cpf: string | null
          pessoa_id: string | null
          pessoa_nome: string | null
          projeto_nome: string | null
          saldo_apos: number | null
          saldo_previsto_apos: number | null
          situacao: string | null
          tipo_documento: string | null
          tipo_lancamento: string
          tipo_transacao: string | null
          user_id: string
          valor: number
          vendedor_nome: string | null
        }
        Insert: {
          categoria_id?: string | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id: string
          conta_pagar_id?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          descricao?: string
          empresa_id?: string | null
          fitid?: string | null
          id?: string
          nosso_numero?: string | null
          nota_fiscal?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_ref?: string | null
          pedido_ref?: string | null
          pessoa_cnpj_cpf?: string | null
          pessoa_id?: string | null
          pessoa_nome?: string | null
          projeto_nome?: string | null
          saldo_apos?: number | null
          saldo_previsto_apos?: number | null
          situacao?: string | null
          tipo_documento?: string | null
          tipo_lancamento?: string
          tipo_transacao?: string | null
          user_id: string
          valor?: number
          vendedor_nome?: string | null
        }
        Update: {
          categoria_id?: string | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id?: string
          conta_pagar_id?: string | null
          conta_receber_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          descricao?: string
          empresa_id?: string | null
          fitid?: string | null
          id?: string
          nosso_numero?: string | null
          nota_fiscal?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_ref?: string | null
          pedido_ref?: string | null
          pessoa_cnpj_cpf?: string | null
          pessoa_id?: string | null
          pessoa_nome?: string | null
          projeto_nome?: string | null
          saldo_apos?: number | null
          saldo_previsto_apos?: number | null
          situacao?: string | null
          tipo_documento?: string | null
          tipo_lancamento?: string
          tipo_transacao?: string | null
          user_id?: string
          valor?: number
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_movimentacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_movimentacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_movimentacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_saldo_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_movimentacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "vw_saldo_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_movimentacoes_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "fin_contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_movimentacoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "fin_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_nfe_itens: {
        Row: {
          c_class_trib: string | null
          c_ean: string | null
          c_prod: string | null
          c_serv_iss: string | null
          cest: string | null
          cfop: string
          csosn: string | null
          cst_cofins: string
          cst_ibs_cbs: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string
          id: string
          ind_iss_ret: number | null
          ind_tot: number | null
          inf_ad_prod: string | null
          n_item: number
          ncm: string | null
          nfe_id: string | null
          orig: number | null
          p_cbs: number | null
          p_cofins: number | null
          p_ibs_mun: number | null
          p_ibs_uf: number | null
          p_icms: number | null
          p_icms_st: number | null
          p_ipi: number | null
          p_iss: number | null
          p_pis: number | null
          p_red_bc: number | null
          q_com: number | null
          u_com: string | null
          v_bc_cofins: number | null
          v_bc_ibs: number | null
          v_bc_icms: number | null
          v_bc_ipi: number | null
          v_bc_iss: number | null
          v_bc_pis: number | null
          v_bc_st: number | null
          v_cbs: number | null
          v_cofins: number | null
          v_deducao: number | null
          v_desc: number | null
          v_frete: number | null
          v_ibs: number | null
          v_icms: number | null
          v_icms_st: number | null
          v_ipi: number | null
          v_iss: number | null
          v_iss_retido: number | null
          v_pis: number | null
          v_prod: number | null
          v_un_com: number | null
          x_prod: string
        }
        Insert: {
          c_class_trib?: string | null
          c_ean?: string | null
          c_prod?: string | null
          c_serv_iss?: string | null
          cest?: string | null
          cfop?: string
          csosn?: string | null
          cst_cofins?: string
          cst_ibs_cbs?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string
          id?: string
          ind_iss_ret?: number | null
          ind_tot?: number | null
          inf_ad_prod?: string | null
          n_item: number
          ncm?: string | null
          nfe_id?: string | null
          orig?: number | null
          p_cbs?: number | null
          p_cofins?: number | null
          p_ibs_mun?: number | null
          p_ibs_uf?: number | null
          p_icms?: number | null
          p_icms_st?: number | null
          p_ipi?: number | null
          p_iss?: number | null
          p_pis?: number | null
          p_red_bc?: number | null
          q_com?: number | null
          u_com?: string | null
          v_bc_cofins?: number | null
          v_bc_ibs?: number | null
          v_bc_icms?: number | null
          v_bc_ipi?: number | null
          v_bc_iss?: number | null
          v_bc_pis?: number | null
          v_bc_st?: number | null
          v_cbs?: number | null
          v_cofins?: number | null
          v_deducao?: number | null
          v_desc?: number | null
          v_frete?: number | null
          v_ibs?: number | null
          v_icms?: number | null
          v_icms_st?: number | null
          v_ipi?: number | null
          v_iss?: number | null
          v_iss_retido?: number | null
          v_pis?: number | null
          v_prod?: number | null
          v_un_com?: number | null
          x_prod: string
        }
        Update: {
          c_class_trib?: string | null
          c_ean?: string | null
          c_prod?: string | null
          c_serv_iss?: string | null
          cest?: string | null
          cfop?: string
          csosn?: string | null
          cst_cofins?: string
          cst_ibs_cbs?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string
          id?: string
          ind_iss_ret?: number | null
          ind_tot?: number | null
          inf_ad_prod?: string | null
          n_item?: number
          ncm?: string | null
          nfe_id?: string | null
          orig?: number | null
          p_cbs?: number | null
          p_cofins?: number | null
          p_ibs_mun?: number | null
          p_ibs_uf?: number | null
          p_icms?: number | null
          p_icms_st?: number | null
          p_ipi?: number | null
          p_iss?: number | null
          p_pis?: number | null
          p_red_bc?: number | null
          q_com?: number | null
          u_com?: string | null
          v_bc_cofins?: number | null
          v_bc_ibs?: number | null
          v_bc_icms?: number | null
          v_bc_ipi?: number | null
          v_bc_iss?: number | null
          v_bc_pis?: number | null
          v_bc_st?: number | null
          v_cbs?: number | null
          v_cofins?: number | null
          v_deducao?: number | null
          v_desc?: number | null
          v_frete?: number | null
          v_ibs?: number | null
          v_icms?: number | null
          v_icms_st?: number | null
          v_ipi?: number | null
          v_iss?: number | null
          v_iss_retido?: number | null
          v_pis?: number | null
          v_prod?: number | null
          v_un_com?: number | null
          x_prod?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_nfe_itens_nfe_id_fkey"
            columns: ["nfe_id"]
            isOneToOne: false
            referencedRelation: "fin_notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_notas_fiscais: {
        Row: {
          carta_correcao: string | null
          cfop_principal: string | null
          chave_nfe: string | null
          cnpj_destinatario: string | null
          cnpj_emitente: string | null
          codigo_status: number | null
          cofins_retido: number | null
          cpf_dest: string | null
          created_at: string | null
          created_by: string | null
          crt_emitente: number | null
          csll_retido: number | null
          danfe_url: string | null
          data_autorizacao: string | null
          data_cancelamento: string | null
          data_emissao: string | null
          data_entrada: string | null
          data_saida_entrada: string | null
          email_dest: string | null
          empresa_id: string | null
          finalidade: number | null
          id: string
          ie_dest: string | null
          ie_emitente: string | null
          importada: boolean | null
          ind_ie_dest: number | null
          inf_adic_fisco: string | null
          inf_compl: string | null
          inss_retido: number | null
          ir_retido: number | null
          iss_retido: number | null
          manifesto: string | null
          manifesto_em: string | null
          modelo: number | null
          motivo_cancel: string | null
          motivo_status: string | null
          nat_op: string | null
          nome_destinatario: string | null
          nome_emitente: string | null
          numero_nf: string | null
          observacoes: string | null
          pdf_gerado: boolean | null
          pdf_url: string | null
          pis_retido: number | null
          protocolo: string | null
          protocolo_cancel: string | null
          protocolo_cce: string | null
          serie: string | null
          status_sefaz: string | null
          tipo_nf: string | null
          uf_dest: string | null
          uf_emitente: string | null
          updated_at: string | null
          v_bc: number | null
          v_cbs: number | null
          v_desc: number | null
          v_frete: number | null
          v_ibs: number | null
          v_is: number | null
          v_seg: number | null
          v_trib_aprox: number | null
          valor_cofins: number | null
          valor_icms: number | null
          valor_ipi: number | null
          valor_iss: number | null
          valor_pis: number | null
          valor_produtos: number | null
          valor_servicos: number | null
          valor_total: number | null
          vinculada_lancamento_id: string | null
          vinculo_contrato_ref: string | null
          xml_autorizacao: string | null
          xml_baixado: boolean | null
          xml_cancelamento: string | null
          xml_url: string | null
        }
        Insert: {
          carta_correcao?: string | null
          cfop_principal?: string | null
          chave_nfe?: string | null
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          codigo_status?: number | null
          cofins_retido?: number | null
          cpf_dest?: string | null
          created_at?: string | null
          created_by?: string | null
          crt_emitente?: number | null
          csll_retido?: number | null
          danfe_url?: string | null
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          data_entrada?: string | null
          data_saida_entrada?: string | null
          email_dest?: string | null
          empresa_id?: string | null
          finalidade?: number | null
          id?: string
          ie_dest?: string | null
          ie_emitente?: string | null
          importada?: boolean | null
          ind_ie_dest?: number | null
          inf_adic_fisco?: string | null
          inf_compl?: string | null
          inss_retido?: number | null
          ir_retido?: number | null
          iss_retido?: number | null
          manifesto?: string | null
          manifesto_em?: string | null
          modelo?: number | null
          motivo_cancel?: string | null
          motivo_status?: string | null
          nat_op?: string | null
          nome_destinatario?: string | null
          nome_emitente?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          pdf_gerado?: boolean | null
          pdf_url?: string | null
          pis_retido?: number | null
          protocolo?: string | null
          protocolo_cancel?: string | null
          protocolo_cce?: string | null
          serie?: string | null
          status_sefaz?: string | null
          tipo_nf?: string | null
          uf_dest?: string | null
          uf_emitente?: string | null
          updated_at?: string | null
          v_bc?: number | null
          v_cbs?: number | null
          v_desc?: number | null
          v_frete?: number | null
          v_ibs?: number | null
          v_is?: number | null
          v_seg?: number | null
          v_trib_aprox?: number | null
          valor_cofins?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number | null
          vinculada_lancamento_id?: string | null
          vinculo_contrato_ref?: string | null
          xml_autorizacao?: string | null
          xml_baixado?: boolean | null
          xml_cancelamento?: string | null
          xml_url?: string | null
        }
        Update: {
          carta_correcao?: string | null
          cfop_principal?: string | null
          chave_nfe?: string | null
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          codigo_status?: number | null
          cofins_retido?: number | null
          cpf_dest?: string | null
          created_at?: string | null
          created_by?: string | null
          crt_emitente?: number | null
          csll_retido?: number | null
          danfe_url?: string | null
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          data_entrada?: string | null
          data_saida_entrada?: string | null
          email_dest?: string | null
          empresa_id?: string | null
          finalidade?: number | null
          id?: string
          ie_dest?: string | null
          ie_emitente?: string | null
          importada?: boolean | null
          ind_ie_dest?: number | null
          inf_adic_fisco?: string | null
          inf_compl?: string | null
          inss_retido?: number | null
          ir_retido?: number | null
          iss_retido?: number | null
          manifesto?: string | null
          manifesto_em?: string | null
          modelo?: number | null
          motivo_cancel?: string | null
          motivo_status?: string | null
          nat_op?: string | null
          nome_destinatario?: string | null
          nome_emitente?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          pdf_gerado?: boolean | null
          pdf_url?: string | null
          pis_retido?: number | null
          protocolo?: string | null
          protocolo_cancel?: string | null
          protocolo_cce?: string | null
          serie?: string | null
          status_sefaz?: string | null
          tipo_nf?: string | null
          uf_dest?: string | null
          uf_emitente?: string | null
          updated_at?: string | null
          v_bc?: number | null
          v_cbs?: number | null
          v_desc?: number | null
          v_frete?: number | null
          v_ibs?: number | null
          v_is?: number | null
          v_seg?: number | null
          v_trib_aprox?: number | null
          valor_cofins?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number | null
          vinculada_lancamento_id?: string | null
          vinculo_contrato_ref?: string | null
          xml_autorizacao?: string | null
          xml_baixado?: boolean | null
          xml_cancelamento?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_notas_fiscais_vinculada_lancamento_id_fkey"
            columns: ["vinculada_lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_orcamento: {
        Row: {
          ano: number
          cenario: string | null
          centro_custo_id: string | null
          created_at: string | null
          empresa_id: string
          id: string
          mes: number
          observacoes: string | null
          plano_conta_id: string
          updated_at: string | null
          user_id: string
          valor_orcado: number
        }
        Insert: {
          ano: number
          cenario?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          empresa_id: string
          id?: string
          mes: number
          observacoes?: string | null
          plano_conta_id: string
          updated_at?: string | null
          user_id?: string
          valor_orcado?: number
        }
        Update: {
          ano?: number
          cenario?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          mes?: number
          observacoes?: string | null
          plano_conta_id?: string
          updated_at?: string | null
          user_id?: string
          valor_orcado?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_orcamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_orcamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_orcamento_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_pessoas: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj_cpf: string | null
          cod_municipio: number | null
          complemento: string | null
          created_at: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          id: string
          ie: string | null
          im: string | null
          ind_ie_dest: number | null
          limite_credito: number | null
          logradouro: string | null
          municipio: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          pessoa_tipo: string | null
          prazo_padrao_dias: number | null
          razao_social: string
          score_credito: number | null
          telefone: string | null
          tipo: string
          uf: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          cod_municipio?: number | null
          complemento?: string | null
          created_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          ind_ie_dest?: number | null
          limite_credito?: number | null
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          pessoa_tipo?: string | null
          prazo_padrao_dias?: number | null
          razao_social: string
          score_credito?: number | null
          telefone?: string | null
          tipo?: string
          uf?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          cod_municipio?: number | null
          complemento?: string | null
          created_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          ind_ie_dest?: number | null
          limite_credito?: number | null
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          pessoa_tipo?: string | null
          prazo_padrao_dias?: number | null
          razao_social?: string
          score_credito?: number | null
          telefone?: string | null
          tipo?: string
          uf?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_pix_cobrancas: {
        Row: {
          beneficiario_cidade: string
          beneficiario_nome: string
          br_code: string
          chave_pix: string
          created_at: string
          created_by: string | null
          data_expiracao: string | null
          data_pagamento: string | null
          descricao: string | null
          empresa_id: string
          id: string
          lancamento_id: string | null
          pessoa_id: string | null
          qr_code_image: string | null
          status: string
          tipo: string
          txid: string | null
          updated_at: string
          valor: number
          webhook_payload: Json | null
        }
        Insert: {
          beneficiario_cidade?: string
          beneficiario_nome: string
          br_code: string
          chave_pix: string
          created_at?: string
          created_by?: string | null
          data_expiracao?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          lancamento_id?: string | null
          pessoa_id?: string | null
          qr_code_image?: string | null
          status?: string
          tipo?: string
          txid?: string | null
          updated_at?: string
          valor: number
          webhook_payload?: Json | null
        }
        Update: {
          beneficiario_cidade?: string
          beneficiario_nome?: string
          br_code?: string
          chave_pix?: string
          created_at?: string
          created_by?: string | null
          data_expiracao?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          lancamento_id?: string | null
          pessoa_id?: string | null
          qr_code_image?: string | null
          status?: string
          tipo?: string
          txid?: string | null
          updated_at?: string
          valor?: number
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_pix_cobrancas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pix_cobrancas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_plano_contas: {
        Row: {
          aceita_lancamentos: boolean | null
          ativo: boolean | null
          codigo: string
          cor: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          natureza: string
          nivel: number | null
          nome: string
          pai_id: string | null
          tipo: string
        }
        Insert: {
          aceita_lancamentos?: boolean | null
          ativo?: boolean | null
          codigo: string
          cor?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          natureza: string
          nivel?: number | null
          nome: string
          pai_id?: string | null
          tipo: string
        }
        Update: {
          aceita_lancamentos?: boolean | null
          ativo?: boolean | null
          codigo?: string
          cor?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          natureza?: string
          nivel?: number | null
          nome?: string
          pai_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_plano_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_plano_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_plano_contas_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_projetos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string
          id: string
          licitacao_id: string | null
          nome: string
          status: string
          updated_at: string
          valor_orcado: number | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          licitacao_id?: string | null
          nome: string
          status?: string
          updated_at?: string
          valor_orcado?: number | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          licitacao_id?: string | null
          nome?: string
          status?: string
          updated_at?: string
          valor_orcado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_sefaz_agendamentos: {
        Row: {
          ativo: boolean | null
          cnpj: string
          created_at: string | null
          empresa_id: string
          frequencia: string
          id: string
          proxima_execucao: string | null
          total_importadas: number | null
          ultima_execucao: string | null
          ultimo_erro: string | null
          ultimo_nsu: string | null
          ultimo_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          cnpj: string
          created_at?: string | null
          empresa_id: string
          frequencia?: string
          id?: string
          proxima_execucao?: string | null
          total_importadas?: number | null
          ultima_execucao?: string | null
          ultimo_erro?: string | null
          ultimo_nsu?: string | null
          ultimo_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string
          created_at?: string | null
          empresa_id?: string
          frequencia?: string
          id?: string
          proxima_execucao?: string | null
          total_importadas?: number | null
          ultima_execucao?: string | null
          ultimo_erro?: string | null
          ultimo_nsu?: string | null
          ultimo_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_sefaz_agendamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_sefaz_agendamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_sped_arquivos: {
        Row: {
          arquivo_url: string | null
          competencia: string
          created_at: string | null
          empresa_id: string
          hash_sha256: string | null
          id: string
          recibo: string | null
          status: string
          tipo: string
          total_registros: number | null
          updated_at: string | null
          user_id: string
          validacao: Json | null
        }
        Insert: {
          arquivo_url?: string | null
          competencia: string
          created_at?: string | null
          empresa_id: string
          hash_sha256?: string | null
          id?: string
          recibo?: string | null
          status?: string
          tipo: string
          total_registros?: number | null
          updated_at?: string | null
          user_id?: string
          validacao?: Json | null
        }
        Update: {
          arquivo_url?: string | null
          competencia?: string
          created_at?: string | null
          empresa_id?: string
          hash_sha256?: string | null
          id?: string
          recibo?: string | null
          status?: string
          tipo?: string
          total_registros?: number | null
          updated_at?: string | null
          user_id?: string
          validacao?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_sped_arquivos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_sped_arquivos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_apuracoes: {
        Row: {
          aliquota_efetiva_simples: number | null
          apuracao_desatualizada: boolean
          base_csll: number | null
          base_irpj: number | null
          base_pis_cofins: number | null
          competencia: string
          created_at: string
          created_by: string | null
          desatualizada_em: string | null
          desatualizada_motivo: string | null
          detalhes: Json | null
          empresa_id: string
          id: string
          observacoes: string | null
          pago_em: string | null
          rbt12: number | null
          receita_bruta_comercio: number
          receita_bruta_servico: number
          receita_bruta_total: number
          regime: string
          status: string
          updated_at: string
          valor_adicional_irpj: number | null
          valor_cofins: number | null
          valor_csll: number | null
          valor_icms: number | null
          valor_irpj: number | null
          valor_iss: number | null
          valor_pis: number | null
          valor_simples: number | null
          valor_total: number
        }
        Insert: {
          aliquota_efetiva_simples?: number | null
          apuracao_desatualizada?: boolean
          base_csll?: number | null
          base_irpj?: number | null
          base_pis_cofins?: number | null
          competencia: string
          created_at?: string
          created_by?: string | null
          desatualizada_em?: string | null
          desatualizada_motivo?: string | null
          detalhes?: Json | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          pago_em?: string | null
          rbt12?: number | null
          receita_bruta_comercio?: number
          receita_bruta_servico?: number
          receita_bruta_total?: number
          regime: string
          status?: string
          updated_at?: string
          valor_adicional_irpj?: number | null
          valor_cofins?: number | null
          valor_csll?: number | null
          valor_icms?: number | null
          valor_irpj?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_simples?: number | null
          valor_total?: number
        }
        Update: {
          aliquota_efetiva_simples?: number | null
          apuracao_desatualizada?: boolean
          base_csll?: number | null
          base_irpj?: number | null
          base_pis_cofins?: number | null
          competencia?: string
          created_at?: string
          created_by?: string | null
          desatualizada_em?: string | null
          desatualizada_motivo?: string | null
          detalhes?: Json | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          pago_em?: string | null
          rbt12?: number | null
          receita_bruta_comercio?: number
          receita_bruta_servico?: number
          receita_bruta_total?: number
          regime?: string
          status?: string
          updated_at?: string
          valor_adicional_irpj?: number | null
          valor_cofins?: number | null
          valor_csll?: number | null
          valor_icms?: number | null
          valor_irpj?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_simples?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_apuracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_apuracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_audit_log: {
        Row: {
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          empresa_id: string
          id: number
          ip: unknown
          operacao: string
          registro_id: string
          tabela: string
          user_agent: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          empresa_id: string
          id?: number
          ip?: unknown
          operacao: string
          registro_id: string
          tabela: string
          user_agent?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          empresa_id?: string
          id?: number
          ip?: unknown
          operacao?: string
          registro_id?: string
          tabela?: string
          user_agent?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      financeiro_categorias: {
        Row: {
          ativa: boolean
          codigo: string
          cor: string | null
          created_at: string
          dfc_classe: string | null
          empresa_id: string
          grupo_dre: string | null
          icone: string | null
          id: string
          natureza: Database["public"]["Enums"]["financeiro_natureza"]
          nome: string
          parent_id: string | null
          permite_lancamento: boolean
          tipo_servico: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          codigo: string
          cor?: string | null
          created_at?: string
          dfc_classe?: string | null
          empresa_id: string
          grupo_dre?: string | null
          icone?: string | null
          id?: string
          natureza: Database["public"]["Enums"]["financeiro_natureza"]
          nome: string
          parent_id?: string | null
          permite_lancamento?: boolean
          tipo_servico?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          codigo?: string
          cor?: string | null
          created_at?: string
          dfc_classe?: string | null
          empresa_id?: string
          grupo_dre?: string | null
          icone?: string | null
          id?: string
          natureza?: Database["public"]["Enums"]["financeiro_natureza"]
          nome?: string
          parent_id?: string | null
          permite_lancamento?: boolean
          tipo_servico?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mv_financeiro_dre_mensal"
            referencedColumns: ["categoria_id"]
          },
        ]
      }
      financeiro_centros_custo: {
        Row: {
          ativo: boolean
          codigo: string
          contrato_id: string | null
          created_at: string
          descricao: string | null
          edital_id: string | null
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          contrato_id?: string | null
          created_at?: string
          descricao?: string | null
          edital_id?: string | null
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          contrato_id?: string | null
          created_at?: string
          descricao?: string | null
          edital_id?: string | null
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_certificados: {
        Row: {
          arquivo_path: string | null
          ativo: boolean
          cnpj: string
          created_at: string
          emissor: string | null
          empresa_id: string | null
          id: string
          nome: string
          numero_serie: string | null
          provedor: string | null
          provedor_ref: string | null
          senha_cifrada: string | null
          tipo: string
          updated_at: string
          user_id: string
          uso_padrao: boolean
          validade_ate: string
          validade_de: string
        }
        Insert: {
          arquivo_path?: string | null
          ativo?: boolean
          cnpj: string
          created_at?: string
          emissor?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          numero_serie?: string | null
          provedor?: string | null
          provedor_ref?: string | null
          senha_cifrada?: string | null
          tipo: string
          updated_at?: string
          user_id: string
          uso_padrao?: boolean
          validade_ate: string
          validade_de: string
        }
        Update: {
          arquivo_path?: string | null
          ativo?: boolean
          cnpj?: string
          created_at?: string
          emissor?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          numero_serie?: string | null
          provedor?: string | null
          provedor_ref?: string | null
          senha_cifrada?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          uso_padrao?: boolean
          validade_ate?: string
          validade_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_certificados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_certificados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_comissoes_calculadas: {
        Row: {
          base: number
          competencia: string
          created_at: string
          empresa_id: string
          id: string
          lancamento_origem_id: string | null
          lancamento_pagamento_id: string | null
          percentual: number
          pessoa_id: string
          regra_id: string | null
          status: string | null
          valor: number
        }
        Insert: {
          base: number
          competencia: string
          created_at?: string
          empresa_id: string
          id?: string
          lancamento_origem_id?: string | null
          lancamento_pagamento_id?: string | null
          percentual: number
          pessoa_id: string
          regra_id?: string | null
          status?: string | null
          valor: number
        }
        Update: {
          base?: number
          competencia?: string
          created_at?: string
          empresa_id?: string
          id?: string
          lancamento_origem_id?: string | null
          lancamento_pagamento_id?: string | null
          percentual?: number
          pessoa_id?: string
          regra_id?: string | null
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_comissoes_calculadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comissoes_calculadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comissoes_calculadas_lancamento_origem_id_fkey"
            columns: ["lancamento_origem_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comissoes_calculadas_lancamento_pagamento_id_fkey"
            columns: ["lancamento_pagamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comissoes_calculadas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comissoes_calculadas_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "financeiro_comissoes_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_comissoes_regras: {
        Row: {
          ativa: boolean | null
          base_calculo: string
          empresa_id: string
          id: string
          nome: string
          percentual: number
          pessoa_id: string
          valor_maximo: number | null
          valor_minimo: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativa?: boolean | null
          base_calculo: string
          empresa_id: string
          id?: string
          nome: string
          percentual: number
          pessoa_id: string
          valor_maximo?: number | null
          valor_minimo?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativa?: boolean | null
          base_calculo?: string
          empresa_id?: string
          id?: string
          nome?: string
          percentual?: number
          pessoa_id?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_comissoes_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comissoes_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_comissoes_regras_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_conciliacoes: {
        Row: {
          conciliado_por: string | null
          created_at: string
          empresa_id: string
          extrato_movimento_id: string
          id: string
          lancamento_id: string
          metodo: string
          motivos: Json | null
          score: number
        }
        Insert: {
          conciliado_por?: string | null
          created_at?: string
          empresa_id: string
          extrato_movimento_id: string
          id?: string
          lancamento_id: string
          metodo: string
          motivos?: Json | null
          score: number
        }
        Update: {
          conciliado_por?: string | null
          created_at?: string
          empresa_id?: string
          extrato_movimento_id?: string
          id?: string
          lancamento_id?: string
          metodo?: string
          motivos?: Json | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_conciliacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_conciliacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_conciliacoes_extrato_movimento_id_fkey"
            columns: ["extrato_movimento_id"]
            isOneToOne: true
            referencedRelation: "financeiro_extrato_movimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_conciliacoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_config_tributaria: {
        Row: {
          adicional_irpj: number | null
          aliquota_cofins: number | null
          aliquota_cofins_nc: number | null
          aliquota_csll: number | null
          aliquota_icms: number | null
          aliquota_irpj: number | null
          aliquota_iss: number | null
          aliquota_pis: number | null
          aliquota_pis_nc: number | null
          anexo_simples: number | null
          created_at: string
          empresa_id: string
          limite_adicional_irpj: number | null
          presuncao_csll_comercio: number | null
          presuncao_csll_servico: number | null
          presuncao_irpj_comercio: number | null
          presuncao_irpj_servico: number | null
          regime: string
          updated_at: string
        }
        Insert: {
          adicional_irpj?: number | null
          aliquota_cofins?: number | null
          aliquota_cofins_nc?: number | null
          aliquota_csll?: number | null
          aliquota_icms?: number | null
          aliquota_irpj?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          aliquota_pis_nc?: number | null
          anexo_simples?: number | null
          created_at?: string
          empresa_id: string
          limite_adicional_irpj?: number | null
          presuncao_csll_comercio?: number | null
          presuncao_csll_servico?: number | null
          presuncao_irpj_comercio?: number | null
          presuncao_irpj_servico?: number | null
          regime?: string
          updated_at?: string
        }
        Update: {
          adicional_irpj?: number | null
          aliquota_cofins?: number | null
          aliquota_cofins_nc?: number | null
          aliquota_csll?: number | null
          aliquota_icms?: number | null
          aliquota_irpj?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          aliquota_pis_nc?: number | null
          anexo_simples?: number | null
          created_at?: string
          empresa_id?: string
          limite_adicional_irpj?: number | null
          presuncao_csll_comercio?: number | null
          presuncao_csll_servico?: number | null
          presuncao_irpj_comercio?: number | null
          presuncao_irpj_servico?: number | null
          regime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_config_tributaria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_config_tributaria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_consulta_nfe_log: {
        Row: {
          cnpj: string
          created_at: string
          duracao_ms: number | null
          erro_mensagem: string | null
          id: string
          nfes_encontradas: number | null
          nfes_novas: number | null
          nsu_final: number
          nsu_inicial: number
          status: string
          tipo: string
          user_id: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          duracao_ms?: number | null
          erro_mensagem?: string | null
          id?: string
          nfes_encontradas?: number | null
          nfes_novas?: number | null
          nsu_final: number
          nsu_inicial: number
          status?: string
          tipo: string
          user_id: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          duracao_ms?: number | null
          erro_mensagem?: string | null
          id?: string
          nfes_encontradas?: number | null
          nfes_novas?: number | null
          nsu_final?: number
          nsu_inicial?: number
          status?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      financeiro_contas: {
        Row: {
          agencia: string | null
          ativa: boolean
          banco_codigo: string | null
          banco_nome: string | null
          considerar_resumo: boolean
          conta: string | null
          conta_vinculada_id: string | null
          cor: string | null
          created_at: string
          created_by: string | null
          data_saldo_inicial: string | null
          empresa_id: string
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          gerente_ddd: string | null
          gerente_email: string | null
          gerente_nome: string | null
          gerente_telefone: string | null
          id: string
          limite_credito: number
          moeda: string
          nome: string
          observacao: string | null
          ordem: number | null
          pluggy_account_id: string | null
          pluggy_item_id: string | null
          pluggy_last_sync: string | null
          saldo_atual: number
          saldo_inicial: number
          tipo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativa?: boolean
          banco_codigo?: string | null
          banco_nome?: string | null
          considerar_resumo?: boolean
          conta?: string | null
          conta_vinculada_id?: string | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          data_saldo_inicial?: string | null
          empresa_id: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          gerente_ddd?: string | null
          gerente_email?: string | null
          gerente_nome?: string | null
          gerente_telefone?: string | null
          id?: string
          limite_credito?: number
          moeda?: string
          nome: string
          observacao?: string | null
          ordem?: number | null
          pluggy_account_id?: string | null
          pluggy_item_id?: string | null
          pluggy_last_sync?: string | null
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativa?: boolean
          banco_codigo?: string | null
          banco_nome?: string | null
          considerar_resumo?: boolean
          conta?: string | null
          conta_vinculada_id?: string | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          data_saldo_inicial?: string | null
          empresa_id?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          gerente_ddd?: string | null
          gerente_email?: string | null
          gerente_nome?: string | null
          gerente_telefone?: string | null
          id?: string
          limite_credito?: number
          moeda?: string
          nome?: string
          observacao?: string | null
          ordem?: number | null
          pluggy_account_id?: string | null
          pluggy_item_id?: string | null
          pluggy_last_sync?: string | null
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_contas_conta_vinculada_id_fkey"
            columns: ["conta_vinculada_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_demonstracoes: {
        Row: {
          competencia_fim: string
          competencia_inicio: string
          created_at: string
          dados: Json
          empresa_id: string
          gerado_por: string | null
          id: string
          observacoes: string | null
          resultado_liquido: number | null
          tipo: string
          total_ativo: number | null
          total_passivo: number | null
        }
        Insert: {
          competencia_fim: string
          competencia_inicio: string
          created_at?: string
          dados?: Json
          empresa_id: string
          gerado_por?: string | null
          id?: string
          observacoes?: string | null
          resultado_liquido?: number | null
          tipo: string
          total_ativo?: number | null
          total_passivo?: number | null
        }
        Update: {
          competencia_fim?: string
          competencia_inicio?: string
          created_at?: string
          dados?: Json
          empresa_id?: string
          gerado_por?: string | null
          id?: string
          observacoes?: string | null
          resultado_liquido?: number | null
          tipo?: string
          total_ativo?: number | null
          total_passivo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_demonstracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_demonstracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_documentos_fiscais: {
        Row: {
          arquivo_url: string | null
          arquivo_xml: string | null
          chave_acesso: string | null
          created_at: string
          data_emissao: string
          destinatario_id: string | null
          emissor_id: string | null
          empresa_id: string
          id: string
          numero: string | null
          ocr_data: Json | null
          origem: Database["public"]["Enums"]["financeiro_origem_movimento"]
          serie: string | null
          tipo: Database["public"]["Enums"]["financeiro_tipo_documento"]
          valor_impostos: number | null
          valor_total: number
        }
        Insert: {
          arquivo_url?: string | null
          arquivo_xml?: string | null
          chave_acesso?: string | null
          created_at?: string
          data_emissao: string
          destinatario_id?: string | null
          emissor_id?: string | null
          empresa_id: string
          id?: string
          numero?: string | null
          ocr_data?: Json | null
          origem?: Database["public"]["Enums"]["financeiro_origem_movimento"]
          serie?: string | null
          tipo: Database["public"]["Enums"]["financeiro_tipo_documento"]
          valor_impostos?: number | null
          valor_total: number
        }
        Update: {
          arquivo_url?: string | null
          arquivo_xml?: string | null
          chave_acesso?: string | null
          created_at?: string
          data_emissao?: string
          destinatario_id?: string | null
          emissor_id?: string | null
          empresa_id?: string
          id?: string
          numero?: string | null
          ocr_data?: Json | null
          origem?: Database["public"]["Enums"]["financeiro_origem_movimento"]
          serie?: string | null
          tipo?: Database["public"]["Enums"]["financeiro_tipo_documento"]
          valor_impostos?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_documentos_fiscais_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_documentos_fiscais_emissor_id_fkey"
            columns: ["emissor_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_documentos_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_documentos_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_exclusao_log: {
        Row: {
          created_at: string
          dependencias: Json
          empresa_id: string
          erro_mensagem: string | null
          id: string
          motivo: string | null
          pessoa_documento: string | null
          pessoa_id: string
          pessoa_nome: string | null
          pessoa_tipo: string | null
          resultado: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dependencias?: Json
          empresa_id: string
          erro_mensagem?: string | null
          id?: string
          motivo?: string | null
          pessoa_documento?: string | null
          pessoa_id: string
          pessoa_nome?: string | null
          pessoa_tipo?: string | null
          resultado: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dependencias?: Json
          empresa_id?: string
          erro_mensagem?: string | null
          id?: string
          motivo?: string | null
          pessoa_documento?: string | null
          pessoa_id?: string
          pessoa_nome?: string | null
          pessoa_tipo?: string | null
          resultado?: string
          user_id?: string | null
        }
        Relationships: []
      }
      financeiro_extrato_movimentos: {
        Row: {
          conciliado: boolean
          conta_id: string
          created_at: string
          data_movimento: string
          descricao: string
          descricao_extra: string | null
          empresa_id: string
          extrato_id: string
          fitid: string
          id: string
          ignorado: boolean
          ignorado_em: string | null
          ignorado_motivo: string | null
          lancamento_id: string | null
          saldo_apos: number | null
          tipo: string
          valor: number
        }
        Insert: {
          conciliado?: boolean
          conta_id: string
          created_at?: string
          data_movimento: string
          descricao: string
          descricao_extra?: string | null
          empresa_id: string
          extrato_id: string
          fitid: string
          id?: string
          ignorado?: boolean
          ignorado_em?: string | null
          ignorado_motivo?: string | null
          lancamento_id?: string | null
          saldo_apos?: number | null
          tipo: string
          valor: number
        }
        Update: {
          conciliado?: boolean
          conta_id?: string
          created_at?: string
          data_movimento?: string
          descricao?: string
          descricao_extra?: string | null
          empresa_id?: string
          extrato_id?: string
          fitid?: string
          id?: string
          ignorado?: boolean
          ignorado_em?: string | null
          ignorado_motivo?: string | null
          lancamento_id?: string | null
          saldo_apos?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_extrato_movimentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_extrato_movimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_extrato_movimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_extrato_movimentos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "financeiro_extratos_importados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_extrato_movimentos_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_extratos_importados: {
        Row: {
          arquivo_hash: string
          arquivo_nome: string
          arquivo_url: string | null
          conta_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          erro_mensagem: string | null
          formato: string
          id: string
          importado_por: string | null
          status: string
          total_conciliados: number | null
          total_movimentos: number | null
        }
        Insert: {
          arquivo_hash: string
          arquivo_nome: string
          arquivo_url?: string | null
          conta_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          erro_mensagem?: string | null
          formato: string
          id?: string
          importado_por?: string | null
          status?: string
          total_conciliados?: number | null
          total_movimentos?: number | null
        }
        Update: {
          arquivo_hash?: string
          arquivo_nome?: string
          arquivo_url?: string | null
          conta_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          erro_mensagem?: string | null
          formato?: string
          id?: string
          importado_por?: string | null
          status?: string
          total_conciliados?: number | null
          total_movimentos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_extratos_importados_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_extratos_importados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_extratos_importados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_folha_itens: {
        Row: {
          descontos: Json | null
          empresa_id: string
          fgts: number | null
          folha_id: string
          funcionario_id: string
          id: string
          inss: number | null
          irrf: number | null
          lancamento_id: string | null
          proventos: Json | null
          salario_base: number
          total_liquido: number
        }
        Insert: {
          descontos?: Json | null
          empresa_id: string
          fgts?: number | null
          folha_id: string
          funcionario_id: string
          id?: string
          inss?: number | null
          irrf?: number | null
          lancamento_id?: string | null
          proventos?: Json | null
          salario_base: number
          total_liquido: number
        }
        Update: {
          descontos?: Json | null
          empresa_id?: string
          fgts?: number | null
          folha_id?: string
          funcionario_id?: string
          id?: string
          inss?: number | null
          irrf?: number | null
          lancamento_id?: string | null
          proventos?: Json | null
          salario_base?: number
          total_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_folha_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_folha_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_folha_itens_folha_id_fkey"
            columns: ["folha_id"]
            isOneToOne: false
            referencedRelation: "financeiro_folha_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_folha_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_folha_itens_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_folha_pagamento: {
        Row: {
          competencia: string
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          empresa_id: string
          id: string
          status: string
          total_descontos: number | null
          total_fgts: number | null
          total_inss_patronal: number | null
          total_liquido: number | null
          total_proventos: number | null
        }
        Insert: {
          competencia: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          empresa_id: string
          id?: string
          status?: string
          total_descontos?: number | null
          total_fgts?: number | null
          total_inss_patronal?: number | null
          total_liquido?: number | null
          total_proventos?: number | null
        }
        Update: {
          competencia?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          empresa_id?: string
          id?: string
          status?: string
          total_descontos?: number | null
          total_fgts?: number | null
          total_inss_patronal?: number | null
          total_liquido?: number | null
          total_proventos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_folha_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_folha_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          anexos: Json | null
          categoria_id: string | null
          categoria_sugerida_confianca: number | null
          categoria_sugerida_id: string | null
          categoria_sugerida_modelo: string | null
          centro_custo_id: string | null
          chave_acesso_nfe: string | null
          conta_destino_id: string | null
          conta_id: string | null
          contrato_id: string | null
          contrato_item_id: string | null
          contrato_pedido_id: string | null
          created_at: string
          created_by: string | null
          data_competencia: string
          data_conciliado: string | null
          data_emissao: string | null
          data_realizado: string | null
          data_vencimento: string | null
          descricao: string
          documento_fiscal_id: string | null
          edital_id: string | null
          empresa_id: string
          forma_pagamento: string | null
          id: string
          meio_pagamento_dados: Json | null
          natureza: Database["public"]["Enums"]["financeiro_natureza"]
          numero_documento: string | null
          observacoes: string | null
          origem: Database["public"]["Enums"]["financeiro_origem_movimento"]
          origem_ref: string | null
          parcela_numero: number | null
          parcela_pai_id: string | null
          parcela_total: number | null
          pessoa_id: string | null
          recorrencia_id: string | null
          recorrencia_rrule: string | null
          serie_documento: string | null
          status: Database["public"]["Enums"]["financeiro_status_lancamento"]
          tags: string[] | null
          tipo: Database["public"]["Enums"]["financeiro_tipo_lancamento"]
          tipo_documento:
            | Database["public"]["Enums"]["financeiro_tipo_documento"]
            | null
          updated_at: string
          updated_by: string | null
          valor: number
          valor_desconto: number | null
          valor_imposto: number | null
          valor_juros: number | null
          valor_multa: number | null
          valor_tarifa: number | null
          vendedor_responsavel_id: string | null
        }
        Insert: {
          anexos?: Json | null
          categoria_id?: string | null
          categoria_sugerida_confianca?: number | null
          categoria_sugerida_id?: string | null
          categoria_sugerida_modelo?: string | null
          centro_custo_id?: string | null
          chave_acesso_nfe?: string | null
          conta_destino_id?: string | null
          conta_id?: string | null
          contrato_id?: string | null
          contrato_item_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          created_by?: string | null
          data_competencia: string
          data_conciliado?: string | null
          data_emissao?: string | null
          data_realizado?: string | null
          data_vencimento?: string | null
          descricao: string
          documento_fiscal_id?: string | null
          edital_id?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          id?: string
          meio_pagamento_dados?: Json | null
          natureza: Database["public"]["Enums"]["financeiro_natureza"]
          numero_documento?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["financeiro_origem_movimento"]
          origem_ref?: string | null
          parcela_numero?: number | null
          parcela_pai_id?: string | null
          parcela_total?: number | null
          pessoa_id?: string | null
          recorrencia_id?: string | null
          recorrencia_rrule?: string | null
          serie_documento?: string | null
          status?: Database["public"]["Enums"]["financeiro_status_lancamento"]
          tags?: string[] | null
          tipo: Database["public"]["Enums"]["financeiro_tipo_lancamento"]
          tipo_documento?:
            | Database["public"]["Enums"]["financeiro_tipo_documento"]
            | null
          updated_at?: string
          updated_by?: string | null
          valor: number
          valor_desconto?: number | null
          valor_imposto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_tarifa?: number | null
          vendedor_responsavel_id?: string | null
        }
        Update: {
          anexos?: Json | null
          categoria_id?: string | null
          categoria_sugerida_confianca?: number | null
          categoria_sugerida_id?: string | null
          categoria_sugerida_modelo?: string | null
          centro_custo_id?: string | null
          chave_acesso_nfe?: string | null
          conta_destino_id?: string | null
          conta_id?: string | null
          contrato_id?: string | null
          contrato_item_id?: string | null
          contrato_pedido_id?: string | null
          created_at?: string
          created_by?: string | null
          data_competencia?: string
          data_conciliado?: string | null
          data_emissao?: string | null
          data_realizado?: string | null
          data_vencimento?: string | null
          descricao?: string
          documento_fiscal_id?: string | null
          edital_id?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          id?: string
          meio_pagamento_dados?: Json | null
          natureza?: Database["public"]["Enums"]["financeiro_natureza"]
          numero_documento?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["financeiro_origem_movimento"]
          origem_ref?: string | null
          parcela_numero?: number | null
          parcela_pai_id?: string | null
          parcela_total?: number | null
          pessoa_id?: string | null
          recorrencia_id?: string | null
          recorrencia_rrule?: string | null
          serie_documento?: string | null
          status?: Database["public"]["Enums"]["financeiro_status_lancamento"]
          tags?: string[] | null
          tipo?: Database["public"]["Enums"]["financeiro_tipo_lancamento"]
          tipo_documento?:
            | Database["public"]["Enums"]["financeiro_tipo_documento"]
            | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_desconto?: number | null
          valor_imposto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_tarifa?: number | null
          vendedor_responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "mv_financeiro_dre_mensal"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_categoria_sugerida_id_fkey"
            columns: ["categoria_sugerida_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_categoria_sugerida_id_fkey"
            columns: ["categoria_sugerida_id"]
            isOneToOne: false
            referencedRelation: "mv_financeiro_dre_mensal"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "financeiro_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_contrato_item_id_fkey"
            columns: ["contrato_item_id"]
            isOneToOne: false
            referencedRelation: "contrato_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_contrato_pedido_id_fkey"
            columns: ["contrato_pedido_id"]
            isOneToOne: false
            referencedRelation: "contrato_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_documento_fiscal_id_fkey"
            columns: ["documento_fiscal_id"]
            isOneToOne: false
            referencedRelation: "financeiro_documentos_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_parcela_pai_id_fkey"
            columns: ["parcela_pai_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_manifestacoes: {
        Row: {
          automatica: boolean | null
          chave_nfe: string
          data_manifestacao: string
          empresa_id: string | null
          id: string
          motivo: string | null
          protocolo: string | null
          realizado_por: string | null
          tipo: Database["public"]["Enums"]["financeiro_manifestacao_tipo"]
          user_id: string
        }
        Insert: {
          automatica?: boolean | null
          chave_nfe: string
          data_manifestacao?: string
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          protocolo?: string | null
          realizado_por?: string | null
          tipo: Database["public"]["Enums"]["financeiro_manifestacao_tipo"]
          user_id: string
        }
        Update: {
          automatica?: boolean | null
          chave_nfe?: string
          data_manifestacao?: string
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          protocolo?: string | null
          realizado_por?: string | null
          tipo?: Database["public"]["Enums"]["financeiro_manifestacao_tipo"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_manifestacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_manifestacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_metas: {
        Row: {
          ano: number
          conta_id: string
          created_at: string
          empresa_id: string
          id: string
          mes: number
          metodo_projecao: string
          observacao: string | null
          updated_at: string
          user_id: string
          valor_orcado: number
        }
        Insert: {
          ano: number
          conta_id: string
          created_at?: string
          empresa_id: string
          id?: string
          mes: number
          metodo_projecao?: string
          observacao?: string | null
          updated_at?: string
          user_id: string
          valor_orcado?: number
        }
        Update: {
          ano?: number
          conta_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          mes?: number
          metodo_projecao?: string
          observacao?: string | null
          updated_at?: string
          user_id?: string
          valor_orcado?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_metas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financeiro_plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_metas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_metas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_nfe_eventos: {
        Row: {
          data_evento: string
          id: string
          motivo: string | null
          nfe_id: string
          protocolo: string | null
          realizado_por: string | null
          tipo_evento: string
          user_id: string
          xml_url: string | null
        }
        Insert: {
          data_evento?: string
          id?: string
          motivo?: string | null
          nfe_id: string
          protocolo?: string | null
          realizado_por?: string | null
          tipo_evento: string
          user_id: string
          xml_url?: string | null
        }
        Update: {
          data_evento?: string
          id?: string
          motivo?: string | null
          nfe_id?: string
          protocolo?: string | null
          realizado_por?: string | null
          tipo_evento?: string
          user_id?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_nfe_eventos_nfe_id_fkey"
            columns: ["nfe_id"]
            isOneToOne: false
            referencedRelation: "financeiro_nfes_emitidas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_nfes_emitidas: {
        Row: {
          ambiente: string
          certificado_id: string | null
          cfop: string | null
          chave_acesso: string | null
          consumidor_final: boolean | null
          created_at: string
          danfe_url: string | null
          data_autorizacao: string | null
          data_emissao: string
          data_saida: string | null
          destinatario_dados: Json
          empresa_id: string | null
          finalidade: string
          id: string
          informacoes_adicionais: string | null
          itens: Json
          modelo: string
          motivo: string | null
          natureza_operacao: string
          nfse_aliquota_iss: number | null
          nfse_codigo_servico: string | null
          nfse_iss_retido: boolean | null
          nfse_municipio: string | null
          numero: number | null
          observacoes: string | null
          presenca: string | null
          protocolo: string | null
          provedor: string
          serie: number
          status: Database["public"]["Enums"]["financeiro_status_nfe"]
          updated_at: string
          user_id: string
          uuid_provedor: string
          valor_cofins: number | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_icms: number | null
          valor_icms_st: number | null
          valor_ipi: number | null
          valor_iss: number | null
          valor_outros: number | null
          valor_pis: number | null
          valor_produtos: number
          valor_seguro: number | null
          valor_servicos: number
          valor_total: number
          xml_cancelamento_url: string | null
          xml_url: string | null
        }
        Insert: {
          ambiente?: string
          certificado_id?: string | null
          cfop?: string | null
          chave_acesso?: string | null
          consumidor_final?: boolean | null
          created_at?: string
          danfe_url?: string | null
          data_autorizacao?: string | null
          data_emissao?: string
          data_saida?: string | null
          destinatario_dados: Json
          empresa_id?: string | null
          finalidade?: string
          id?: string
          informacoes_adicionais?: string | null
          itens?: Json
          modelo: string
          motivo?: string | null
          natureza_operacao: string
          nfse_aliquota_iss?: number | null
          nfse_codigo_servico?: string | null
          nfse_iss_retido?: boolean | null
          nfse_municipio?: string | null
          numero?: number | null
          observacoes?: string | null
          presenca?: string | null
          protocolo?: string | null
          provedor?: string
          serie?: number
          status?: Database["public"]["Enums"]["financeiro_status_nfe"]
          updated_at?: string
          user_id: string
          uuid_provedor: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_icms_st?: number | null
          valor_ipi?: number | null
          valor_iss?: number | null
          valor_outros?: number | null
          valor_pis?: number | null
          valor_produtos?: number
          valor_seguro?: number | null
          valor_servicos?: number
          valor_total: number
          xml_cancelamento_url?: string | null
          xml_url?: string | null
        }
        Update: {
          ambiente?: string
          certificado_id?: string | null
          cfop?: string | null
          chave_acesso?: string | null
          consumidor_final?: boolean | null
          created_at?: string
          danfe_url?: string | null
          data_autorizacao?: string | null
          data_emissao?: string
          data_saida?: string | null
          destinatario_dados?: Json
          empresa_id?: string | null
          finalidade?: string
          id?: string
          informacoes_adicionais?: string | null
          itens?: Json
          modelo?: string
          motivo?: string | null
          natureza_operacao?: string
          nfse_aliquota_iss?: number | null
          nfse_codigo_servico?: string | null
          nfse_iss_retido?: boolean | null
          nfse_municipio?: string | null
          numero?: number | null
          observacoes?: string | null
          presenca?: string | null
          protocolo?: string | null
          provedor?: string
          serie?: number
          status?: Database["public"]["Enums"]["financeiro_status_nfe"]
          updated_at?: string
          user_id?: string
          uuid_provedor?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_icms_st?: number | null
          valor_ipi?: number | null
          valor_iss?: number | null
          valor_outros?: number | null
          valor_pis?: number | null
          valor_produtos?: number
          valor_seguro?: number | null
          valor_servicos?: number
          valor_total?: number
          xml_cancelamento_url?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_nfes_emitidas_certificado_id_fkey"
            columns: ["certificado_id"]
            isOneToOne: false
            referencedRelation: "financeiro_certificados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_nfes_emitidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_nfes_emitidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_notas_importadas: {
        Row: {
          chave_acesso: string | null
          cnpj_destinatario: string | null
          cnpj_emitente: string | null
          competencia: string
          created_at: string
          data_emissao: string
          direcao: string
          empresa_id: string
          erro_mensagem: string | null
          id: string
          importado_por: string | null
          iss_retido: number | null
          lancamento_id: string | null
          nome_destinatario: string | null
          nome_emitente: string | null
          numero: string | null
          serie: string | null
          status: string
          tipo: string
          tipo_servico: string | null
          updated_at: string
          valor_produtos: number | null
          valor_servicos: number | null
          valor_total: number
          xml_original: string | null
        }
        Insert: {
          chave_acesso?: string | null
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          competencia: string
          created_at?: string
          data_emissao: string
          direcao: string
          empresa_id: string
          erro_mensagem?: string | null
          id?: string
          importado_por?: string | null
          iss_retido?: number | null
          lancamento_id?: string | null
          nome_destinatario?: string | null
          nome_emitente?: string | null
          numero?: string | null
          serie?: string | null
          status?: string
          tipo: string
          tipo_servico?: string | null
          updated_at?: string
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number
          xml_original?: string | null
        }
        Update: {
          chave_acesso?: string | null
          cnpj_destinatario?: string | null
          cnpj_emitente?: string | null
          competencia?: string
          created_at?: string
          data_emissao?: string
          direcao?: string
          empresa_id?: string
          erro_mensagem?: string | null
          id?: string
          importado_por?: string | null
          iss_retido?: number | null
          lancamento_id?: string | null
          nome_destinatario?: string | null
          nome_emitente?: string | null
          numero?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          tipo_servico?: string | null
          updated_at?: string
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number
          xml_original?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_notas_importadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_notas_importadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_notas_importadas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_open_finance_conexoes: {
        Row: {
          banco_codigo: string | null
          banco_nome: string
          conta_id: string | null
          created_at: string
          criado_por: string | null
          empresa_id: string
          erro_mensagem: string | null
          frequencia_horas: number
          id: string
          item_id_externo: string | null
          metadata: Json
          provedor: string
          proxima_sincronizacao: string | null
          status: string
          ultima_sincronizacao: string | null
          updated_at: string
        }
        Insert: {
          banco_codigo?: string | null
          banco_nome: string
          conta_id?: string | null
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          erro_mensagem?: string | null
          frequencia_horas?: number
          id?: string
          item_id_externo?: string | null
          metadata?: Json
          provedor: string
          proxima_sincronizacao?: string | null
          status?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
        }
        Update: {
          banco_codigo?: string | null
          banco_nome?: string
          conta_id?: string | null
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          erro_mensagem?: string | null
          frequencia_horas?: number
          id?: string
          item_id_externo?: string | null
          metadata?: Json
          provedor?: string
          proxima_sincronizacao?: string | null
          status?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_open_finance_conexoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_open_finance_conexoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_open_finance_conexoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_open_finance_sync_log: {
        Row: {
          conexao_id: string
          created_at: string
          duracao_ms: number | null
          empresa_id: string
          erro: string | null
          id: string
          movimentos_novos: number
          saldo_atual: number | null
          status: string
        }
        Insert: {
          conexao_id: string
          created_at?: string
          duracao_ms?: number | null
          empresa_id: string
          erro?: string | null
          id?: string
          movimentos_novos?: number
          saldo_atual?: number | null
          status: string
        }
        Update: {
          conexao_id?: string
          created_at?: string
          duracao_ms?: number | null
          empresa_id?: string
          erro?: string | null
          id?: string
          movimentos_novos?: number
          saldo_atual?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_open_finance_sync_log_conexao_id_fkey"
            columns: ["conexao_id"]
            isOneToOne: false
            referencedRelation: "financeiro_open_finance_conexoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_open_finance_sync_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_open_finance_sync_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_pessoas: {
        Row: {
          ativo: boolean
          cnae_principal: string | null
          contato_secundario: Json | null
          created_at: string
          dados_bancarios: Json | null
          documento: string
          email: string | null
          empresa_id: string
          endereco: Json | null
          id: string
          ie: string | null
          im: string | null
          ind_ie_dest: number | null
          limite_credito: number | null
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          pessoa_tipo: string
          prazo_padrao_dias: number | null
          regime_tributario: string | null
          site: string | null
          tags: string[] | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnae_principal?: string | null
          contato_secundario?: Json | null
          created_at?: string
          dados_bancarios?: Json | null
          documento: string
          email?: string | null
          empresa_id: string
          endereco?: Json | null
          id?: string
          ie?: string | null
          im?: string | null
          ind_ie_dest?: number | null
          limite_credito?: number | null
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          pessoa_tipo: string
          prazo_padrao_dias?: number | null
          regime_tributario?: string | null
          site?: string | null
          tags?: string[] | null
          telefone?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnae_principal?: string | null
          contato_secundario?: Json | null
          created_at?: string
          dados_bancarios?: Json | null
          documento?: string
          email?: string | null
          empresa_id?: string
          endereco?: Json | null
          id?: string
          ie?: string | null
          im?: string | null
          ind_ie_dest?: number | null
          limite_credito?: number | null
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          pessoa_tipo?: string
          prazo_padrao_dias?: number | null
          regime_tributario?: string | null
          site?: string | null
          tags?: string[] | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_plano_contas: {
        Row: {
          aceita_lancamento: boolean
          ativo: boolean
          centro_resultado: string | null
          codigo: string
          conta_referencial_sped: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          natureza: string
          natureza_saldo: string
          nivel: number
          nome: string
          observacao: string | null
          ordem: number | null
          parent_id: string | null
          tipo_conta: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aceita_lancamento?: boolean
          ativo?: boolean
          centro_resultado?: string | null
          codigo: string
          conta_referencial_sped?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          natureza: string
          natureza_saldo: string
          nivel: number
          nome: string
          observacao?: string | null
          ordem?: number | null
          parent_id?: string | null
          tipo_conta: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aceita_lancamento?: boolean
          ativo?: boolean
          centro_resultado?: string | null
          codigo?: string
          conta_referencial_sped?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          natureza?: string
          natureza_saldo?: string
          nivel?: number
          nome?: string
          observacao?: string | null
          ordem?: number | null
          parent_id?: string | null
          tipo_conta?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_plano_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_plano_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_plano_contas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financeiro_plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_regras_categorizacao: {
        Row: {
          ativa: boolean
          categoria_id: string | null
          centro_custo_id: string | null
          condicoes: Json
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          pessoa_id: string | null
          prioridade: number
          ultima_aplicacao: string | null
          vezes_aplicada: number | null
        }
        Insert: {
          ativa?: boolean
          categoria_id?: string | null
          centro_custo_id?: string | null
          condicoes: Json
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          pessoa_id?: string | null
          prioridade?: number
          ultima_aplicacao?: string | null
          vezes_aplicada?: number | null
        }
        Update: {
          ativa?: boolean
          categoria_id?: string | null
          centro_custo_id?: string | null
          condicoes?: Json
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          pessoa_id?: string | null
          prioridade?: number
          ultima_aplicacao?: string | null
          vezes_aplicada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_regras_categorizacao_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_regras_categorizacao_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "mv_financeiro_dre_mensal"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "financeiro_regras_categorizacao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "financeiro_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_regras_categorizacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_regras_categorizacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_regras_categorizacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "financeiro_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_saldos_iniciais: {
        Row: {
          conta_bancaria_id: string | null
          conta_id: string
          created_at: string
          created_by: string | null
          data_corte: string
          empresa_id: string
          id: string
          observacao: string | null
          saldo_credor: number
          saldo_devedor: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conta_bancaria_id?: string | null
          conta_id: string
          created_at?: string
          created_by?: string | null
          data_corte: string
          empresa_id: string
          id?: string
          observacao?: string | null
          saldo_credor?: number
          saldo_devedor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conta_bancaria_id?: string | null
          conta_id?: string
          created_at?: string
          created_by?: string | null
          data_corte?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          saldo_credor?: number
          saldo_devedor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_saldos_iniciais_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_saldos_iniciais_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financeiro_plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_saldos_iniciais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_saldos_iniciais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
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
      juridico_pedidos: {
        Row: {
          aditivo_numero: string | null
          ano: number
          ata_numero: string | null
          categoria: string | null
          contrato_numero: string | null
          created_at: string
          created_by: string
          dados_caso: Json | null
          data_protocolo: string | null
          empresa_id: string
          id: string
          instrumento: string | null
          licitacao_id: string | null
          modelo_id: string | null
          modelo_titulo: string | null
          numero_formatado: string | null
          numero_protocolo: string | null
          orgao_contratante: string | null
          prefixo_numero: string | null
          pregao_numero: string | null
          processo_administrativo: string | null
          retorno_orgao: string | null
          sequencial: number
          status: Database["public"]["Enums"]["juridico_pedido_status"]
          tipo: Database["public"]["Enums"]["juridico_pedido_tipo"]
          updated_at: string
          versao_atual_id: string | null
          versoes_count: number
        }
        Insert: {
          aditivo_numero?: string | null
          ano?: number
          ata_numero?: string | null
          categoria?: string | null
          contrato_numero?: string | null
          created_at?: string
          created_by: string
          dados_caso?: Json | null
          data_protocolo?: string | null
          empresa_id: string
          id?: string
          instrumento?: string | null
          licitacao_id?: string | null
          modelo_id?: string | null
          modelo_titulo?: string | null
          numero_formatado?: string | null
          numero_protocolo?: string | null
          orgao_contratante?: string | null
          prefixo_numero?: string | null
          pregao_numero?: string | null
          processo_administrativo?: string | null
          retorno_orgao?: string | null
          sequencial?: number
          status?: Database["public"]["Enums"]["juridico_pedido_status"]
          tipo: Database["public"]["Enums"]["juridico_pedido_tipo"]
          updated_at?: string
          versao_atual_id?: string | null
          versoes_count?: number
        }
        Update: {
          aditivo_numero?: string | null
          ano?: number
          ata_numero?: string | null
          categoria?: string | null
          contrato_numero?: string | null
          created_at?: string
          created_by?: string
          dados_caso?: Json | null
          data_protocolo?: string | null
          empresa_id?: string
          id?: string
          instrumento?: string | null
          licitacao_id?: string | null
          modelo_id?: string | null
          modelo_titulo?: string | null
          numero_formatado?: string | null
          numero_protocolo?: string | null
          orgao_contratante?: string | null
          prefixo_numero?: string | null
          pregao_numero?: string | null
          processo_administrativo?: string | null
          retorno_orgao?: string | null
          sequencial?: number
          status?: Database["public"]["Enums"]["juridico_pedido_status"]
          tipo?: Database["public"]["Enums"]["juridico_pedido_tipo"]
          updated_at?: string
          versao_atual_id?: string | null
          versoes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "juridico_pedidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "juridico_pedidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_pedidos_historico: {
        Row: {
          autor: string | null
          criado_em: string
          descricao: string | null
          evento: string
          id: string
          pedido_id: string
          status_anterior:
            | Database["public"]["Enums"]["juridico_pedido_status"]
            | null
          status_novo:
            | Database["public"]["Enums"]["juridico_pedido_status"]
            | null
        }
        Insert: {
          autor?: string | null
          criado_em?: string
          descricao?: string | null
          evento: string
          id?: string
          pedido_id: string
          status_anterior?:
            | Database["public"]["Enums"]["juridico_pedido_status"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["juridico_pedido_status"]
            | null
        }
        Update: {
          autor?: string | null
          criado_em?: string
          descricao?: string | null
          evento?: string
          id?: string
          pedido_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["juridico_pedido_status"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["juridico_pedido_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "juridico_pedidos_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "juridico_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_pedidos_versoes: {
        Row: {
          conteudo: string
          gerado_em: string
          gerado_por: string
          id: string
          modelo_ia: string | null
          pedido_id: string
          resumo_alteracao: string | null
          versao: number
        }
        Insert: {
          conteudo: string
          gerado_em?: string
          gerado_por: string
          id?: string
          modelo_ia?: string | null
          pedido_id: string
          resumo_alteracao?: string | null
          versao: number
        }
        Update: {
          conteudo?: string
          gerado_em?: string
          gerado_por?: string
          id?: string
          modelo_ia?: string | null
          pedido_id?: string
          resumo_alteracao?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "juridico_pedidos_versoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "juridico_pedidos"
            referencedColumns: ["id"]
          },
        ]
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
      lgpd_access_log: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          finalidade: string | null
          id: string
          ip_address: string | null
          recurso: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          finalidade?: string | null
          id?: string
          ip_address?: string | null
          recurso: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          finalidade?: string | null
          id?: string
          ip_address?: string | null
          recurso?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lgpd_tratamento_log: {
        Row: {
          base_legal: string
          categoria_dados: string
          created_at: string
          descricao: string | null
          empresa_id: string | null
          finalidade: string
          id: string
          ip_address: string | null
          metadata: Json | null
          modulo: string
          operacao: string
          titular_id: string | null
          titular_tipo: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          base_legal?: string
          categoria_dados: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          finalidade: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          modulo: string
          operacao: string
          titular_id?: string | null
          titular_tipo?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          base_legal?: string
          categoria_dados?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          finalidade?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          modulo?: string
          operacao?: string
          titular_id?: string | null
          titular_tipo?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_tratamento_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_tratamento_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "licitacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
      mural_alerta_log: {
        Row: {
          amostras: Json
          created_at: string
          destinatarios_email: Json
          divergencias: Json
          duplicatas_total: number
          envios_email: Json
          id: string
          janela_minutos: number
          slack: Json
          total_errors: number
          total_eventos: number
          total_warnings: number
        }
        Insert: {
          amostras?: Json
          created_at?: string
          destinatarios_email?: Json
          divergencias?: Json
          duplicatas_total?: number
          envios_email?: Json
          id?: string
          janela_minutos: number
          slack?: Json
          total_errors?: number
          total_eventos?: number
          total_warnings?: number
        }
        Update: {
          amostras?: Json
          created_at?: string
          destinatarios_email?: Json
          divergencias?: Json
          duplicatas_total?: number
          envios_email?: Json
          id?: string
          janela_minutos?: number
          slack?: Json
          total_errors?: number
          total_eventos?: number
          total_warnings?: number
        }
        Relationships: []
      }
      mural_busca_telemetria: {
        Row: {
          chamadas_erro: number
          chamadas_ok: number
          chamadas_total: number
          created_at: string
          divergencias: Json
          duplicatas: number
          duracao_ms: number | null
          filtros: Json
          fonte: string
          id: string
          pagina: number
          severidade: string
          total_filtrado: number
          total_final: number
          total_recebido: number
          total_somado: number
          total_unico: number
          user_id: string | null
        }
        Insert: {
          chamadas_erro?: number
          chamadas_ok?: number
          chamadas_total?: number
          created_at?: string
          divergencias?: Json
          duplicatas?: number
          duracao_ms?: number | null
          filtros?: Json
          fonte: string
          id?: string
          pagina?: number
          severidade?: string
          total_filtrado?: number
          total_final?: number
          total_recebido?: number
          total_somado?: number
          total_unico?: number
          user_id?: string | null
        }
        Update: {
          chamadas_erro?: number
          chamadas_ok?: number
          chamadas_total?: number
          created_at?: string
          divergencias?: Json
          duplicatas?: number
          duracao_ms?: number | null
          filtros?: Json
          fonte?: string
          id?: string
          pagina?: number
          severidade?: string
          total_filtrado?: number
          total_final?: number
          total_recebido?: number
          total_somado?: number
          total_unico?: number
          user_id?: string | null
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
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
      notificacoes_enviadas: {
        Row: {
          agendado_para: string | null
          alerta_ref_id: string | null
          alerta_tipo: string | null
          alerta_titulo: string | null
          canal: string
          created_at: string | null
          destinatario: string | null
          entregue_em: string | null
          enviado_em: string | null
          erro_codigo: string | null
          erro_mensagem: string | null
          id: string
          lido_em: string | null
          max_tentativas: number | null
          push_token: string | null
          resend_id: string | null
          status: string
          tentativas: number | null
          user_id: string
          wamid: string | null
        }
        Insert: {
          agendado_para?: string | null
          alerta_ref_id?: string | null
          alerta_tipo?: string | null
          alerta_titulo?: string | null
          canal: string
          created_at?: string | null
          destinatario?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          lido_em?: string | null
          max_tentativas?: number | null
          push_token?: string | null
          resend_id?: string | null
          status?: string
          tentativas?: number | null
          user_id: string
          wamid?: string | null
        }
        Update: {
          agendado_para?: string | null
          alerta_ref_id?: string | null
          alerta_tipo?: string | null
          alerta_titulo?: string | null
          canal?: string
          created_at?: string | null
          destinatario?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          lido_em?: string | null
          max_tentativas?: number | null
          push_token?: string | null
          resend_id?: string | null
          status?: string
          tentativas?: number | null
          user_id?: string
          wamid?: string | null
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
          {
            foreignKeyName: "nuvem_fiscal_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
          {
            foreignKeyName: "perfis_alerta_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
          embedding: string | null
          embedding_gerado_em: string | null
          embedding_lovable: string | null
          embedding_lovable_gerado_em: string | null
          embedding_lovable_modelo: string | null
          embedding_modelo: string | null
          esfera_id: string | null
          fonte: string | null
          fonte_id: string | null
          hash_objeto: string | null
          id: string
          lei_base: string | null
          link_comprasnet: string | null
          link_sistema_origem: string | null
          modalidade_id: number | null
          modalidade_nome: string | null
          municipio: string | null
          municipio_ibge: string | null
          numero_compra: string | null
          numero_controle_pncp: string | null
          objeto: string | null
          objeto_tsv: unknown
          orgao: string | null
          pncp_id: string
          retificacao: boolean
          sequencial_compra: string | null
          situacao: string | null
          srp: boolean | null
          tipo_instrumento: string | null
          uasg_codigo: string | null
          uasg_nome: string | null
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
          embedding?: string | null
          embedding_gerado_em?: string | null
          embedding_lovable?: string | null
          embedding_lovable_gerado_em?: string | null
          embedding_lovable_modelo?: string | null
          embedding_modelo?: string | null
          esfera_id?: string | null
          fonte?: string | null
          fonte_id?: string | null
          hash_objeto?: string | null
          id?: string
          lei_base?: string | null
          link_comprasnet?: string | null
          link_sistema_origem?: string | null
          modalidade_id?: number | null
          modalidade_nome?: string | null
          municipio?: string | null
          municipio_ibge?: string | null
          numero_compra?: string | null
          numero_controle_pncp?: string | null
          objeto?: string | null
          objeto_tsv?: unknown
          orgao?: string | null
          pncp_id: string
          retificacao?: boolean
          sequencial_compra?: string | null
          situacao?: string | null
          srp?: boolean | null
          tipo_instrumento?: string | null
          uasg_codigo?: string | null
          uasg_nome?: string | null
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
          embedding?: string | null
          embedding_gerado_em?: string | null
          embedding_lovable?: string | null
          embedding_lovable_gerado_em?: string | null
          embedding_lovable_modelo?: string | null
          embedding_modelo?: string | null
          esfera_id?: string | null
          fonte?: string | null
          fonte_id?: string | null
          hash_objeto?: string | null
          id?: string
          lei_base?: string | null
          link_comprasnet?: string | null
          link_sistema_origem?: string | null
          modalidade_id?: number | null
          modalidade_nome?: string | null
          municipio?: string | null
          municipio_ibge?: string | null
          numero_compra?: string | null
          numero_controle_pncp?: string | null
          objeto?: string | null
          objeto_tsv?: unknown
          orgao?: string | null
          pncp_id?: string
          retificacao?: boolean
          sequencial_compra?: string | null
          situacao?: string | null
          srp?: boolean | null
          tipo_instrumento?: string | null
          uasg_codigo?: string | null
          uasg_nome?: string | null
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
      pncp_sync_log: {
        Row: {
          atualizados: number | null
          concluido_em: string | null
          created_at: string | null
          data_consultada: string | null
          data_referencia: string | null
          detalhes: Json | null
          duracao_ms: number | null
          erro: string | null
          erros: number | null
          fonte: string | null
          id: string
          iniciado_em: string | null
          modalidade_id: number | null
          modalidades_processadas: number | null
          modo: string | null
          novos: number | null
          paginas_consumidas: number | null
          segmento: number | null
          status: string | null
          total_registros: number | null
          ufs_processadas: string[] | null
          ufs_processadas_count: number | null
        }
        Insert: {
          atualizados?: number | null
          concluido_em?: string | null
          created_at?: string | null
          data_consultada?: string | null
          data_referencia?: string | null
          detalhes?: Json | null
          duracao_ms?: number | null
          erro?: string | null
          erros?: number | null
          fonte?: string | null
          id?: string
          iniciado_em?: string | null
          modalidade_id?: number | null
          modalidades_processadas?: number | null
          modo?: string | null
          novos?: number | null
          paginas_consumidas?: number | null
          segmento?: number | null
          status?: string | null
          total_registros?: number | null
          ufs_processadas?: string[] | null
          ufs_processadas_count?: number | null
        }
        Update: {
          atualizados?: number | null
          concluido_em?: string | null
          created_at?: string | null
          data_consultada?: string | null
          data_referencia?: string | null
          detalhes?: Json | null
          duracao_ms?: number | null
          erro?: string | null
          erros?: number | null
          fonte?: string | null
          id?: string
          iniciado_em?: string | null
          modalidade_id?: number | null
          modalidades_processadas?: number | null
          modo?: string | null
          novos?: number | null
          paginas_consumidas?: number | null
          segmento?: number | null
          status?: string | null
          total_registros?: number | null
          ufs_processadas?: string[] | null
          ufs_processadas_count?: number | null
        }
        Relationships: []
      }
      portais_monitorados: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          endpoint_api: string | null
          id: string
          intervalo_min: number | null
          nome: string
          status_atual: string | null
          tipo: string
          total_coletados: number | null
          uf: string | null
          ultima_coleta: string | null
          ultimo_erro: string | null
          updated_at: string | null
          url_base: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          endpoint_api?: string | null
          id?: string
          intervalo_min?: number | null
          nome: string
          status_atual?: string | null
          tipo?: string
          total_coletados?: number | null
          uf?: string | null
          ultima_coleta?: string | null
          ultimo_erro?: string | null
          updated_at?: string | null
          url_base: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          endpoint_api?: string | null
          id?: string
          intervalo_min?: number | null
          nome?: string
          status_atual?: string | null
          tipo?: string
          total_coletados?: number | null
          uf?: string | null
          ultima_coleta?: string | null
          ultimo_erro?: string | null
          updated_at?: string | null
          url_base?: string
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
            referencedRelation: "atas_srp_resumo"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "pre_notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
      preferencias_alertas: {
        Row: {
          ativo: boolean | null
          canal_email: boolean | null
          canal_push: boolean | null
          canal_whatsapp: boolean | null
          cnpj: string | null
          created_at: string | null
          email_notificacao: string | null
          frequencia: string | null
          id: string
          razao_social: string | null
          receber_alteracoes: boolean | null
          receber_cancelamentos: boolean | null
          receber_editais: boolean | null
          receber_homologacoes: boolean | null
          receber_suspensoes: boolean | null
          segmentos: string[] | null
          ufs: string[] | null
          updated_at: string | null
          user_id: string
          whatsapp_notificacao: string | null
        }
        Insert: {
          ativo?: boolean | null
          canal_email?: boolean | null
          canal_push?: boolean | null
          canal_whatsapp?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          email_notificacao?: string | null
          frequencia?: string | null
          id?: string
          razao_social?: string | null
          receber_alteracoes?: boolean | null
          receber_cancelamentos?: boolean | null
          receber_editais?: boolean | null
          receber_homologacoes?: boolean | null
          receber_suspensoes?: boolean | null
          segmentos?: string[] | null
          ufs?: string[] | null
          updated_at?: string | null
          user_id: string
          whatsapp_notificacao?: string | null
        }
        Update: {
          ativo?: boolean | null
          canal_email?: boolean | null
          canal_push?: boolean | null
          canal_whatsapp?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          email_notificacao?: string | null
          frequencia?: string | null
          id?: string
          razao_social?: string | null
          receber_alteracoes?: boolean | null
          receber_cancelamentos?: boolean | null
          receber_editais?: boolean | null
          receber_homologacoes?: boolean | null
          receber_suspensoes?: boolean | null
          segmentos?: string[] | null
          ufs?: string[] | null
          updated_at?: string | null
          user_id?: string
          whatsapp_notificacao?: string | null
        }
        Relationships: []
      }
      price_alertas: {
        Row: {
          ativo: boolean | null
          codigo_catmat: string | null
          created_at: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          preco_referencia: number | null
          threshold_alta: number | null
          threshold_queda: number | null
          ultima_notif: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          codigo_catmat?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          preco_referencia?: number | null
          threshold_alta?: number | null
          threshold_queda?: number | null
          ultima_notif?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          codigo_catmat?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          preco_referencia?: number | null
          threshold_alta?: number | null
          threshold_queda?: number | null
          ultima_notif?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      price_historico: {
        Row: {
          codigo_catmat: string | null
          data_coleta: string | null
          descricao: string
          fontes: string[] | null
          id: string
          item_edital_id: string | null
          preco_maximo: number | null
          preco_mediana: number | null
          preco_medio: number | null
          preco_minimo: number | null
          preco_sugerido: number | null
          tendencia: string | null
          total_registros: number | null
          variacao_pct: number | null
        }
        Insert: {
          codigo_catmat?: string | null
          data_coleta?: string | null
          descricao: string
          fontes?: string[] | null
          id?: string
          item_edital_id?: string | null
          preco_maximo?: number | null
          preco_mediana?: number | null
          preco_medio?: number | null
          preco_minimo?: number | null
          preco_sugerido?: number | null
          tendencia?: string | null
          total_registros?: number | null
          variacao_pct?: number | null
        }
        Update: {
          codigo_catmat?: string | null
          data_coleta?: string | null
          descricao?: string
          fontes?: string[] | null
          id?: string
          item_edital_id?: string | null
          preco_maximo?: number | null
          preco_mediana?: number | null
          preco_medio?: number | null
          preco_minimo?: number | null
          preco_sugerido?: number | null
          tendencia?: string | null
          total_registros?: number | null
          variacao_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_historico_item_edital_id_fkey"
            columns: ["item_edital_id"]
            isOneToOne: false
            referencedRelation: "agent_itens_edital"
            referencedColumns: ["id"]
          },
        ]
      }
      price_search_cache: {
        Row: {
          acessos: number | null
          cache_key: string
          codigo_catmat: string | null
          coletado_em: string | null
          descricao: string
          estatisticas: Json
          expira_em: string
          id: string
          resultados: Json
        }
        Insert: {
          acessos?: number | null
          cache_key: string
          codigo_catmat?: string | null
          coletado_em?: string | null
          descricao: string
          estatisticas: Json
          expira_em: string
          id?: string
          resultados: Json
        }
        Update: {
          acessos?: number | null
          cache_key?: string
          codigo_catmat?: string | null
          coletado_em?: string | null
          descricao?: string
          estatisticas?: Json
          expira_em?: string
          id?: string
          resultados?: Json
        }
        Relationships: []
      }
      processo_anexos: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          licitacao_id: string
          metadata: Json | null
          mime_type: string | null
          nome_arquivo: string
          origem: string
          storage_path: string
          tamanho_bytes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          licitacao_id: string
          metadata?: Json | null
          mime_type?: string | null
          nome_arquivo: string
          origem?: string
          storage_path: string
          tamanho_bytes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          licitacao_id?: string
          metadata?: Json | null
          mime_type?: string | null
          nome_arquivo?: string
          origem?: string
          storage_path?: string
          tamanho_bytes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processo_anexos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      processo_documentos: {
        Row: {
          conteudo_html: string | null
          conteudo_json: Json | null
          created_at: string
          id: string
          licitacao_id: string
          metadata: Json | null
          pdf_path: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
          versao: number
        }
        Insert: {
          conteudo_html?: string | null
          conteudo_json?: Json | null
          created_at?: string
          id?: string
          licitacao_id: string
          metadata?: Json | null
          pdf_path?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
          user_id: string
          versao?: number
        }
        Update: {
          conteudo_html?: string | null
          conteudo_json?: Json | null
          created_at?: string
          id?: string
          licitacao_id?: string
          metadata?: Json | null
          pdf_path?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "processo_documentos_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      processo_documentos_versoes: {
        Row: {
          conteudo_html: string | null
          conteudo_json: Json | null
          created_at: string
          documento_id: string
          id: string
          user_id: string
          versao: number
        }
        Insert: {
          conteudo_html?: string | null
          conteudo_json?: Json | null
          created_at?: string
          documento_id: string
          id?: string
          user_id: string
          versao: number
        }
        Update: {
          conteudo_html?: string | null
          conteudo_json?: Json | null
          created_at?: string
          documento_id?: string
          id?: string
          user_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "processo_documentos_versoes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "processo_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_exclusao_log: {
        Row: {
          acao: string
          created_at: string
          empresa_id: string | null
          id: string
          motivo: string
          processo_interesse_id: string | null
          processo_numero: string | null
          processo_objeto: string | null
          processo_orgao: string | null
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          motivo: string
          processo_interesse_id?: string | null
          processo_numero?: string | null
          processo_objeto?: string | null
          processo_orgao?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          motivo?: string
          processo_interesse_id?: string | null
          processo_numero?: string | null
          processo_objeto?: string | null
          processo_orgao?: string | null
          user_id?: string
        }
        Relationships: []
      }
      processos_ingest_status: {
        Row: {
          arquivos_baixados: Json | null
          erro: string | null
          etapa: string | null
          finalizado_em: string | null
          fonte: string | null
          id: string
          iniciado_em: string | null
          licitacao_id: string
          mensagem: string | null
          status: string
          total_itens: number | null
          user_id: string
        }
        Insert: {
          arquivos_baixados?: Json | null
          erro?: string | null
          etapa?: string | null
          finalizado_em?: string | null
          fonte?: string | null
          id?: string
          iniciado_em?: string | null
          licitacao_id: string
          mensagem?: string | null
          status?: string
          total_itens?: number | null
          user_id: string
        }
        Update: {
          arquivos_baixados?: Json | null
          erro?: string | null
          etapa?: string | null
          finalizado_em?: string | null
          fonte?: string | null
          id?: string
          iniciado_em?: string | null
          licitacao_id?: string
          mensagem?: string | null
          status?: string
          total_itens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_ingest_status_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: true
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
            foreignKeyName: "processos_interesse_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
          {
            foreignKeyName: "profiles_empresa_ativa_id_fkey"
            columns: ["empresa_ativa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_belem_processadas: {
        Row: {
          alertas_gerados_count: number
          data_edicao: string
          hash_conteudo: string
          id: string
          numero_edicao: string | null
          orgao: string | null
          processado_em: string
          tipo: string | null
          titulo: string | null
          url_origem: string | null
        }
        Insert: {
          alertas_gerados_count?: number
          data_edicao: string
          hash_conteudo: string
          id?: string
          numero_edicao?: string | null
          orgao?: string | null
          processado_em?: string
          tipo?: string | null
          titulo?: string | null
          url_origem?: string | null
        }
        Update: {
          alertas_gerados_count?: number
          data_edicao?: string
          hash_conteudo?: string
          id?: string
          numero_edicao?: string | null
          orgao?: string | null
          processado_em?: string
          tipo?: string | null
          titulo?: string | null
          url_origem?: string | null
        }
        Relationships: []
      }
      publicacoes_dou_processadas: {
        Row: {
          cnpj_mencionado: string | null
          conteudo_resumo: string | null
          data_publicacao: string | null
          id: string
          identificador: string
          orgao: string | null
          processado_em: string | null
          processo_mencionado: string | null
          tipo_publicacao: string | null
        }
        Insert: {
          cnpj_mencionado?: string | null
          conteudo_resumo?: string | null
          data_publicacao?: string | null
          id?: string
          identificador: string
          orgao?: string | null
          processado_em?: string | null
          processo_mencionado?: string | null
          tipo_publicacao?: string | null
        }
        Update: {
          cnpj_mencionado?: string | null
          conteudo_resumo?: string | null
          data_publicacao?: string | null
          id?: string
          identificador?: string
          orgao?: string | null
          processado_em?: string | null
          processo_mencionado?: string | null
          tipo_publicacao?: string | null
        }
        Relationships: []
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
      sefaz_consultas_log: {
        Row: {
          cnpj: string
          competencia_fim: string | null
          competencia_inicio: string | null
          created_at: string
          detalhes: Json | null
          duracao_ms: number | null
          empresa_id: string
          erro_mensagem: string | null
          id: string
          municipio_codigo: string | null
          notas_duplicadas: number | null
          notas_encontradas: number | null
          notas_importadas: number | null
          status: string
          tipo: string
          user_id: string
        }
        Insert: {
          cnpj: string
          competencia_fim?: string | null
          competencia_inicio?: string | null
          created_at?: string
          detalhes?: Json | null
          duracao_ms?: number | null
          empresa_id: string
          erro_mensagem?: string | null
          id?: string
          municipio_codigo?: string | null
          notas_duplicadas?: number | null
          notas_encontradas?: number | null
          notas_importadas?: number | null
          status: string
          tipo: string
          user_id: string
        }
        Update: {
          cnpj?: string
          competencia_fim?: string | null
          competencia_inicio?: string | null
          created_at?: string
          detalhes?: Json | null
          duracao_ms?: number | null
          empresa_id?: string
          erro_mensagem?: string | null
          id?: string
          municipio_codigo?: string | null
          notas_duplicadas?: number | null
          notas_encontradas?: number | null
          notas_importadas?: number | null
          status?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sefaz_consultas_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sefaz_consultas_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sefaz_homologacoes_municipais: {
        Row: {
          codigo_ibge: string
          created_at: string
          endpoint_homologacao: string | null
          endpoint_producao: string | null
          id: string
          municipio: string
          observacoes: string | null
          padrao_nfse: string
          status: string
          uf: string
          updated_at: string
        }
        Insert: {
          codigo_ibge: string
          created_at?: string
          endpoint_homologacao?: string | null
          endpoint_producao?: string | null
          id?: string
          municipio: string
          observacoes?: string | null
          padrao_nfse: string
          status?: string
          uf: string
          updated_at?: string
        }
        Update: {
          codigo_ibge?: string
          created_at?: string
          endpoint_homologacao?: string | null
          endpoint_producao?: string | null
          id?: string
          municipio?: string
          observacoes?: string | null
          padrao_nfse?: string
          status?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      segmentos_licitacao: {
        Row: {
          ativo: boolean | null
          categoria: string
          codigo: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          palavras_chave: string[] | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          codigo: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          palavras_chave?: string[] | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          palavras_chave?: string[] | null
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
      site_config: {
        Row: {
          chave: string
          id: string
          updated_at: string
          updated_by: string | null
          valor: string
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor?: string
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor?: string
        }
        Relationships: []
      }
      solicitacoes_lgpd: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          prazo_resposta: string
          resposta: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          prazo_resposta?: string
          resposta?: string | null
          status?: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          prazo_resposta?: string
          resposta?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      sugestoes_marca_modelo: {
        Row: {
          aceito_em: string | null
          created_at: string
          data_processo_origem: string | null
          descricao_item: string
          fabricante_sugerido: string | null
          fonte: string
          fonte_detalhe: string | null
          id: string
          justificativa_ia: string | null
          licitacao_id: string
          licitacao_item_id: string | null
          marca_sugerida: string
          modelo_sugerido: string | null
          numero_processo_origem: string | null
          orgao_origem: string | null
          preco_cotacao_atual: number | null
          preco_historico: number | null
          ranking: number | null
          score_confianca: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aceito_em?: string | null
          created_at?: string
          data_processo_origem?: string | null
          descricao_item: string
          fabricante_sugerido?: string | null
          fonte?: string
          fonte_detalhe?: string | null
          id?: string
          justificativa_ia?: string | null
          licitacao_id: string
          licitacao_item_id?: string | null
          marca_sugerida: string
          modelo_sugerido?: string | null
          numero_processo_origem?: string | null
          orgao_origem?: string | null
          preco_cotacao_atual?: number | null
          preco_historico?: number | null
          ranking?: number | null
          score_confianca?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aceito_em?: string | null
          created_at?: string
          data_processo_origem?: string | null
          descricao_item?: string
          fabricante_sugerido?: string | null
          fonte?: string
          fonte_detalhe?: string | null
          id?: string
          justificativa_ia?: string | null
          licitacao_id?: string
          licitacao_item_id?: string | null
          marca_sugerida?: string
          modelo_sugerido?: string | null
          numero_processo_origem?: string | null
          orgao_origem?: string | null
          preco_cotacao_atual?: number | null
          preco_historico?: number | null
          ranking?: number | null
          score_confianca?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugestoes_marca_modelo_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_marca_modelo_licitacao_item_id_fkey"
            columns: ["licitacao_item_id"]
            isOneToOne: false
            referencedRelation: "licitacao_itens"
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
      system_logs: {
        Row: {
          context: string | null
          created_at: string
          error_details: string | null
          id: string
          level: string
          message: string
          module: string
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          error_details?: string | null
          id?: string
          level?: string
          message: string
          module: string
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          error_details?: string | null
          id?: string
          level?: string
          message?: string
          module?: string
          user_id?: string | null
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
            foreignKeyName: "tarefas_colaborador_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
            foreignKeyName: "workflow_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
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
      atas_srp_resumo: {
        Row: {
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string | null
          id: string | null
          numero_ata: string | null
          numero_contrato: string | null
          objeto: string | null
          orgao_contratante: string | null
          permite_carona: boolean | null
          qtd_contratos_derivados: number | null
          qtd_itens: number | null
          status: string | null
          user_id: string | null
          validade_ata_meses: number | null
          valor_consumido_total: number | null
          valor_global: number | null
          valor_global_original: number | null
        }
        Insert: {
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          id?: string | null
          numero_ata?: string | null
          numero_contrato?: string | null
          objeto?: string | null
          orgao_contratante?: string | null
          permite_carona?: boolean | null
          qtd_contratos_derivados?: never
          qtd_itens?: never
          status?: string | null
          user_id?: string | null
          validade_ata_meses?: number | null
          valor_consumido_total?: never
          valor_global?: number | null
          valor_global_original?: number | null
        }
        Update: {
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          id?: string | null
          numero_ata?: string | null
          numero_contrato?: string | null
          objeto?: string | null
          orgao_contratante?: string | null
          permite_carona?: boolean | null
          qtd_contratos_derivados?: never
          qtd_itens?: never
          status?: string | null
          user_id?: string | null
          validade_ata_meses?: number | null
          valor_consumido_total?: never
          valor_global?: number | null
          valor_global_original?: number | null
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
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      credenciais_portais_safe: {
        Row: {
          certificado_nome: string | null
          certificado_path: string | null
          certificado_tipo: string | null
          created_at: string | null
          id: string | null
          login: string | null
          portal_id: string | null
          portal_nome: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          validade_certificado: string | null
        }
        Insert: {
          certificado_nome?: string | null
          certificado_path?: string | null
          certificado_tipo?: string | null
          created_at?: string | null
          id?: string | null
          login?: string | null
          portal_id?: string | null
          portal_nome?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          validade_certificado?: string | null
        }
        Update: {
          certificado_nome?: string | null
          certificado_path?: string | null
          certificado_tipo?: string | null
          created_at?: string | null
          id?: string | null
          login?: string | null
          portal_id?: string | null
          portal_nome?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          validade_certificado?: string | null
        }
        Relationships: []
      }
      empresas_safe: {
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
          cnpj: string | null
          complemento: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          endereco: string | null
          id: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          municipio: string | null
          nome_fantasia: string | null
          razao_social: string | null
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
          updated_at: string | null
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
          cnpj?: string | null
          complemento?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social?: string | null
          regime_tributario?: string | null
          rep_cargo?: string | null
          rep_cpf?: never
          rep_nacionalidade?: string | null
          rep_naturalidade?: string | null
          rep_nome?: string | null
          rep_orgao_expedidor?: string | null
          rep_rg?: never
          rodape_path?: string | null
          rodape_url?: string | null
          telefone?: string | null
          timbrado_path?: string | null
          timbrado_url?: string | null
          uf?: string | null
          updated_at?: string | null
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
          cnpj?: string | null
          complemento?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social?: string | null
          regime_tributario?: string | null
          rep_cargo?: string | null
          rep_cpf?: never
          rep_nacionalidade?: string | null
          rep_naturalidade?: string | null
          rep_nome?: string | null
          rep_orgao_expedidor?: string | null
          rep_rg?: never
          rodape_path?: string | null
          rodape_url?: string | null
          telefone?: string | null
          timbrado_path?: string | null
          timbrado_url?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mv_financeiro_dre_mensal: {
        Row: {
          categoria_id: string | null
          categoria_nome: string | null
          competencia: string | null
          empresa_id: string | null
          grupo_dre: string | null
          natureza: Database["public"]["Enums"]["financeiro_natureza"] | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_financeiro_fluxo_caixa: {
        Row: {
          data: string | null
          empresa_id: string | null
          entradas_previstas: number | null
          entradas_realizadas: number | null
          saidas_previstas: number | null
          saidas_realizadas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      nuvem_fiscal_config_safe: {
        Row: {
          ambiente: string | null
          ativo: boolean | null
          certificado_path: string | null
          certificado_validade: string | null
          created_at: string | null
          empresa_id: string | null
          id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ambiente?: string | null
          ativo?: boolean | null
          certificado_path?: string | null
          certificado_validade?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ambiente?: string | null
          ativo?: boolean | null
          certificado_path?: string | null
          certificado_validade?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nuvem_fiscal_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nuvem_fiscal_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dre_mensal: {
        Row: {
          codigo: string | null
          conta: string | null
          empresa_id: string | null
          mes: string | null
          tipo: string | null
          total: number | null
        }
        Relationships: []
      }
      vw_editais_por_fonte: {
        Row: {
          fonte: string | null
          novos_hoje: number | null
          total: number | null
          ultima_publicacao: string | null
        }
        Relationships: []
      }
      vw_fin_cp_resumo: {
        Row: {
          a_vencer: number | null
          atrasadas: number | null
          empresa_id: string | null
          total_em_aberto: number | null
          vencem_hoje: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_fin_previsto_realizado: {
        Row: {
          empresa_id: string | null
          mes: string | null
          previsto: number | null
          realizado: number | null
          tipo: string | null
        }
        Relationships: []
      }
      vw_fin_saldo_contas: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco_codigo: string | null
          banco_logo_url: string | null
          banco_nome: string | null
          empresa_id: string | null
          id: string | null
          limite_credito: number | null
          nome: string | null
          numero_conta: string | null
          pendentes_conciliacao: number | null
          saldo_atual: number | null
          saldo_inicial: number | null
          tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_fluxo_projetado: {
        Row: {
          data: string | null
          descricao: string | null
          empresa_id: string | null
          tipo: string | null
          valor: number | null
        }
        Relationships: []
      }
      vw_nfe_pendentes_manifesto: {
        Row: {
          alerta_manifesto: string | null
          chave_acesso: string | null
          cnpj_emitente: string | null
          data_emissao: string | null
          dias_sem_manifesto: number | null
          empresa_id: string | null
          nome_emitente: string | null
          numero_nf: string | null
          status_sefaz: string | null
          v_nf: number | null
        }
        Insert: {
          alerta_manifesto?: never
          chave_acesso?: string | null
          cnpj_emitente?: string | null
          data_emissao?: string | null
          dias_sem_manifesto?: never
          empresa_id?: string | null
          nome_emitente?: string | null
          numero_nf?: string | null
          status_sefaz?: string | null
          v_nf?: number | null
        }
        Update: {
          alerta_manifesto?: never
          chave_acesso?: string | null
          cnpj_emitente?: string | null
          data_emissao?: string | null
          dias_sem_manifesto?: never
          empresa_id?: string | null
          nome_emitente?: string | null
          numero_nf?: string | null
          status_sefaz?: string | null
          v_nf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_saldo_contas: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco_codigo: string | null
          banco_nome: string | null
          empresa_id: string | null
          id: string | null
          limite_credito: number | null
          nome: string | null
          numero_conta: string | null
          pendentes_conc: number | null
          saldo_atual: number | null
          saldo_disponivel: number | null
          saldo_inicial: number | null
          tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aplicar_vinculo_ata: {
        Args: {
          p_ata_id?: string
          p_ata_item_id?: string
          p_contrato_id?: string
          p_contrato_item_id?: string
        }
        Returns: Json
      }
      busca_diarios_instantanea: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_fonte?: string
          p_pagina?: number
          p_q?: string
          p_tamanho?: number
          p_tipo?: string
          p_uf?: string
        }
        Returns: {
          data_publicacao: string
          edicao: string
          fonte: string
          id: string
          link_html: string
          link_pdf: string
          modalidade: string
          municipio: string
          numero_processo: string
          objeto: string
          orgao: string
          rank_busca: number
          secao: string
          tipo_publicacao: string
          total_count: number
          uf: string
          valor_estimado: number
        }[]
      }
      busca_editais_instantanea: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_direcao?: string
          p_esfera?: string
          p_modalidade_id?: number
          p_municipio_ibge?: string
          p_ordenacao?: string
          p_pagina?: number
          p_q?: string
          p_segmento?: string
          p_tamanho?: number
          p_uf?: string
        }
        Returns: {
          ano_compra: string
          cnpj_orgao: string
          data_abertura_proposta: string
          data_encerramento_proposta: string
          data_publicacao_pncp: string
          esfera_id: string
          fonte: string
          id: string
          lei_base: string
          link_comprasnet: string
          link_sistema_origem: string
          modalidade_id: number
          modalidade_nome: string
          municipio: string
          municipio_ibge: string
          numero_compra: string
          numero_controle_pncp: string
          objeto: string
          orgao: string
          pncp_id: string
          rank_busca: number
          sequencial_compra: string
          situacao: string
          srp: boolean
          tipo_instrumento: string
          total_count: number
          uf: string
          unidade_orgao: string
          url_pncp: string
          valor_total_estimado: number
        }[]
      }
      busca_editais_semantica: {
        Args: {
          p_apenas_abertos?: boolean
          p_embedding: string
          p_limite?: number
          p_modalidade_id?: number
          p_similaridade_min?: number
          p_uf?: string
        }
        Returns: {
          data_encerramento_proposta: string
          data_publicacao_pncp: string
          id: string
          link_sistema_origem: string
          modalidade_nome: string
          municipio: string
          numero_controle_pncp: string
          objeto: string
          orgao: string
          pncp_id: string
          similaridade: number
          uf: string
          url_pncp: string
          valor_total_estimado: number
        }[]
      }
      busca_editais_semantica_lovable: {
        Args: {
          p_apenas_abertos?: boolean
          p_embedding: string
          p_limite?: number
          p_modalidade_id?: number
          p_similaridade_min?: number
          p_uf?: string
        }
        Returns: {
          data_encerramento_proposta: string
          data_publicacao_pncp: string
          id: string
          link_sistema_origem: string
          modalidade_nome: string
          municipio: string
          numero_controle_pncp: string
          objeto: string
          orgao: string
          pncp_id: string
          similaridade: number
          uf: string
          url_pncp: string
          valor_total_estimado: number
        }[]
      }
      calcular_metricas_agente: {
        Args: { p_empresa_id: string }
        Returns: Json
      }
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
      cleanup_contrato_pedido_dependencias: {
        Args: { _pedido_id: string }
        Returns: undefined
      }
      cleanup_rate_limit_log: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      diarios_status_sincronizacao: { Args: never; Returns: Json }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expurgo_auditoria_5anos: { Args: never; Returns: Json }
      fin_seed_plano_contas_padrao: {
        Args: { p_empresa_id: string }
        Returns: Json
      }
      fin_sync_plano_contas_to_categorias: {
        Args: { p_empresa_id: string }
        Returns: Json
      }
      financeiro_dfc_mensal: {
        Args: { p_empresa_id: string; p_meses?: number }
        Returns: {
          classe: string
          competencia: string
          entradas: number
          liquido: number
          saidas: number
        }[]
      }
      financeiro_realizado_mensal: {
        Args: { p_ano: number; p_empresa_id: string }
        Returns: {
          conta_id: string
          mes: number
          valor_realizado: number
        }[]
      }
      financeiro_recalcular_saldo_conta: {
        Args: { p_conta_id: string }
        Returns: undefined
      }
      financeiro_receita_competencia: {
        Args: { p_competencia: string; p_empresa_id: string }
        Returns: Json
      }
      financeiro_seed_plano_contas_pme: {
        Args: { p_empresa_id: string }
        Returns: Json
      }
      financeiro_validar_balancete_abertura: {
        Args: { p_data_corte: string; p_empresa_id: string }
        Returns: Json
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
      is_member_of_empresa: { Args: { _empresa_id: string }; Returns: boolean }
      match_itens_ata: {
        Args: { p_ata_id: string; p_itens: Json }
        Returns: {
          ata_codigo: string
          ata_descricao: string
          ata_item_id: string
          ata_saldo_qtd: number
          ata_valor_unitario: number
          indice: number
          motivo: string
          similaridade: number
        }[]
      }
      metricas_notificacoes: {
        Args: { p_dias?: number }
        Returns: {
          canal: string
          entregues: number
          enviados: number
          falhos: number
          taxa_entrega: number
          taxa_sucesso: number
          total: number
        }[]
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
      mural_telemetria_painel: { Args: { p_horas?: number }; Returns: Json }
      pncp_editais_pendentes_embedding: {
        Args: { p_limite?: number }
        Returns: {
          id: string
          texto_para_embedding: string
        }[]
      }
      pncp_pendentes_embedding_lovable: {
        Args: { p_limite?: number }
        Returns: {
          id: string
          texto_para_embedding: string
        }[]
      }
      pncp_status_embeddings: { Args: never; Returns: Json }
      pncp_status_embeddings_v2: { Args: never; Returns: Json }
      pncp_status_sincronizacao: { Args: never; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalcular_alertas_aditivos_contrato: {
        Args: { p_contrato_id: string }
        Returns: undefined
      }
      recalcular_saldos_atas_srp: { Args: { p_ata_id?: string }; Returns: Json }
      refresh_financeiro_views: { Args: never; Returns: undefined }
      relatorio_consumo_ata: {
        Args: {
          p_ata_id: string
          p_data_fim?: string
          p_data_inicio?: string
          p_limite_detalhe?: number
          p_offset_detalhe?: number
        }
        Returns: Json
      }
      relatorio_orfaos_ata_srp: {
        Args: { p_ata_id?: string; p_limite?: number }
        Returns: Json
      }
      reprocessar_alertas_aditivos_todos_contratos: {
        Args: never
        Returns: Json
      }
      seed_plano_contas_padrao: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      sincronizar_saldos_contas_sem_movimento: {
        Args: { p_empresa_id: string }
        Returns: number
      }
      try_delete_financeiro_pessoa: {
        Args: { p_motivo?: string; p_pessoa_id: string }
        Returns: Json
      }
      user_has_active_subscription: {
        Args: { _user_id: string }
        Returns: boolean
      }
      vincular_lancamento_a_pedido: {
        Args: {
          p_chave_acesso_nfe: string
          p_contrato_id: string
          p_contrato_item_id: string
          p_data_competencia: string
          p_data_emissao: string
          p_data_pedido: string
          p_data_vencimento: string
          p_descricao: string
          p_natureza: Database["public"]["Enums"]["financeiro_natureza"]
          p_numero_documento: string
          p_numero_pedido: string
          p_observacoes: string
          p_origem_aditivo_id: string
          p_pessoa_id: string
          p_quantidade: number
          p_status: Database["public"]["Enums"]["financeiro_status_lancamento"]
          p_tipo: Database["public"]["Enums"]["financeiro_tipo_lancamento"]
          p_tipo_documento: Database["public"]["Enums"]["financeiro_tipo_documento"]
          p_valor_total: number
          p_valor_unitario: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer"
      empresa_papel: "admin" | "operador" | "viewer"
      financeiro_manifestacao_tipo:
        | "ciencia"
        | "confirmacao"
        | "desconhecimento"
        | "nao_realizada"
      financeiro_natureza: "receita" | "despesa" | "movimentacao"
      financeiro_origem_movimento:
        | "manual"
        | "ofx"
        | "pluggy"
        | "cnab"
        | "dda"
        | "sefaz_nfe"
        | "ocr"
        | "recorrencia"
        | "folha_pagamento"
      financeiro_status_lancamento:
        | "previsto"
        | "realizado"
        | "conciliado"
        | "cancelado"
        | "em_atraso"
      financeiro_status_nfe:
        | "rascunho"
        | "em_processamento"
        | "autorizada"
        | "rejeitada"
        | "cancelada"
        | "denegada"
        | "inutilizada"
        | "contingencia"
      financeiro_tipo_documento:
        | "nfe"
        | "nfse"
        | "nfce"
        | "boleto"
        | "recibo"
        | "contrato"
        | "outro"
        | "cte"
        | "duplicata"
        | "fatura"
        | "pix"
        | "ted"
        | "doc"
        | "darf"
        | "das"
        | "gps"
        | "gnre"
      financeiro_tipo_lancamento:
        | "a_pagar"
        | "a_receber"
        | "movimento_bancario"
        | "transferencia"
      juridico_pedido_status:
        | "rascunho"
        | "em_revisao"
        | "gerado"
        | "assinado"
        | "protocolado"
        | "em_analise"
        | "deferido"
        | "indeferido"
        | "parcialmente_deferido"
      juridico_pedido_tipo: "reajuste" | "repactuacao" | "revisao" | "outros"
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
      financeiro_manifestacao_tipo: [
        "ciencia",
        "confirmacao",
        "desconhecimento",
        "nao_realizada",
      ],
      financeiro_natureza: ["receita", "despesa", "movimentacao"],
      financeiro_origem_movimento: [
        "manual",
        "ofx",
        "pluggy",
        "cnab",
        "dda",
        "sefaz_nfe",
        "ocr",
        "recorrencia",
        "folha_pagamento",
      ],
      financeiro_status_lancamento: [
        "previsto",
        "realizado",
        "conciliado",
        "cancelado",
        "em_atraso",
      ],
      financeiro_status_nfe: [
        "rascunho",
        "em_processamento",
        "autorizada",
        "rejeitada",
        "cancelada",
        "denegada",
        "inutilizada",
        "contingencia",
      ],
      financeiro_tipo_documento: [
        "nfe",
        "nfse",
        "nfce",
        "boleto",
        "recibo",
        "contrato",
        "outro",
        "cte",
        "duplicata",
        "fatura",
        "pix",
        "ted",
        "doc",
        "darf",
        "das",
        "gps",
        "gnre",
      ],
      financeiro_tipo_lancamento: [
        "a_pagar",
        "a_receber",
        "movimento_bancario",
        "transferencia",
      ],
      juridico_pedido_status: [
        "rascunho",
        "em_revisao",
        "gerado",
        "assinado",
        "protocolado",
        "em_analise",
        "deferido",
        "indeferido",
        "parcialmente_deferido",
      ],
      juridico_pedido_tipo: ["reajuste", "repactuacao", "revisao", "outros"],
    },
  },
} as const
