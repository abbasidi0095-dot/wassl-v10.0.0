"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";

export function PendingActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={loading}
      className="btn btn-ghost w-full"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
      Sign out
    </button>
  );
}
