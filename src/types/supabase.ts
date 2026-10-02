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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      couriers: {
        Row: {
          created_at: string
          disponible: boolean
          documento_identidad: string
          estado: Database["public"]["Enums"]["approval_status"]
          id: string
          matricula: string
          updated_at: string
          user_id: string
          vehiculo: string
        }
        Insert: {
          created_at?: string
          disponible?: boolean
          documento_identidad: string
          estado?: Database["public"]["Enums"]["approval_status"]
          id?: string
          matricula: string
          updated_at?: string
          user_id: string
          vehiculo: string
        }
        Update: {
          created_at?: string
          disponible?: boolean
          documento_identidad?: string
          estado?: Database["public"]["Enums"]["approval_status"]
          id?: string
          matricula?: string
          updated_at?: string
          user_id?: string
          vehiculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "couriers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          created_at: string
          cuenta: string
          id: string
          monto: number
          order_id: string | null
          referencia: string | null
          store_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          cuenta: string
          id?: string
          monto: number
          order_id?: string | null
          referencia?: string | null
          store_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          cuenta?: string
          id?: string
          monto?: number
          order_id?: string | null
          referencia?: string | null
          store_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cantidad: number
          id: string
          nombre: string
          order_id: string
          precio_unitario: number
          product_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          nombre: string
          order_id: string
          precio_unitario: number
          product_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          nombre?: string
          order_id?: string
          precio_unitario?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_settlements: {
        Row: {
          comision: number
          courier_pagado_at: string | null
          created_at: string
          monto_delivery: number
          monto_tienda: number
          order_id: string
          store_id: string
          tienda_pagado_at: string | null
        }
        Insert: {
          comision: number
          courier_pagado_at?: string | null
          created_at?: string
          monto_delivery: number
          monto_tienda: number
          order_id: string
          store_id: string
          tienda_pagado_at?: string | null
        }
        Update: {
          comision?: number
          courier_pagado_at?: string | null
          created_at?: string
          monto_delivery?: number
          monto_tienda?: number
          order_id?: string
          store_id?: string
          tienda_pagado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_settlements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          estado: Database["public"]["Enums"]["order_status"]
          fecha: string
          id: string
          order_id: string
        }
        Insert: {
          estado: Database["public"]["Enums"]["order_status"]
          fecha?: string
          id?: string
          order_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["order_status"]
          fecha?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cliente_id: string | null
          codigo: string
          comprobante_path: string | null
          courier_id: string | null
          created_at: string
          delivery_fee: number
          direccion_entrega: string
          estado: Database["public"]["Enums"]["order_status"]
          estado_pago: string
          id: string
          metodo_pago: Database["public"]["Enums"]["payment_method"]
          numero: number
          pagado_at: string | null
          pago_autorizacion: string | null
          pago_motivo_rechazo: string | null
          pago_referencia: string | null
          reembolsado_at: string | null
          reembolso_referencia: string | null
          store_id: string
          subtotal: number
          tienda_direccion: string
          tienda_nombre: string
          total: number
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          codigo?: string
          comprobante_path?: string | null
          courier_id?: string | null
          created_at?: string
          delivery_fee?: number
          direccion_entrega: string
          estado?: Database["public"]["Enums"]["order_status"]
          estado_pago?: string
          id?: string
          metodo_pago: Database["public"]["Enums"]["payment_method"]
          numero?: never
          pagado_at?: string | null
          pago_autorizacion?: string | null
          pago_motivo_rechazo?: string | null
          pago_referencia?: string | null
          reembolsado_at?: string | null
          reembolso_referencia?: string | null
          store_id: string
          subtotal: number
          tienda_direccion: string
          tienda_nombre: string
          total: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          codigo?: string
          comprobante_path?: string | null
          courier_id?: string | null
          created_at?: string
          delivery_fee?: number
          direccion_entrega?: string
          estado?: Database["public"]["Enums"]["order_status"]
          estado_pago?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["payment_method"]
          numero?: never
          pagado_at?: string | null
          pago_autorizacion?: string | null
          pago_motivo_rechazo?: string | null
          pago_referencia?: string | null
          reembolsado_at?: string | null
          reembolso_referencia?: string | null
          store_id?: string
          subtotal?: number
          tienda_direccion?: string
          tienda_nombre?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          completado_at: string | null
          created_at: string
          cuenta: Json | null
          destino: string
          error: string | null
          estado: string
          id: string
          monto: number
          order_id: string
          proveedor: string
          referencia: string | null
          store_id: string | null
        }
        Insert: {
          completado_at?: string | null
          created_at?: string
          cuenta?: Json | null
          destino: string
          error?: string | null
          estado?: string
          id?: string
          monto: number
          order_id: string
          proveedor?: string
          referencia?: string | null
          store_id?: string | null
        }
        Update: {
          completado_at?: string | null
          created_at?: string
          cuenta?: Json | null
          destino?: string
          error?: string | null
          estado?: string
          id?: string
          monto?: number
          order_id?: string
          proveedor?: string
          referencia?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          commission_rate: number
          delivery_fee: number
          descuento_anual: number
          dias_gracia: number
          dias_prueba: number
          fase: string
          ganancias_banco: string | null
          ganancias_documento: string | null
          ganancias_numero_cuenta: string | null
          ganancias_tipo_cuenta: string | null
          ganancias_titular: string | null
          horas_para_transferir: number
          id: boolean
          precio_delivery_mensual: number
          precio_negocio_mensual: number
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          delivery_fee?: number
          descuento_anual?: number
          dias_gracia?: number
          dias_prueba?: number
          fase?: string
          ganancias_banco?: string | null
          ganancias_documento?: string | null
          ganancias_numero_cuenta?: string | null
          ganancias_tipo_cuenta?: string | null
          ganancias_titular?: string | null
          horas_para_transferir?: number
          id?: boolean
          precio_delivery_mensual?: number
          precio_negocio_mensual?: number
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          delivery_fee?: number
          descuento_anual?: number
          dias_gracia?: number
          dias_prueba?: number
          fase?: string
          ganancias_banco?: string | null
          ganancias_documento?: string | null
          ganancias_numero_cuenta?: string | null
          ganancias_tipo_cuenta?: string | null
          ganancias_titular?: string | null
          horas_para_transferir?: number
          id?: boolean
          precio_delivery_mensual?: number
          precio_negocio_mensual?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          activo: boolean
          agotado: boolean
          color: string | null
          created_at: string
          descripcion: string | null
          foto: string | null
          id: string
          nombre: string
          precio: number
          stock: number
          store_id: string
          talla: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          agotado?: boolean
          color?: string | null
          created_at?: string
          descripcion?: string | null
          foto?: string | null
          id?: string
          nombre: string
          precio: number
          stock?: number
          store_id: string
          talla?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          agotado?: boolean
          color?: string | null
          created_at?: string
          descripcion?: string | null
          foto?: string | null
          id?: string
          nombre?: string
          precio?: number
          stock?: number
          store_id?: string
          talla?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payout_accounts: {
        Row: {
          banco: string
          documento: string
          numero_cuenta: string
          store_id: string
          tipo_cuenta: string
          titular: string
          updated_at: string
        }
        Insert: {
          banco: string
          documento: string
          numero_cuenta: string
          store_id: string
          tipo_cuenta: string
          titular: string
          updated_at?: string
        }
        Update: {
          banco?: string
          documento?: string
          numero_cuenta?: string
          store_id?: string
          tipo_cuenta?: string
          titular?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payout_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          categoria: string
          created_at: string
          direccion: string
          eliminada_at: string | null
          estado: Database["public"]["Enums"]["approval_status"]
          id: string
          logo: string | null
          nombre: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          direccion: string
          eliminada_at?: string | null
          estado?: Database["public"]["Enums"]["approval_status"]
          id?: string
          logo?: string | null
          nombre: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          direccion?: string
          eliminada_at?: string | null
          estado?: Database["public"]["Enums"]["approval_status"]
          id?: string
          logo?: string | null
          nombre?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          comprobante_path: string
          created_at: string
          estado: string
          id: string
          monto: number
          motivo_rechazo: string | null
          plan: string
          referencia: string
          revisado_at: string | null
          subscription_id: string | null
        }
        Insert: {
          comprobante_path: string
          created_at?: string
          estado?: string
          id?: string
          monto: number
          motivo_rechazo?: string | null
          plan: string
          referencia: string
          revisado_at?: string | null
          subscription_id?: string | null
        }
        Update: {
          comprobante_path?: string
          created_at?: string
          estado?: string
          id?: string
          monto?: number
          motivo_rechazo?: string | null
          plan?: string
          referencia?: string
          revisado_at?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          courier_id: string | null
          created_at: string
          id: string
          plan: string
          store_id: string | null
          updated_at: string
          vigente_hasta: string
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          id?: string
          plan?: string
          store_id?: string | null
          updated_at?: string
          vigente_hasta: string
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          id?: string
          plan?: string
          store_id?: string | null
          updated_at?: string
          vigente_hasta?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: true
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_path: string | null
          created_at: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["user_role"]
          telefono: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["user_role"]
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["user_role"]
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      catalog_products: {
        Row: {
          activo: boolean | null
          agotado: boolean | null
          color: string | null
          descripcion: string | null
          foto: string | null
          id: string | null
          nombre: string | null
          precio: number | null
          stock: number | null
          store_id: string | null
          talla: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      account_deletion_blocker: { Args: never; Returns: string }
      advance_order_status: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      checkout: {
        Args: { p_direccion_entrega: string; p_items: Json; p_store_id: string }
        Returns: string
      }
      claim_order: { Args: { p_order_id: string }; Returns: undefined }
      confirm_payment: {
        Args: {
          p_autorizacion: string
          p_monto_centavos: number
          p_order_id: string
          p_referencia: string
        }
        Returns: string
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_my_account: { Args: never; Returns: undefined }
      expire_unpaid_orders: { Args: never; Returns: undefined }
      fail_payment: {
        Args: { p_estado_pago: string; p_order_id: string }
        Returns: undefined
      }
      get_delivery_fee: { Args: never; Returns: number }
      get_order_contacts: {
        Args: { p_order_id: string }
        Returns: {
          cliente_nombre: string
          cliente_telefono: string
          tienda_direccion: string
          tienda_nombre: string
          tienda_telefono: string
        }[]
      }
      get_order_payment_account: { Args: { p_order_id: string }; Returns: Json }
      get_public_config: { Args: never; Returns: Json }
      get_subscription_offer: { Args: never; Returns: Json }
      mark_refunded: { Args: { p_order_id: string }; Returns: undefined }
      owns_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      payout_destination: {
        Args: { p_destino: string; p_store_id: string }
        Returns: Json
      }
      restore_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      review_subscription_payment: {
        Args: { p_aprobar: boolean; p_motivo?: string; p_payment_id: string }
        Returns: undefined
      }
      store_advance_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      store_mark_refunded: {
        Args: { p_order_id: string; p_referencia: string }
        Returns: undefined
      }
      store_review_transfer: {
        Args: { p_aprobar: boolean; p_motivo?: string; p_order_id: string }
        Returns: undefined
      }
      submit_order_transfer: {
        Args: {
          p_comprobante_path: string
          p_order_id: string
          p_referencia: string
        }
        Returns: undefined
      }
      submit_subscription_payment: {
        Args: {
          p_comprobante_path: string
          p_plan: string
          p_referencia: string
        }
        Returns: string
      }
      subscription_ok: {
        Args: { p_courier_id: string; p_store_id: string }
        Returns: boolean
      }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
      update_payout: {
        Args: {
          p_error?: string
          p_estado: string
          p_payout_id: string
          p_referencia?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      approval_status: "pendiente" | "aprobado" | "rechazado"
      order_status:
        | "esperando_pago"
        | "pendiente"
        | "confirmado"
        | "preparando"
        | "en_camino"
        | "entregado"
        | "cancelado"
      payment_method: "efectivo" | "tarjeta" | "transferencia"
      user_role: "cliente" | "tienda" | "courier" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      approval_status: ["pendiente", "aprobado", "rechazado"],
      order_status: [
        "esperando_pago",
        "pendiente",
        "confirmado",
        "preparando",
        "en_camino",
        "entregado",
        "cancelado",
      ],
      payment_method: ["efectivo", "tarjeta", "transferencia"],
      user_role: ["cliente", "tienda", "courier", "admin"],
    },
  },
} as const
