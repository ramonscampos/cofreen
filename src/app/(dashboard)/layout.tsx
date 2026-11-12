import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/session-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <QueryProvider>
        <div className="min-h-dvh bg-gray-2 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-white">
          <Suspense
            fallback={
              <div className="h-20 bg-[#121214] pt-[env(safe-area-inset-top)]" />
            }
          >
            <Header />
          </Suspense>
          <main className="container mx-auto px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] md:px-6">
            {children}
          </main>
        </div>
      </QueryProvider>
    </AuthProvider>
  );
}
