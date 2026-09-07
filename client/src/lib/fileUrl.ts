/**
 * Resuelve la URL de un archivo servido por el backend.
 *
 * Las subidas nuevas guardan URL absoluta (Cloudinary o PUBLIC_API_URL), pero
 * en la base hay registros antiguos con rutas relativas `/uploads/...` que, sin
 * prefijo, el navegador pediría al dominio del frontend.
 */
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function fileUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('/uploads/')) return `${API_URL}${url}`;
  return url;
}
