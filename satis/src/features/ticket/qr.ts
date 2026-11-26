import QRCode from "qrcode";

/** QR içeriği yalnızca `qrPayload` belirtecidir; siyah-beyaz PNG veri adresi döner. */
export function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
