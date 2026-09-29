/**
 * Tipos de negocio de AltaEntrega. El slug se guarda en stores.categoria
 * (la base solo acepta estos valores, ver migración 20260930000005).
 */
export const CATEGORIAS = [
  {
    slug: "restaurante",
    nombre: "Restaurante",
    plural: "Restaurantes",
    comida: true,
    ilustracion: "/images/restaurante.svg",
    palabras: ["comida", "almuerzo", "cena", "pica pollo", "moro", "bandera", "sancocho"],
  },
  {
    slug: "empanadas",
    nombre: "Puesto de empanadas",
    plural: "Empanadas",
    comida: true,
    ilustracion: "/images/puesto-empanadas.svg",
    palabras: ["empanada", "pastelito", "frituras", "yaniqueque", "kipe", "quipe"],
  },
  {
    slug: "cafeteria",
    nombre: "Cafetería",
    plural: "Cafeterías",
    comida: true,
    ilustracion: "/images/cafeteria.svg",
    palabras: ["cafe", "desayuno", "sandwich", "batida", "jugo"],
  },
  {
    slug: "panaderia",
    nombre: "Panadería",
    plural: "Panaderías",
    comida: true,
    ilustracion: "/images/panaderia.svg",
    palabras: ["pan", "pan de agua", "pan sobao", "galletas"],
  },
  {
    slug: "reposteria",
    nombre: "Repostería",
    plural: "Reposterías",
    comida: true,
    ilustracion: "/images/panaderia.svg",
    palabras: ["bizcocho", "dulces", "postres", "pastel", "suspiro", "cake"],
  },
  {
    slug: "boutique",
    nombre: "Boutique",
    plural: "Boutiques",
    comida: false,
    ilustracion: "/images/boutique-fachada.svg",
    palabras: ["ropa", "calzado", "zapatos", "accesorios", "moda", "carteras"],
  },
] as const;

export type CategoriaSlug = (typeof CATEGORIAS)[number]["slug"];
export type Categoria = (typeof CATEGORIAS)[number];

export function getCategoria(slug: string | null | undefined): Categoria | undefined {
  return CATEGORIAS.find((c) => c.slug === slug);
}

const normalizar = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Categorías que coinciden con lo que el cliente escribió en el buscador ("pan", "ropa", "café"...). */
export function categoriasQueCoinciden(busqueda: string): CategoriaSlug[] {
  const q = normalizar(busqueda);
  if (q.length < 3) return [];
  return CATEGORIAS.filter((c) =>
    // Coincide al inicio de alguna palabra: "pan" encuentra panaderías, no empanadas.
    [c.slug, c.nombre, c.plural, ...c.palabras].some((w) =>
      normalizar(w)
        .split(/\s+/)
        .some((palabra) => palabra.startsWith(q) || q.startsWith(palabra) && palabra.length >= 4)
    )
  ).map((c) => c.slug);
}

export function isCategoriaSlug(value: string): value is CategoriaSlug {
  return CATEGORIAS.some((c) => c.slug === value);
}

/**
 * Los productos guardan dos datos opcionales en products.talla y
 * products.color. En una boutique son talla y color; en un negocio de comida
 * se usan como tamaño/porción y sabor/variedad.
 */
export function etiquetasVariante(slug: string | null | undefined) {
  return getCategoria(slug)?.comida
    ? {
        talla: "Tamaño o porción",
        color: "Sabor o variedad",
        tallaEjemplo: "Pequeña, familiar, 1 lb...",
        colorEjemplo: "Pollo, queso, chocolate...",
      }
    : { talla: "Talla", color: "Color", tallaEjemplo: "S, M, 38...", colorEjemplo: "Rojo, azul..." };
}
