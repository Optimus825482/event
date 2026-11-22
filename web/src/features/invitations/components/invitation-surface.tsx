import Image from "next/image";
import type { CSSProperties } from "react";
import type { InvitationElement } from "../elements";

export type SurfaceProps = {
  width: number;
  height: number;
  backgroundColor: string | null;
  backgroundGradient: string | null;
  /** Yükleme yolunu (`invitation/…webp`) tarayıcı adresine çevirir. */
  imageSrc: (uploadPath: string) => string;
  backgroundImage: string | null;
  elements: InvitationElement[];
  /** QR öğelerinin göstereceği görüntü (veri URL'si); yoksa yer tutucu çizilir. */
  qrSrc?: string | undefined;
  scale?: number;
};

export function elementCss(element: InvitationElement): CSSProperties {
  return {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex ?? 0,
    opacity: element.opacity,
    backgroundColor: element.backgroundColor,
    borderRadius: element.borderRadius,
    color: element.color,
    fontSize: element.fontSize,
    fontFamily: element.fontFamily ? `${element.fontFamily}, sans-serif` : undefined,
    fontWeight: element.fontWeight,
    textAlign: element.textAlign,
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  };
}

/** Bir öğenin içeriği; yazı, görüntü ya da QR. Editör ve herkese açık sayfa aynı çizimi kullanır. */
export function ElementBody({
  element,
  imageSrc,
  qrSrc,
}: {
  element: InvitationElement;
  imageSrc: (uploadPath: string) => string;
  qrSrc?: string | undefined;
}) {
  if (element.type === "qrcode") {
    return qrSrc ? (
      <Image src={qrSrc} alt="Giriş QR kodu" width={element.width} height={element.height} unoptimized style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    ) : (
      <div className="flex h-full w-full items-center justify-center border border-dashed text-xs">QR</div>
    );
  }
  if ((element.type === "image" || element.type === "logo") && element.imageUrl) {
    return (
      <Image
        src={imageSrc(element.imageUrl)}
        alt=""
        width={element.width}
        height={element.height}
        unoptimized
        style={{ width: "100%", height: "100%", objectFit: element.objectFit ?? "contain", borderRadius: element.borderRadius }}
      />
    );
  }
  return <>{element.content ?? ""}</>;
}

export function InvitationSurface({
  width,
  height,
  backgroundColor,
  backgroundGradient,
  backgroundImage,
  imageSrc,
  elements,
  qrSrc,
  scale = 1,
}: SurfaceProps) {
  const style: CSSProperties = {
    position: "relative",
    width,
    height,
    backgroundColor: backgroundColor ?? "#FFFFFF",
    backgroundImage: backgroundImage
      ? `url("${imageSrc(backgroundImage)}")`
      : (backgroundGradient ?? undefined),
    backgroundSize: "cover",
    backgroundPosition: "center",
    overflow: "hidden",
    transform: scale === 1 ? undefined : `scale(${scale})`,
    transformOrigin: "top left",
  };
  const sorted = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  return (
    <section style={style} aria-label="Davetiye">
      {sorted.map((element) => (
        <div key={element.id} style={elementCss(element)}>
          <ElementBody element={element} imageSrc={imageSrc} qrSrc={qrSrc} />
        </div>
      ))}
    </section>
  );
}
