import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-2 text-white">
      <Header />
      <main className="container mx-auto px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
