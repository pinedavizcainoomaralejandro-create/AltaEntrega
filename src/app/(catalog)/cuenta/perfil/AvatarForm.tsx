"use client";

import { useRef, useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import { removeAvatarAction, updateAvatarAction } from "../actions";

const SIZE = 256;

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
}

/**
 * Recorta la foto al cuadrado del centro y la reduce a 256x256. Así una foto
 * de 5 MB del teléfono se sube en unos 20 KB. Safari antiguo no genera WebP:
 * en ese caso se usa JPEG.
 */
async function resizeAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const webp = await canvasToBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;
  return canvasToBlob(canvas, "image/jpeg");
}

export default function AvatarForm({ nombre, url }: { nombre: string; url: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    let blob: Blob | null;
    try {
      blob = await resizeAvatar(file);
    } catch {
      setError("No pudimos leer esa imagen. Prueba con una foto JPG o PNG.");
      return;
    }
    if (!blob) {
      setError("No pudimos preparar la foto. Inténtalo de nuevo.");
      return;
    }

    const localUrl = URL.createObjectURL(blob);
    setPreview(localUrl);
    const formData = new FormData();
    formData.append("avatar", new File([blob], "avatar", { type: blob.type }));

    startTransition(async () => {
      const result = await updateAvatarAction({ error: null }, formData);
      setError(result.error);
      setPreview(null);
      URL.revokeObjectURL(localUrl);
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar nombre={nombre} url={preview ?? url} className={`h-20 w-20 text-3xl ${pending ? "opacity-60" : ""}`} />
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="btn-secondary btn-sm">
            {pending ? "Guardando..." : url ? "Cambiar foto" : "Subir foto"}
          </button>
          {url && !pending && (
            <button type="button" onClick={onRemove} className="btn-sm text-xs font-semibold text-stone-500 underline">
              Quitar
            </button>
          )}
        </div>
        <p className="text-xs text-stone-500">JPG, PNG o WebP. La recortamos en cuadrado.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="hidden" />
    </div>
  );
}
