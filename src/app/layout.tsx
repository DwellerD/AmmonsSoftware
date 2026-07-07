import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// Root metadata shown in the browser tab and shared link previews.
export const metadata: Metadata = {
  metadataBase: new URL("https://phasebinder.com"),
  title: "PhaseBinder",
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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
