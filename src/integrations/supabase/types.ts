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
          municipio: string | null
          nome_fantasia: string | null
          razao_social: string
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
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social: string
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
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          uf?: string | null
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
      licitacoes: {
        Row: {
          created_at: string
          data_abertura: string | null
          data_encerramento: string | null
          id: string
          modalidade: string
          municipio: string | null
          numero: string
          objeto: string
          observacoes: string | null
          orgao: string
          portal: string | null
          status: string
          uf: string | null
          updated_at: string
          url_edital: string | null
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          id?: string
          modalidade?: string
          municipio?: string | null
          numero: string
          objeto: string
          observacoes?: string | null
          orgao: string
          portal?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
          url_edital?: string | null
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          id?: string
          modalidade?: string
          municipio?: string | null
          numero?: string
          objeto?: string
          observacoes?: string | null
          orgao?: string
          portal?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
          url_edital?: string | null
          user_id?: string
          valor_estimado?: number | null
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
