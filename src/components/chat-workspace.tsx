"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { ChatMessage, ChatThread, ChatTopic } from "@/lib/types";
import { useI18n } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

const TOPICS: ChatTopic[] = [
  "support",
  "order",
  "ride",
  "delivery",
  "grocery",
  "account",
];

const CLIENT_QUESTIONS = [
  "Where is my order?",
  "My order is late",
  "I received the wrong item",
  "I need a refund",
  "My grocery substitution",
  "My taxi fare",
  "I cannot sign in",
];

const TOPIC_LABELS: Record<ChatTopic, string> = {
  support: "Support",
  order: "Order",
  ride: "Taxi ride",
  delivery: "Delivery",
  grocery: "Grocery",
  account: "Account",
};

export function ChatWorkspace({
  initialThreads,
  initialThreadId,
  role,
  title,
  subtitle,
}: {
  initialThreads: ChatThread[];
  initialThreadId?: string;
  role: "customer" | "driver" | "merchant" | "admin";
  title: string;
  subtitle: string;
}) {
  const { t } = useI18n();
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState(
    initialThreadId && initialThreads.some((thread) => thread.id === initialThreadId)
      ? initialThreadId
      : initialThreads[0]?.id ?? "",
  );
  const [thread, setThread] = useState<ChatThread | null>(
    initialThreads.find((entry) => entry.id === selectedId) ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [draftTopic, setDraftTopic] = useState<ChatTopic>("support");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "waiting" | "closed">(
    "all",
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadThread(id: string, silent = false) {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/chat/threads/${id}`, { cache: "no-store" });
      const data = (await response.json()) as {
        thread?: ChatThread;
        messages?: ChatMessage[];
        error?: string;
      };
      if (!response.ok || !data.thread || !data.messages) {
        setError(data.error || t("Could not open this conversation."));
        return;
      }
      setThread(data.thread);
      setMessages(data.messages);
      setThreads((current) =>
        current.map((entry) => (entry.id === data.thread!.id ? data.thread! : entry)),
      );
      setError("");
    } catch {
      setError(t("Could not open this conversation."));
    } finally {
      if (!silent) setLoading(false);
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
      );
    }
  }

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const handle = window.setInterval(() => {
      void loadThread(selectedId, true);
    }, 4000);
    return () => window.clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !thread) return;
    setSending(true);
    setError("");
    setBody("");
    try {
      const endpoint =
        role === "customer" && thread.aiEnabled
          ? "/api/ai/chat"
          : `/api/chat/threads/${thread.id}/messages`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          role === "customer" && thread.aiEnabled
            ? { threadId: thread.id, message: text }
            : { body: text },
        ),
      });
      const data = (await response.json()) as {
        userMessage?: ChatMessage;
        reply?: ChatMessage;
        message?: ChatMessage;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error || t("Could not send the message."));
        setBody(text);
        return;
      }
      const userMessage = data.userMessage;
      const reply = data.reply;
      const normalMessage = data.message;
      if (userMessage) {
        setMessages((current) => [...current, userMessage]);
      }
      if (reply) {
        setMessages((current) => [...current, reply]);
      }
      if (normalMessage) {
        setMessages((current) => [...current, normalMessage]);
      }
      await loadThread(thread.id, true);
    } catch {
      setError(t("Could not send the message."));
      setBody(text);
    } finally {
      setSending(false);
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
      );
    }
  }

  async function createThread(event: React.FormEvent) {
    event.preventDefault();
    if (!draftSubject.trim() && !draftMessage.trim()) {
      setError(t("Add a subject or a first message."));
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: draftTopic,
          subject: draftSubject,
          initialMessage: draftMessage,
          aiEnabled: draftTopic === "support",
        }),
      });
      const data = (await response.json()) as {
        thread?: ChatThread;
        error?: string;
      };
      if (!response.ok || !data.thread) {
        setError(data.error || t("Could not start the conversation."));
        return;
      }
      setThreads((current) => [data.thread!, ...current]);
      setSelectedId(data.thread.id);
      setCreating(false);
      setDraftSubject("");
      setDraftMessage("");
      setDraftTopic("support");
    } catch {
      setError(t("Could not start the conversation."));
    } finally {
      setSending(false);
    }
  }

  async function closeThread() {
    if (!thread) return;
    setSending(true);
    try {
      const response = await fetch(`/api/chat/threads/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = (await response.json()) as { thread?: ChatThread; error?: string };
      if (!response.ok || !data.thread) {
        setError(data.error || t("Could not close the conversation."));
        return;
      }
      setThread(data.thread);
      setThreads((current) =>
        current.map((entry) => (entry.id === data.thread!.id ? data.thread! : entry)),
      );
    } finally {
      setSending(false);
    }
  }

  const visibleThreads = useMemo(
    () =>
      threads.filter((entry) =>
        statusFilter === "all" ? true : entry.status === statusFilter,
      ),
    [threads, statusFilter],
  );

  const canCreate = role === "customer";

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr] lg:items-start">
      <aside className="aero-tile overflow-hidden rounded-[10px] border">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h1 className="text-[14px] font-semibold">{title}</h1>
            <p className="mt-0.5 text-[10px] text-muted">{subtitle}</p>
          </div>
          {canCreate ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="btn btn-primary btn-sm shrink-0"
            >
              <Plus size={12} /> {t("New")}
            </button>
          ) : null}
        </div>

        {role === "admin" ? (
          <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
            {(["all", "open", "waiting", "closed"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "rounded-[3px] px-2 py-1 text-[10px] font-semibold capitalize",
                  statusFilter === value
                    ? "bg-ink text-on-dark"
                    : "text-muted hover:text-ink",
                )}
              >
                {t(value === "all" ? "All" : value)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="max-h-[520px] divide-y divide-line overflow-y-auto">
          {visibleThreads.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={cn(
                "block w-full px-4 py-3 text-start transition-colors hover:bg-surface-2",
                selectedId === entry.id && "bg-surface-2",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-semibold">
                  {entry.subject}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-[2px] px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                    entry.status === "closed"
                      ? "bg-surface-2 text-muted"
                      : entry.status === "waiting"
                        ? "bg-saffron/15 text-saffron-deep"
                        : "bg-success-soft text-success",
                  )}
                >
                  {t(entry.status)}
                </span>
              </div>
              <div className="mt-1 truncate text-[10px] text-muted">
                {entry.lastMessagePreview || t("No messages yet")}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-muted">
                <span className="truncate">
                  {role === "admin" ? entry.customerName : TOPIC_LABELS[entry.topic]}
                </span>
                <span>
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(entry.lastMessageAt))}
                </span>
              </div>
            </button>
          ))}
          {!visibleThreads.length ? (
            <div className="px-4 py-10 text-center text-[11px] text-muted">
              {t("No conversations yet.")}
            </div>
          ) : null}
        </div>
      </aside>

      <section className="aero-tile flex min-h-[520px] flex-col overflow-hidden rounded-[10px] border">
        {creating ? (
          <form onSubmit={createThread} className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">{t("New conversation")}</h2>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="grid h-8 w-8 place-items-center rounded-[4px] text-muted hover:bg-surface-2"
                aria-label={t("Close")}
              >
                <X size={15} />
              </button>
            </div>
            <label className="mt-4 block">
              <span className="label">{t("Topic")}</span>
              <select
                value={draftTopic}
                onChange={(event) => setDraftTopic(event.target.value as ChatTopic)}
                className="input"
              >
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {t(TOPIC_LABELS[topic])}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="label">{t("Subject")}</span>
              <input
                value={draftSubject}
                onChange={(event) => setDraftSubject(event.target.value)}
                className="input"
                placeholder={t("e.g. Late grocery order")}
              />
            </label>
            <label className="mt-3 block">
              <span className="label">{t("First message")}</span>
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                className="input min-h-24"
                placeholder={t("Describe the problem…")}
              />
            </label>
            <p className="mt-2 text-[10px] text-muted">
              {t("Support chats start with the Wassl assistant. A human agent can take over.")}
            </p>
            <button
              type="submit"
              disabled={sending}
              className="btn btn-primary mt-4 disabled:opacity-40"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
              {t("Start conversation")}
            </button>
          </form>
        ) : thread ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{thread.subject}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                  <span className="capitalize">{t(TOPIC_LABELS[thread.topic])}</span>
                  <span>·</span>
                  <span>{thread.customerName}</span>
                  {thread.aiEnabled ? (
                    <span className="inline-flex items-center gap-1 text-brand">
                      <Sparkles size={10} /> {t("Assistant available")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck size={10} /> {t("Human agent")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {thread.orderId ? (
                  <Link href={`/orders/${thread.orderId}`} className="btn btn-ghost btn-sm">
                    {t("Order")} <ArrowRight size={11} />
                  </Link>
                ) : null}
                {thread.rideId ? (
                  <Link href={`/taxi/${thread.rideId}`} className="btn btn-ghost btn-sm">
                    {t("Ride")} <ArrowRight size={11} />
                  </Link>
                ) : null}
                {thread.status !== "closed" ? (
                  <button
                    type="button"
                    onClick={closeThread}
                    disabled={sending}
                    className="btn btn-ghost btn-sm text-muted"
                  >
                    {t("Close")}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                    <CheckCircle2 size={11} /> {t("Closed")}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-surface-2/30 p-4">
              {messages.map((message) => {
                const own = message.senderRole === role;
                return (
                  <div
                    key={message.id}
                    className={cn("flex", own ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[82%] rounded-[8px] px-3 py-2 text-[12px] leading-5",
                        own
                          ? "bg-ink text-on-dark"
                          : "border border-line bg-surface",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-1 text-[9px] font-semibold uppercase tracking-[0.06em]",
                          own ? "text-on-dark/60" : "text-brand",
                        )}
                      >
                        {message.senderName}
                      </div>
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <div
                        className={cn(
                          "mt-1 text-[9px]",
                          own ? "text-on-dark/50" : "text-muted",
                        )}
                      >
                        {new Intl.DateTimeFormat("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(message.createdAt))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {loading ? (
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Loader2 size={12} className="animate-spin" /> {t("Loading…")}
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {error ? (
              <p className="border-t border-line bg-danger-soft px-4 py-2 text-[11px] text-danger">
                {error}
              </p>
            ) : null}

            {role === "customer" && !messages.length ? (
              <div className="flex flex-wrap gap-1.5 border-t border-line px-3 pt-2">
                {CLIENT_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => setBody(question)}
                    className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-medium text-muted hover:border-line-strong hover:text-ink"
                  >
                    {t(question)}
                  </button>
                ))}
              </div>
            ) : null}

            <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={2}
                className="input min-h-[44px] flex-1 resize-none text-[12px]"
                placeholder={t("Write a message…")}
                aria-label={t("Message")}
              />
              <button
                type="submit"
                disabled={sending || !body.trim() || thread.status === "closed"}
                className="btn btn-primary h-11 shrink-0 disabled:opacity-40"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {t("Send")}
              </button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <MessageCircle size={26} className="mx-auto text-muted" />
              <p className="mt-3 text-[13px] font-medium">{t("No conversation selected.")}</p>
              <p className="mt-1 text-[11px] text-muted">
                {t("Start a support chat or open an existing conversation.")}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
