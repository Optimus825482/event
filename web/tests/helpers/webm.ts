/** En küçük EBML başlığı + Segment başlangıcı; DocType verilen dizedir. */
export function ebml(docType: string, tail = Buffer.alloc(64, 0x11)): Buffer {
  const doc = Buffer.from(docType, "latin1");
  const children = Buffer.concat([
    Buffer.from([0x42, 0x86, 0x81, 0x01]), // EBMLVersion
    Buffer.from([0x42, 0xf7, 0x81, 0x01]), // EBMLReadVersion
    Buffer.from([0x42, 0xf2, 0x81, 0x04]), // EBMLMaxIDLength
    Buffer.from([0x42, 0xf3, 0x81, 0x08]), // EBMLMaxSizeLength
    Buffer.from([0x42, 0x82, 0x80 | doc.length]),
    doc,
    Buffer.from([0x42, 0x87, 0x81, 0x02]), // DocTypeVersion
    Buffer.from([0x42, 0x85, 0x81, 0x02]), // DocTypeReadVersion
  ]);
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80 | children.length]),
    children,
    Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
    tail,
  ]);
}

/** Testler için geçerli en küçük WebM baytları. */
export const WEBM_BYTES = ebml("webm");
