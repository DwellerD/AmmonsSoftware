"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/cn";

/**
 * Signs the current user out of Firebase and returns them to the login page.
 * Rendered inside the authenticated layout's navigation.
 */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await signOut(getFirebaseAuth());
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={cn(
        "text-sm font-medium text-ink-500 hover:text-ink-800 disabled:opacity-50",
        className,
      )}
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
