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
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          line1: string
          user_id: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          line1: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          line1?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          qty: number
          size: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          qty: number
          size: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          qty?: number
          size?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          blurb: string
          featured: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          blurb?: string
          featured?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          blurb?: string
          featured?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          code: string
          id: string
          name: string
          order_id: string
          product_id: string | null
          qty: number
          size: string
          unit_price: number
        }
        Insert: {
          code: string
          id?: string
          name: string
          order_id: string
          product_id?: string | null
          qty: number
          size: string
          unit_price: number
        }
        Update: {
          code?: string
          id?: string
          name?: string
          order_id?: string
          product_id?: string | null
          qty?: number
          size?: string
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
          address: string
          city: string
          country: string
          created_at: string
          email: string
          full_name: string
          id: string
          invoice_last_error: string | null
          invoice_sent_at: string | null
          notes: string | null
          shipping_cost: number
          shipping_method: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          address: string
          city: string
          country: string
          created_at?: string
          email: string
          full_name: string
          id: string
          invoice_last_error?: string | null
          invoice_sent_at?: string | null
          notes?: string | null
          shipping_cost?: number
          shipping_method: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invoice_last_error?: string | null
          invoice_sent_at?: string | null
          notes?: string | null
          shipping_cost?: number
          shipping_method?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_ref: string
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          id: string
          order_id: string | null
          paid_at: string | null
          payload: Json | null
          product_code: string
          provider: string
          raw_verify: string | null
          status: string
          trans_ref: string | null
          trans_token: string | null
          updated_at: string
          user_id: string | null
          verify_result: string | null
        }
        Insert: {
          amount: number
          company_ref: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payload?: Json | null
          product_code: string
          provider?: string
          raw_verify?: string | null
          status?: string
          trans_ref?: string | null
          trans_token?: string | null
          updated_at?: string
          user_id?: string | null
          verify_result?: string | null
        }
        Update: {
          amount?: number
          company_ref?: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payload?: Json | null
          product_code?: string
          provider?: string
          raw_verify?: string | null
          status?: string
          trans_ref?: string | null
          trans_token?: string | null
          updated_at?: string
          user_id?: string | null
          verify_result?: string | null
        }
        Relationships: []
      }
      product_sizes: {
        Row: {
          id: string
          product_id: string
          size: string
          stock: number
        }
        Insert: {
          id?: string
          product_id: string
          size: string
          stock?: number
        }
        Update: {
          id?: string
          product_id?: string
          size?: string
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: Database["public"]["Enums"]["product_badge"] | null
          category_slug: string
          code: string
          created_at: string
          currency: string
          display_name: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          image_url: string
          images: string[]
          item: string
          name: string
          price: number
          sheet_category: string | null
          stock_qty: number
          subcategory: string
          title: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          badge?: Database["public"]["Enums"]["product_badge"] | null
          category_slug: string
          code: string
          created_at?: string
          currency?: string
          display_name: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          image_url: string
          images?: string[]
          item: string
          name: string
          price: number
          sheet_category?: string | null
          stock_qty?: number
          subcategory: string
          title: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          badge?: Database["public"]["Enums"]["product_badge"] | null
          category_slug?: string
          code?: string
          created_at?: string
          currency?: string
          display_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          image_url?: string
          images?: string[]
          item?: string
          name?: string
          price?: number
          sheet_category?: string | null
          stock_qty?: number
          subcategory?: string
          title?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      shipping_methods: {
        Row: {
          cost: number
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          cost?: number
          id: string
          name: string
          sort_order?: number
        }
        Update: {
          cost?: number
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      teamwear_quotes: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          notes: string
          organisation: string
          players: string
          sizes: string
          sport: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string
          organisation?: string
          players?: string
          sizes?: string
          sport?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          organisation?: string
          players?: string
          sizes?: string
          sport?: string
          status?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          hero_body: string
          hero_title: string
          id: number
          spotlight_codes: string[]
          tagline: string
          updated_at: string
        }
        Insert: {
          hero_body?: string
          hero_title?: string
          id?: number
          spotlight_codes?: string[]
          tagline?: string
          updated_at?: string
        }
        Update: {
          hero_body?: string
          hero_title?: string
          id?: number
          spotlight_codes?: string[]
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      place_order: {
        Args: {
          p_address: string
          p_city: string
          p_country: string
          p_email: string
          p_lines: Json
          p_name: string
          p_notes: string
          p_shipping_method: string
        }
        Returns: Json
      }
      promote_admin: { Args: { p_email: string }; Returns: undefined }
      set_order_status: {
        Args: {
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          address: string
          city: string
          country: string
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          shipping_cost: number
          shipping_method: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
      }
    }
    Enums: {
      app_role: "customer" | "admin"
      gender: "men" | "women" | "kids" | "unisex"
      order_status: "reserved" | "preparing" | "shipped" | "cancelled"
      product_badge: "new" | "offer"
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

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "admin"],
      gender: ["men", "women", "kids", "unisex"],
      order_status: ["reserved", "preparing", "shipped", "cancelled"],
      product_badge: ["new", "offer"],
    },
  },
} as const
