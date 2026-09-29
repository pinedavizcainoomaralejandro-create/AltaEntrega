import { requireOwnStore } from "@/lib/supabase/current-store";
import ProductManager from "@/components/tienda/ProductManager";

export default async function ProductosPage() {
  const { supabase, store } = await requireOwnStore();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  return <ProductManager products={products ?? []} />;
}
