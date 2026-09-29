-- Nuevo estado inicial para el cobro en línea: el pedido se crea
-- "esperando_pago" y pasa a "pendiente" cuando la pasarela confirma el pago.
-- Va en su propia migración porque Postgres no permite usar un valor de enum
-- nuevo en la misma transacción en que se agrega.
alter type public.order_status add value if not exists 'esperando_pago' before 'pendiente';
