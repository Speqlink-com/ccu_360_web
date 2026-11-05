import Image from "next/image";
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand ${large ? "brand-large" : ""}`}>
      <Image
        src="/ccu360-logo.png"
        width={1536}
        height={1024}
        alt="CCU360"
        priority
        sizes={large ? "200px" : "130px"}
      />
    </div>
  );
}
