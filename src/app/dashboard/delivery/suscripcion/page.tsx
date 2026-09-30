import Link from "next/link";
import SubscriptionPanel from "@/components/suscripcion/SubscriptionPanel";

export default function SuscripcionDeliveryPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/delivery" className="link w-fit text-sm">
        ← Mis entregas
      </Link>
      <SubscriptionPanel tipo="courier" />
    </div>
  );
}
