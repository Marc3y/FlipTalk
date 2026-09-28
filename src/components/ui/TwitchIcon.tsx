export function TwitchIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4.3 3 3 6.4v13.3h4.6V22h2.6l2.3-2.3H16l4.6-4.6V3H4.3Zm14.6 11.3-2.8 2.8h-4.4L9.3 19.4v-2.3H5.6V4.7h13.3v9.6ZM16.3 8v5h-1.7V8h1.7Zm-4.6 0v5H10V8h1.7Z" />
    </svg>
  );
}
