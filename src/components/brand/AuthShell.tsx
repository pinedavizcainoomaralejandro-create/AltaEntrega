import Image from "next/image";
import Logo from "./Logo";
import HomeLink from "@/components/HomeLink";

/**
 * Pantallas de acceso (login, registro, contraseña): formulario a la izquierda
 * y, a la derecha, las lomas de Villa Altagracia con ilustraciones de boutique.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-arena-50 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Logo />
          <HomeLink />
        </div>

        {/* En móvil, una franja con la foto del pueblo. */}
        <div className="relative mt-6 h-32 overflow-hidden rounded-2xl lg:hidden">
          <Image
            src="/images/villa-altagracia-montanas.jpg"
            alt="Lomas de Villa Altagracia vistas desde la Autopista Duarte"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_35%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-monte-950/70 to-transparent" />
          <p className="absolute bottom-3 left-4 font-display text-lg text-white">Desde Villa Altagracia, para ti</p>
        </div>

        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-stone-500">{subtitle}</p>}
          <div className="mt-8 flex flex-col gap-6">{children}</div>
        </main>

        <p className="text-xs text-stone-400">© {new Date().getFullYear()} AltaEntrega · Hecho en Villa Altagracia, RD</p>
      </div>

      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/villa-altagracia-montanas.jpg"
          alt="Lomas de Villa Altagracia vistas desde la Autopista Duarte"
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-monte-950/90 via-monte-950/30 to-monte-950/10" />

        <div className="absolute right-10 top-10 flex gap-4">
          <figure className="relative h-60 w-44 rotate-[-4deg] overflow-hidden rounded-2xl border-4 border-white bg-white shadow-2xl">
            <Image
              src="/images/boutique-fachada.svg"
              alt="Ilustración de una boutique con toldo de rayas"
              fill
              unoptimized
              className="object-cover"
            />
          </figure>
          <figure className="relative mt-12 h-44 w-60 rotate-[3deg] overflow-hidden rounded-2xl border-4 border-white bg-white shadow-2xl">
            <Image
              src="/images/boutique-percha.svg"
              alt="Ilustración de una percha con ropa y una bolsa de AltaEntrega"
              fill
              unoptimized
              className="object-cover"
            />
          </figure>
        </div>

        <div className="absolute inset-x-10 bottom-10 text-white">
          <span className="badge bg-sol-400/90 text-monte-950">Villa Altagracia · San Cristóbal</span>
          <p className="mt-4 max-w-md font-display text-4xl font-semibold leading-tight text-balance">
            Las boutiques de tu pueblo, en la puerta de tu casa.
          </p>
          <p className="mt-3 max-w-md text-sm text-monte-100">
            Compra en las tiendas de Villa Altagracia, paga seguro con tarjeta y recibe tu pedido con un repartidor
            local.
          </p>
          <p className="mt-6 text-[10px] text-white/50">
            Foto: Autopista Duarte en Villa Altagracia (Markocortesa2, CC0, Wikimedia Commons).
          </p>
        </div>
      </aside>
    </div>
  );
}
