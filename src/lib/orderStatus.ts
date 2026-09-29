import type { OrderStatus } from "@/types/database";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: "Pedido recibido",
  confirmado: "Confirmado por la tienda",
  preparando: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
