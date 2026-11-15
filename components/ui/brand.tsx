import Image from "next/image";
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand ${large ? "brand-large" : ""}`}>
      <Image
        src="/logo/logo.png"
        width={1535}
        height={1024}
        alt="CCU360"
        className="absolute -top-[20%] left-[3.5%] h-auto w-[93%] max-w-none"
        priority
        sizes={large ? "200px" : "130px"}
      />
    </div>
  );
}
