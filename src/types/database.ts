export type UserRole = "cliente" | "tienda" | "courier" | "admin";
export type ApprovalStatus = "pendiente" | "aprobado" | "rechazado";
export type OrderStatus =
  | "pendiente"
  | "confirmado"
  | "preparando"
  | "en_camino"
  | "entregado"
  | "cancelado";
export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";

export interface UserRow {
  id: string;
  email: string;
  rol: UserRole;
  nombre: string;
  telefono: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreRow {
  id: string;
  user_id: string;
  nombre: string;
  direccion: string;
  categoria: string;
  logo: string | null;
  estado: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  store_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  talla: string | null;
  color: string | null;
  stock: number;
  foto: string | null;
  agotado: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourierRow {
  id: string;
  user_id: string;
  vehiculo: string;
  documento_identidad: string;
  matricula: string;
  estado: ApprovalStatus;
  disponible: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  cliente_id: string;
  store_id: string;
  courier_id: string | null;
  estado: OrderStatus;
  direccion_entrega: string;
  total: number;
  metodo_pago: PaymentMethod;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  cantidad: number;
  precio_unitario: number;
}

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  estado: OrderStatus;
  fecha: string;
}

// NOTA IMPORTANTE: todos los campos Row/Insert/Update de abajo están escritos como
// literales de objeto inline, NUNCA como referencias a las interfaces de arriba
// (ni como Partial<X>/Pick<X,...>). Con esta versión de @supabase/supabase-js,
// referenciar una interface con nombre (o un genérico como Partial<X>) en estos
// campos hace que .insert()/.update() colapse silenciosamente a `never`; con
// objetos literales inline la inferencia funciona correctamente. Las interfaces
// de arriba se usan solo para tipar props/estado en el resto de la app.

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          rol: UserRole;
          nombre: string;
          telefono: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          rol: UserRole;
          nombre: string;
          telefono?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          rol?: UserRole;
          nombre?: string;
          telefono?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          user_id: string;
          nombre: string;
          direccion: string;
          categoria: string;
          logo: string | null;
          estado: ApprovalStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nombre: string;
          direccion: string;
          categoria: string;
          logo?: string | null;
          estado?: ApprovalStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          nombre?: string;
          direccion?: string;
          categoria?: string;
          logo?: string | null;
          estado?: ApprovalStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          nombre: string;
          descripcion: string | null;
          precio: number;
          talla: string | null;
          color: string | null;
          stock: number;
          foto: string | null;
          agotado: boolean;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          nombre: string;
          descripcion?: string | null;
          precio: number;
          talla?: string | null;
          color?: string | null;
          stock?: number;
          foto?: string | null;
          agotado?: boolean;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          nombre?: string;
          descripcion?: string | null;
          precio?: number;
          talla?: string | null;
          color?: string | null;
          stock?: number;
          foto?: string | null;
          agotado?: boolean;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      couriers: {
        Row: {
          id: string;
          user_id: string;
          vehiculo: string;
          documento_identidad: string;
          matricula: string;
          estado: ApprovalStatus;
          disponible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vehiculo: string;
          documento_identidad: string;
          matricula: string;
          estado?: ApprovalStatus;
          disponible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vehiculo?: string;
          documento_identidad?: string;
          matricula?: string;
          estado?: ApprovalStatus;
          disponible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          cliente_id: string;
          store_id: string;
          courier_id: string | null;
          estado: OrderStatus;
          direccion_entrega: string;
          total: number;
          metodo_pago: PaymentMethod;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          store_id: string;
          courier_id?: string | null;
          estado?: OrderStatus;
          direccion_entrega: string;
          total: number;
          metodo_pago: PaymentMethod;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          store_id?: string;
          courier_id?: string | null;
          estado?: OrderStatus;
          direccion_entrega?: string;
          total?: number;
          metodo_pago?: PaymentMethod;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          cantidad: number;
          precio_unitario: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          cantidad: number;
          precio_unitario: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          cantidad?: number;
          precio_unitario?: number;
        };
        Relationships: [];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          estado: OrderStatus;
          fecha: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          estado: OrderStatus;
          fecha?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          estado?: OrderStatus;
          fecha?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      checkout: {
        Args: {
          p_store_id: string;
          p_direccion_entrega: string;
          p_metodo_pago: PaymentMethod;
          p_items: { product_id: string; cantidad: number }[];
        };
        Returns: string;
      };
      claim_order: {
        Args: { p_order_id: string };
        Returns: null;
      };
      advance_order_status: {
        Args: { p_order_id: string };
        Returns: OrderStatus;
      };
    };
    Enums: {
      user_role: UserRole;
      approval_status: ApprovalStatus;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
}
