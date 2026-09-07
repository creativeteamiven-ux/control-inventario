/**
 * Comprobación del contenido real de un archivo subido.
 *
 * La extensión y el MIME que envía el navegador los controla el cliente, así
 * que se verifican además los primeros bytes (magic bytes) del buffer.
 */

type Kind = 'image' | 'document' | 'receipt';

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function isJpeg(buf: Buffer): boolean {
  return startsWith(buf, [0xff, 0xd8, 0xff]);
}

function isPng(buf: Buffer): boolean {
  return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function isWebp(buf: Buffer): boolean {
  // "RIFF" .... "WEBP"
  return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
}

function isGif(buf: Buffer): boolean {
  return startsWith(buf, [0x47, 0x49, 0x46, 0x38]);
}

function isPdf(buf: Buffer): boolean {
  return startsWith(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
}

/** ZIP (docx moderno) o el contenedor OLE de los .doc antiguos. */
function isWordContainer(buf: Buffer): boolean {
  const zip = startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
  const ole = startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  return zip || ole;
}

export function isImageBuffer(buf: Buffer): boolean {
  return isJpeg(buf) || isPng(buf) || isWebp(buf) || isGif(buf);
}

/**
 * Lanza si el contenido no corresponde al tipo esperado.
 * @param kind image: solo imágenes · document: PDF o Word · receipt: PDF o imagen
 */
export function assertFileContent(buf: Buffer, kind: Kind, originalName = 'archivo'): void {
  const ok =
    kind === 'image'
      ? isImageBuffer(buf)
      : kind === 'document'
        ? isPdf(buf) || isWordContainer(buf)
        : isPdf(buf) || isImageBuffer(buf);

  if (!ok) {
    throw new Error(
      `El contenido de "${originalName}" no coincide con su extensión. Sube un archivo válido.`
    );
  }
}
