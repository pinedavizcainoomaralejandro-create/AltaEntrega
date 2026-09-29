/**
 * Tipos de la base de datos. La fuente es src/types/supabase.ts, generado con
 * `npm run gen:types` desde el proyecto de Supabase: regenerarlo después de
 * cada migración mantiene estos alias al día sin escribirlos a mano.
 */
import type { Database, Enums, Tables } from "./supabase";

export type { Database };

export type UserRole = Enums<"user_role">;
export type ApprovalStatus = Enums<"approval_status">;
export type OrderStatus = Enums<"order_status">;
export type PaymentMethod = Enums<"payment_method">;

export type UserRow = Tables<"users">;
export type StoreRow = Tables<"stores">;
export type ProductRow = Tables<"products">;
export type CourierRow = Tables<"couriers">;
export type OrderRow = Tables<"orders">;
export type OrderItemRow = Tables<"order_items">;
export type OrderStatusHistoryRow = Tables<"order_status_history">;

/** Fila de get_order_contacts(): contacto del cliente y de la tienda de un pedido. */
export type OrderContacts = Database["public"]["Functions"]["get_order_contacts"]["Returns"][number];
