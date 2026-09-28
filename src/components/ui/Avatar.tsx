import type { PublicPlayer } from "@/lib/types";

const sizes = { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-20 text-2xl", xl: "size-32 text-4xl" };

export function Avatar({ player, size = "md", className = "" }: { player: PublicPlayer; size?: keyof typeof sizes; className?: string }) {
  const base = `${sizes[size]} shrink-0 rounded-full ring-2 ring-neon-500/60 ${className}`;
  if (player.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={player.image} alt="" className={`${base} object-cover`} referrerPolicy="no-referrer" />;
  }
  return (
    <div className={`${base} grid place-items-center bg-gradient-to-br from-neon-500 to-fuchsia-600 font-bold uppercase text-white`}>
      {player.name.slice(0, 2)}
    </div>
  );
}
