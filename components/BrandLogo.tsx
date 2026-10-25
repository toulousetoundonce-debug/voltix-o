import Image from "next/image";

type BrandLogoProps = {
  priority?: boolean;
};

export default function BrandLogo({ priority = false }: BrandLogoProps) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] p-0.5 shadow-glow-blue"
    >
      <Image
        src="/images/voltix-logo.webp"
        alt=""
        width={323}
        height={285}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
