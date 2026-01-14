"use client";

import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/logo-inverse.svg"
            alt="Logo"
            width={48}
            height={48}
            className="h-12 w-auto"
            priority
          />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Faça seu login</h1>
        <p className="text-zinc-400">
          Organize suas finanças de forma simples e eficiente.
        </p>

        <div className="pt-4">
          <button
            type="button"
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#00875f] hover:bg-[#00875f]/90 text-white p-3 rounded font-medium transition-colors"
          >
            <Image
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              width={24}
              height={24}
              className="w-6 h-6"
            />
            <span>Entrar com Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}
