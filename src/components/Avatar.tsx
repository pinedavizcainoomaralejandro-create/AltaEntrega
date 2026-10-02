/** Foto de perfil, o la inicial del nombre si no tiene. */
export default function Avatar({
  nombre,
  url,
  className = "h-8 w-8 text-base",
}: {
  nombre: string;
  url: string | null;
  className?: string;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- imágenes sin optimizar (ver next.config.mjs)
    return <img src={url} alt="" className={`${className} shrink-0 rounded-full bg-monte-100 object-cover`} />;
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-monte-100 font-semibold text-monte-800`}
    >
      {(nombre.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}
