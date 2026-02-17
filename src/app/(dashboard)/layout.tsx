import { Header } from "@/components/layout/header";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-2 text-white">
      <Suspense fallback={<div className="h-20 bg-[#121214]" />}>
        <Header />
      </Suspense>
      <main className="container mx-auto px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
