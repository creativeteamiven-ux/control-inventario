import bwipjs from 'bwip-js';

/** Texto del código de barras: número de serie si existe, si no el código interno. */
export function barcodeTextForDevice(device: { internalCode: string; serialNumber?: string | null }): string {
  const serial = device.serialNumber?.trim();
  return serial || device.internalCode;
}

/** Genera un código de barras CODE128 como PNG (alta legibilidad para impresión y escaneo). */
export function generateBarcodeBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'code128',
        text,
        scale: 3,
        height: 14,
        includetext: true,
        textxalign: 'center',
        textsize: 10,
        paddingwidth: 8,
        paddingheight: 6,
      },
      (err, png) => {
        if (err) reject(err);
        else resolve(png);
      }
    );
  });
}

export async function generateBarcodeDataUrl(text: string): Promise<string> {
  const png = await generateBarcodeBuffer(text);
  return `data:image/png;base64,${png.toString('base64')}`;
}
