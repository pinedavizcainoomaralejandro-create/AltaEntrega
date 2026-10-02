import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePushRequest } from "@/lib/push/messages";
import { sendPush } from "@/lib/push/send";

// La llama la base de datos (private.send_push, con pg_net) cuando hay que
// avisar a alguien. El secreto compartido es el mismo de private.push_config.
function authorized(request: Request) {
  const expected = process.env.PUSH_WEBHOOK_SECRET;
  const received = request.headers.get("x-push-secret");
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const push = parsePushRequest(await request.json().catch(() => null));
  if (!push) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const { tokens, ...content } = push;
  const result = await sendPush(tokens, content);

  // Tokens de apps desinstaladas: se borran para no reintentar con ellos.
  if (result.invalidTokens.length) {
    try {
      await createAdminClient().from("push_tokens").delete().in("token", result.invalidTokens);
    } catch (error) {
      console.error("[push] No se pudieron borrar tokens inválidos", error);
    }
  }

  return NextResponse.json({ sent: result.sent, failed: result.failed });
}
