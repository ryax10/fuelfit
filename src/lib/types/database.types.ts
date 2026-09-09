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
      balance_snapshots: {
        Row: {
          active_products: number
          cash_ars: number
          cash_usd: number
          cash_usdt: number
          created_at: string
          fx_usdt_ars: number
          id: string
          in_transit_value_usd: number
          inventory_cost_usd: number
          inventory_value_ars: number
          notes: string
          patrimonio_neto_usd: number
          payable_ars: number
          payable_usd: number
          period: string
          receivable_ars: number
          receivable_usd: number
          snapshot_date: string
          stock_value_usd: number
          total_expenses_ars: number
          total_expenses_usd: number
          total_purchases_usd: number
          total_sales_ars: number
          total_sales_usd: number
          total_stock: number
        }
        Insert: {
          active_products?: number
          cash_ars?: number
          cash_usd?: number
          cash_usdt?: number
          created_at?: string
          fx_usdt_ars?: number
          id?: string
          in_transit_value_usd?: number
          inventory_cost_usd?: number
          inventory_value_ars?: number
          notes?: string
          patrimonio_neto_usd?: number
          payable_ars?: number
          payable_usd?: number
          period: string
          receivable_ars?: number
          receivable_usd?: number
          snapshot_date?: string
          stock_value_usd?: number
          total_expenses_ars?: number
          total_expenses_usd?: number
          total_purchases_usd?: number
          total_sales_ars?: number
          total_sales_usd?: number
          total_stock?: number
        }
        Update: {
          active_products?: number
          cash_ars?: number
          cash_usd?: number
          cash_usdt?: number
          created_at?: string
          fx_usdt_ars?: number
          id?: string
          in_transit_value_usd?: number
          inventory_cost_usd?: number
          inventory_value_ars?: number
          notes?: string
          patrimonio_neto_usd?: number
          payable_ars?: number
          payable_usd?: number
          period?: string
          receivable_ars?: number
          receivable_usd?: number
          snapshot_date?: string
          stock_value_usd?: number
          total_expenses_ars?: number
          total_expenses_usd?: number
          total_purchases_usd?: number
          total_sales_ars?: number
          total_sales_usd?: number
          total_stock?: number
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          caja: string
          category: string
          created_at: string
          currency: string
          id: string
          note: string
          order_id: string | null
          type: string
        }
        Insert: {
          amount: number
          caja: string
          category?: string
          created_at?: string
          currency?: string
          id?: string
          note?: string
          order_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          caja?: string
          category?: string
          created_at?: string
          currency?: string
          id?: string
          note?: string
          order_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string
          code: string
          created_at: string
          duplicate_names: string[]
          has_duplicate_warning: boolean
          id: string
          last_purchase: string | null
          name: string
          notes: string
          password: string | null
          phone: string
          previous_purchase: string | null
          status: string
          total_orders: number
          type: string
          zone: string
        }
        Insert: {
          address?: string
          code?: string
          created_at?: string
          duplicate_names?: string[]
          has_duplicate_warning?: boolean
          id?: string
          last_purchase?: string | null
          name: string
          notes?: string
          password?: string | null
          phone: string
          previous_purchase?: string | null
          status?: string
          total_orders?: number
          type?: string
          zone?: string
        }
        Update: {
          address?: string
          code?: string
          created_at?: string
          duplicate_names?: string[]
          has_duplicate_warning?: boolean
          id?: string
          last_purchase?: string | null
          name?: string
          notes?: string
          password?: string | null
          phone?: string
          previous_purchase?: string | null
          status?: string
          total_orders?: number
          type?: string
          zone?: string
        }
        Relationships: []
      }
      daily_fx: {
        Row: {
          buy_price: number
          created_at: string
          date: string
          id: string
          sell_price: number
        }
        Insert: {
          buy_price: number
          created_at?: string
          date: string
          id?: string
          sell_price?: number
        }
        Update: {
          buy_price?: number
          created_at?: string
          date?: string
          id?: string
          sell_price?: number
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          caja: string
          created_at: string
          currency: string
          debt_id: string
          id: string
          note: string
        }
        Insert: {
          amount: number
          caja: string
          created_at?: string
          currency?: string
          debt_id: string
          id?: string
          note?: string
        }
        Update: {
          amount?: number
          caja?: string
          created_at?: string
          currency?: string
          debt_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          currency: string
          entity_id: string | null
          entity_name: string
          entity_type: string
          id: string
          note: string
          order_id: string | null
          original_amount: number
          paid_amount: number
          purchase_id: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          currency?: string
          entity_id?: string | null
          entity_name: string
          entity_type?: string
          id?: string
          note?: string
          order_id?: string | null
          original_amount?: number
          paid_amount?: number
          purchase_id?: string | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          currency?: string
          entity_id?: string | null
          entity_name?: string
          entity_type?: string
          id?: string
          note?: string
          order_id?: string | null
          original_amount?: number
          paid_amount?: number
          purchase_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          note: string
          order_id: string | null
          product_id: string
          product_sku: string
          purchase_id: string | null
          qty: number
          type: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string
          order_id?: string | null
          product_id: string
          product_sku: string
          purchase_id?: string | null
          qty: number
          type: string
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          order_id?: string | null
          product_id?: string
          product_sku?: string
          purchase_id?: string | null
          qty?: number
          type?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          product_sku: string
          qty: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_name: string
          product_sku: string
          qty: number
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          product_sku?: string
          qty?: number
          subtotal?: number
          unit_price?: number
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
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          confirmed_at: string | null
          created_at: string
          customer_address: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          id: string
          notes: string
          number: number
          payment_method: string | null
          payment_status: string
          status: string
          total: number
          type: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          customer_address?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string
          number?: number
          payment_method?: string | null
          payment_status?: string
          status?: string
          total?: number
          type?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          customer_address?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string
          number?: number
          payment_method?: string | null
          payment_status?: string
          status?: string
          total?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string
          category: string
          cost_price: number
          created_at: string
          flavor: string
          id: string
          image: string
          model: string
          name: string
          price_may_x100: number
          price_may_x15: number
          price_may_x50: number
          price_min_ars: number
          sku: string
          slug: string
          stock_actual: number
          stock_reservado: number
          units_per_pack: number
          visible: boolean
        }
        Insert: {
          brand: string
          category?: string
          cost_price?: number
          created_at?: string
          flavor?: string
          id?: string
          image?: string
          model?: string
          name: string
          price_may_x100?: number
          price_may_x15?: number
          price_may_x50?: number
          price_min_ars?: number
          sku: string
          slug: string
          stock_actual?: number
          stock_reservado?: number
          units_per_pack?: number
          visible?: boolean
        }
        Update: {
          brand?: string
          category?: string
          cost_price?: number
          created_at?: string
          flavor?: string
          id?: string
          image?: string
          model?: string
          name?: string
          price_may_x100?: number
          price_may_x15?: number
          price_may_x50?: number
          price_min_ars?: number
          sku?: string
          slug?: string
          stock_actual?: number
          stock_reservado?: number
          units_per_pack?: number
          visible?: boolean
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          id: string
          product_id: string
          product_name: string
          product_sku: string
          purchase_id: string
          qty: number
          subtotal: number
          unit_cost: number
        }
        Insert: {
          id?: string
          product_id: string
          product_name: string
          product_sku: string
          purchase_id: string
          qty: number
          subtotal: number
          unit_cost: number
        }
        Update: {
          id?: string
          product_id?: string
          product_name?: string
          product_sku?: string
          purchase_id?: string
          qty?: number
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          currency: string
          id: string
          note: string
          number: number
          paid_amount: number
          payment_status: string
          supplier: string
          total: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          note?: string
          number?: number
          paid_amount?: number
          payment_status?: string
          supplier: string
          total?: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          note?: string
          number?: number
          paid_amount?: number
          payment_status?: string
          supplier?: string
          total?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
