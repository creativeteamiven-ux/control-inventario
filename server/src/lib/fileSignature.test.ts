import { describe, it, expect } from 'vitest';
import { assertFileContent, isImageBuffer } from './fileSignature.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = Buffer.from('%PDF-1.7\n');
const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const script = Buffer.from('<?php system($_GET["c"]); ?>');

describe('isImageBuffer', () => {
  it('reconoce JPEG y PNG', () => {
    expect(isImageBuffer(jpeg)).toBe(true);
    expect(isImageBuffer(png)).toBe(true);
  });

  it('rechaza contenido que no es imagen', () => {
    expect(isImageBuffer(pdf)).toBe(false);
    expect(isImageBuffer(script)).toBe(false);
  });
});

describe('assertFileContent', () => {
  it('acepta imágenes reales como imagen', () => {
    expect(() => assertFileContent(jpeg, 'image')).not.toThrow();
  });

  it('rechaza un script con nombre de imagen', () => {
    expect(() => assertFileContent(script, 'image', 'foto.jpg')).toThrow(/no coincide/);
  });

  it('acepta PDF y Word como documento', () => {
    expect(() => assertFileContent(pdf, 'document')).not.toThrow();
    expect(() => assertFileContent(docx, 'document')).not.toThrow();
  });

  it('rechaza un PDF falso', () => {
    expect(() => assertFileContent(script, 'document', 'factura.pdf')).toThrow();
  });

  it('el comprobante admite PDF o imagen', () => {
    expect(() => assertFileContent(pdf, 'receipt')).not.toThrow();
    expect(() => assertFileContent(png, 'receipt')).not.toThrow();
    expect(() => assertFileContent(script, 'receipt', 'recibo.pdf')).toThrow();
  });
});
