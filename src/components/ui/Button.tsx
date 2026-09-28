"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";

const variants = {
  primary:
    "bg-gradient-to-b from-neon-500 to-neon-600 text-white shadow-[0_10px_40px_-10px_rgb(168_85_247/0.9)] hover:from-neon-400 hover:to-neon-500",
  twitch: "bg-twitch text-white shadow-[0_10px_40px_-12px_rgb(145_70_255/0.9)] hover:brightness-110",
  ghost: "glass text-white/90 hover:bg-white/10",
  danger: "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_10px_40px_-12px_rgb(244_63_94/0.8)] hover:brightness-110",
  success: "bg-gradient-to-b from-emerald-400 to-emerald-500 text-emerald-950 shadow-[0_10px_40px_-12px_rgb(52_211_153/0.8)] hover:brightness-110",
};

const sizes = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-14 px-7 text-base gap-2.5 rounded-2xl",
  xl: "h-20 px-10 text-xl gap-3 rounded-3xl",
};

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  children?: React.ReactNode;
};

export function Button({ variant = "primary", size = "md", loading, disabled, className = "", children, ...rest }: Props) {
  return (
    <motion.button
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center font-semibold tracking-tight transition-[filter,background,opacity] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="size-5 animate-spin" /> : children}
    </motion.button>
  );
}
