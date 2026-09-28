import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/ui/Logo";
import { JoinCodeForm } from "@/components/viewer/JoinCodeForm";

export const metadata = { title: "Join" };

export default function PlayPage() {
  return (
    <main className="app-bg flex min-h-dvh flex-col px-4 pb-10 pt-6">
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <Logo />
        <LanguageSwitch />
      </header>
      <div className="mx-auto mt-16 w-full max-w-md sm:mt-24">
        <JoinCodeForm />
      </div>
    </main>
  );
}
