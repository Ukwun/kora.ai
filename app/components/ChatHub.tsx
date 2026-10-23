"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
};

type Thread = {
  id: string;
  participants: string[];
  createdBy: string;
  status: "pending" | "active" | "rejected";
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachment?: {
    kind: string;
    name: string;
    url?: string;
    sizeLabel?: string;
  } | null;
  createdAt: string;
  status: string;
};

export default function ChatHub({ currentUserId, currentUserRole }: { currentUserId: string; currentUserRole: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const loadThreads = useCallback(async () => {
    const response = await fetch("/api/chat", { cache: "no-store" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setNotice(result.error ?? "Your message list could not be loaded.");
      return;
    }

    const result = await response.json();
    const nextThreads = result.data?.threads ?? [];
    const nextMembers = result.data?.members ?? [];
    setMembers(nextMembers);
    setThreads(nextThreads);

    if (!selectedThreadId && nextThreads.length > 0) {
      setSelectedThreadId(nextThreads[0].id);
    }

    if (selectedThreadId && !nextThreads.some((thread: Thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(nextThreads[0]?.id ?? "");
    }
  }, [selectedThreadId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadThreads(), 0);
    const timer = window.setInterval(() => void loadThreads(), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      const clearTimer = window.setTimeout(() => setMessages([]), 0);
      return () => window.clearTimeout(clearTimer);
    }

    let active = true;
    async function loadMessages() {
      const response = await fetch(`/api/chat?threadId=${encodeURIComponent(selectedThreadId)}`, { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      if (!active) return;
      setMessages(result.data?.messages ?? []);
    }

    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedThreadId]);

  const currentThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const participants = currentThread?.participants.filter((participantId) => participantId !== currentUserId).map((participantId) => memberMap.get(participantId)).filter(Boolean) ?? [];

  async function startThread(memberId: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: memberId, content: "Hello — I would like to connect." }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The connection request could not be sent.");
      setSelectedThreadId(result.data.thread.id);
      setNotice("Connection request sent. The other person can accept it to start chatting.");
      await loadThreads();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The connection request could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function answerThread(action: "accept" | "reject") {
    if (!selectedThreadId) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: selectedThreadId, action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The request could not be updated.");
      setNotice(action === "accept" ? "Conversation accepted. You can now send messages." : "Conversation declined.");
      await loadThreads();
      setSelectedThreadId(result.data.thread.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The request could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThreadId || (!draft.trim() && !attachmentName && !attachmentUrl)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participants[0]?.id ?? currentUserId,
          threadId: selectedThreadId,
          content: draft,
          attachmentName,
          attachmentUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your message could not be sent.");
      setDraft("");
      setAttachmentName("");
      setAttachmentUrl("");
      setSelectedThreadId(result.data.thread.id);
      const currentMessages = await fetch(`/api/chat?threadId=${encodeURIComponent(result.data.thread.id)}`, { cache: "no-store" });
      const messagePayload = await currentMessages.json();
      setMessages(messagePayload.data?.messages ?? []);
      await loadThreads();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-violet-300">Communication hub</p>
          <h2 className="mt-1 text-xl font-semibold">Messages and team connection requests</h2>
        </div>
        <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-100">{currentUserRole}</span>
      </div>

      {notice && <p className="mt-4 rounded-xl border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">{notice}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">People</p>
            <span className="text-xs text-slate-500">{members.length} active</span>
          </div>

          <div className="space-y-2">
            {members
              .filter((member) => member.id !== currentUserId)
              .map((member) => {
                const thread = threads.find((entry) => entry.participants.includes(member.id) && entry.participants.includes(currentUserId));
                const isSelected = selectedThreadId === thread?.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      if (thread) setSelectedThreadId(thread.id);
                      else void startThread(member.id);
                    }}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${isSelected ? "border-violet-300/40 bg-violet-500/10" : "border-white/5 bg-white/[0.02] hover:border-violet-300/25"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{member.name}</p>
                        <p className="text-[11px] text-slate-400">{member.title} · {member.role}</p>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${thread?.status === "pending" ? "bg-amber-300" : thread?.status === "active" ? "bg-emerald-400" : "bg-slate-500"}`} />
                    </div>
                  </button>
                );
              })}
          </div>
        </aside>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          {!selectedThreadId && <p className="text-sm text-slate-400">Choose a person to start a conversation.</p>}

          {selectedThreadId && currentThread && (
            <>
              <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{participants.map((participant) => participant?.name ?? "Member").join(", ") || "Direct conversation"}</p>
                  <p className="text-xs text-slate-500">{currentThread.status === "pending" ? "Waiting for acceptance" : currentThread.status === "active" ? "Connection active" : "Request closed"}</p>
                </div>
                {currentThread.status === "pending" && currentThread.createdBy !== currentUserId && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void answerThread("accept")} disabled={busy} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Accept</button>
                    <button type="button" onClick={() => void answerThread("reject")} disabled={busy} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 disabled:opacity-50">Decline</button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {messages.length === 0 && <p className="text-sm text-slate-500">No messages yet. Start the first conversation.</p>}
                {messages.map((message) => {
                  const isMine = message.senderId === currentUserId;
                  return (
                    <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl border px-3 py-2 ${isMine ? "border-violet-300/30 bg-violet-500/10 text-violet-50" : "border-white/10 bg-white/[0.03] text-slate-200"}`}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                          <span>{isMine ? "You" : message.senderName}</span>
                          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
                        {message.attachment && (
                          <a href={message.attachment.url || "#"} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-lg border border-dashed border-violet-300/25 px-2 py-1 text-xs text-violet-200">
                            {message.attachment.name}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendMessage} className="mt-4 space-y-3 border-t border-white/10 pt-4">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} placeholder="Write a message to this person…" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none focus:border-violet-400" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} placeholder="Attachment label (e.g. Proposal.pdf)" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" />
                  <input value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="Optional attachment URL" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" />
                </div>
                <button type="submit" disabled={busy || (!draft.trim() && !attachmentName && !attachmentUrl)} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send message"}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
