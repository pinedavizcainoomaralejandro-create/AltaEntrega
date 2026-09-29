import Image from "next/image";
import { CATEGORIAS } from "@/lib/categories";

/** Selector visual del tipo de negocio (radios con la ilustración de cada categoría). */
export default function CategoryPicker({ defaultValue }: { defaultValue?: string }) {
  return (
    <fieldset>
      <legend className="label">¿Qué tipo de negocio es?</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORIAS.map((c) => (
          <label
            key={c.slug}
            className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-stone-300 bg-white text-center text-xs font-semibold text-stone-700 transition hover:border-monte-400 has-[:checked]:border-monte-600 has-[:checked]:ring-4 has-[:checked]:ring-monte-500/15"
          >
            <input type="radio" name="categoria" value={c.slug} required defaultChecked={defaultValue === c.slug} className="sr-only" />
            <span className="relative h-16 bg-arena-100">
              <Image src={c.ilustracion} alt="" fill unoptimized className="object-cover" />
            </span>
            <span className="px-1 py-2 group-has-[:checked]:bg-monte-700 group-has-[:checked]:text-white">{c.nombre}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
