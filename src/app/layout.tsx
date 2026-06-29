import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

// Root metadata shown in the browser tab and shared link previews.
export const metadata: Metadata = {
  title: "TradeFlow",
  description:
    "Mobile-first construction workflow app for trade readiness, material tracking, completion proof, and document control.",
};

/**
 * RootLayout wraps every page in the app.
 * It sets up the <html>/<body> shell, global styles, and the AuthProvider so
 * any client component can read the current Firebase auth state via useAuth().
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
