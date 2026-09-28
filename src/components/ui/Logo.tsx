import { AudioWaveform } from "lucide-react";
import Link from "next/link";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 font-display font-bold tracking-tight">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-neon-500 to-fuchsia-600 neon-glow">
        <AudioWaveform className="size-5 -scale-x-100 text-white" />
      </span>
      <span className={size === "lg" ? "text-3xl" : "text-xl"}>
        Flip<span className="neon-text">Talk</span>
      </span>
    </Link>
  );
}
