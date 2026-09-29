import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAzulResponse } from "@/lib/payments/azul";
import { recordApprovedPayment, recordFailedPayment } from "@/lib/payments/record";

// AZUL devuelve al cliente aquí después de pagar (ApprovedUrl / DeclinedUrl /
// CancelUrl). El resultado solo se acepta si la firma AuthHash es válida.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const orderId = searchParams.get("pedido") ?? "";
  const resultado = searchParams.get("resultado");
  const back = (pago: string) => NextResponse.redirect(`${origin}/pedidos/${orderId}?pago=${pago}`);

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.redirect(`${origin}/pedidos`);
  }

  try {
    // Cancelar en AZUL no trae firma: solo lo aceptamos del dueño del pedido.
    if (resultado === "cancelado") {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: order } = user
        ? await supabase.from("orders").select("id").eq("id", orderId).eq("cliente_id", user.id).maybeSingle()
        : { data: null };
      if (order) await recordFailedPayment(orderId);
      return back("cancelado");
    }

    const result = verifyAzulResponse(searchParams);
    if (!result) {
      console.error("AZUL: respuesta con firma inválida", Object.fromEntries(searchParams));
      return back("error");
    }

    // El número de orden firmado tiene que ser el de este pedido.
    const admin = createAdminClient();
    const { data: order } = await admin.from("orders").select("id, numero").eq("id", orderId).maybeSingle();
    if (!order || String(order.numero) !== result.orderNumber) {
      console.error("AZUL: el número de orden no coincide", { orderId, orderNumber: result.orderNumber });
      return back("error");
    }

    if (!result.approved) {
      await recordFailedPayment(orderId);
      return back("rechazado");
    }

    const estado = await recordApprovedPayment({
      orderId,
      amountCentavos: result.amountCentavos,
      authorizationCode: result.authorizationCode,
      reference: result.rrn,
    });
    return back(estado === "pagado" ? "aprobado" : "reembolso");
  } catch (error) {
    console.error("AZUL: error al registrar el pago", error);
    return back("error");
  }
}
