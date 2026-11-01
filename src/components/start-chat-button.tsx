"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import type { ChatTopic } from "@/lib/types";
import { useI18n } from "@/components/locale-provider";

export function StartChatButton({
  topic,
  orderId,
  rideId,
  storeId,
  driverId,
  subject,
  label,
  className = "btn btn-ghost btn-sm",
}: {
  topic: ChatTopic;
  orderId?: string;
  rideId?: string;
  storeId?: string;
  driverId?: string;
  subject?: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, orderId, rideId, storeId, driverId, subject }),
      });
      const data = (await response.json()) as {
        thread?: { id: string };
        error?: string;
      };
      if (response.status === 401) {
        router.push("/login?next=messages");
        return;
      }
      if (!response.ok || !data.thread) {
        setError(data.error || t("Could not start the chat."));
        return;
      }
      router.push(`/messages?thread=${encodeURIComponent(data.thread.id)}`);
    } catch {
      setError(t("Could not start the chat."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={start} disabled={loading} className={className}>
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <MessageCircle size={13} />
        )}
        {loading ? t("Opening…") : label}
      </button>
      {error ? <span className="text-[10px] text-danger">{error}</span> : null}
    </span>
  );
}
