import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { readDatabase, writeDatabase } from "@/lib/store";
import { postgresEnabled } from "@/lib/db";
import { ChatStoreError, createPostgresChatMessage, readPostgresChat, updatePostgresChatThread } from "@/lib/chat-store";

const bodySchema = z.object({
  participantId: z.string().trim().optional(),
  content: z.string().trim().max(4000).optional(),
  attachmentName: z.string().trim().max(200).optional(),
  attachmentUrl: z.string().trim().max(2000).optional(),
  action: z.enum(["accept", "reject"]).optional(),
  threadId: z.string().trim().optional(),
});

function normalizeMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (postgresEnabled) {
    const threadId = new URL(request.url).searchParams.get("threadId");
    const data = await readPostgresChat(session.organizationId, session.id, threadId);
    return NextResponse.json({ success: true, data });
  }

  const database = await readDatabase();
  const threadId = new URL(request.url).searchParams.get("threadId");

  const members = database.memberships
    .filter((member) => member.organizationId === session.organizationId && member.status === "active")
    .map((member) => {
      const user = database.users.find((entry) => entry.id === member.userId && entry.accountStatus !== "suspended");
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: member.role,
        title: user.title ?? (member.role === "owner" ? "Founder" : member.role === "admin" ? "Operations Lead" : member.role === "manager" ? "Team Lead" : "Team Member"),
        organizationId: member.organizationId,
      };
    })
    .filter(Boolean);

  const threads = database.chatThreads
    .filter((thread) => thread.organizationId === session.organizationId && thread.participants.includes(session.id))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  if (threadId) {
    const selectedMessages = database.chatMessages
      .filter((message) => message.organizationId === session.organizationId && message.threadId === threadId)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

    return NextResponse.json({ success: true, data: { members, threads, messages: selectedMessages } });
  }

  return NextResponse.json({ success: true, data: { members, threads } });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid message or participant." }, { status: 400 });

  const { participantId, content, attachmentName, attachmentUrl, action, threadId } = parsed.data;

  if (postgresEnabled) {
    try {
      if (action && threadId) {
        const thread = await updatePostgresChatThread(session.organizationId, session.id, threadId, action);
        return NextResponse.json({ success: true, data: { thread } });
      }
      if (!participantId) return NextResponse.json({ error: "Choose a person to message." }, { status: 400 });
      const normalized = normalizeMessage(content ?? "");
      if (!normalized && !attachmentName && !attachmentUrl) return NextResponse.json({ error: "Write a message or attach a file." }, { status: 400 });
      const attachment = attachmentName || attachmentUrl ? {
        kind: attachmentUrl?.match(/\.(png|jpe?g|gif|webp|mp4|mov|pdf)$/i) ? (attachmentUrl.match(/\.(png|jpe?g|gif|webp)$/i) ? "image" : attachmentUrl.match(/\.pdf$/i) ? "pdf" : "video") : "file",
        name: attachmentName || attachmentUrl?.split("/").pop() || "Shared attachment",
        url: attachmentUrl,
        sizeLabel: "new",
      } as const : null;
      const data = await createPostgresChatMessage({ organizationId: session.organizationId, userId: session.id, userName: session.name, participantId, content: normalized, attachment, threadId });
      return NextResponse.json({ success: true, data });
    } catch (error) {
      if (error instanceof ChatStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
      console.error("Chat persistence failed", error);
      return NextResponse.json({ error: "Chat is temporarily unavailable." }, { status: 503 });
    }
  }

  const database = await readDatabase();

  if (action && threadId) {
    const thread = database.chatThreads.find((entry) => entry.id === threadId && entry.organizationId === session.organizationId);
    if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    if (!thread.participants.includes(session.id)) return NextResponse.json({ error: "You are not a participant in this conversation." }, { status: 403 });

    if (action === "accept") {
      thread.status = "active";
      thread.updatedAt = new Date().toISOString();
      await writeDatabase(database);
      return NextResponse.json({ success: true, data: { thread } });
    }

    thread.status = "rejected";
    thread.updatedAt = new Date().toISOString();
    await writeDatabase(database);
    return NextResponse.json({ success: true, data: { thread } });
  }

  if (!participantId) {
    return NextResponse.json({ error: "Choose a person to message." }, { status: 400 });
  }

  const target = database.users.find((user) => user.id === participantId && user.accountStatus !== "suspended");
  if (!target) return NextResponse.json({ error: "This user is not available." }, { status: 404 });

  const membership = database.memberships.find((entry) => entry.organizationId === session.organizationId && entry.userId === target.id && entry.status === "active");
  if (!membership) return NextResponse.json({ error: "This person is not in your workspace." }, { status: 403 });
  if (target.id === session.id) return NextResponse.json({ error: "Select another member to start a conversation." }, { status: 400 });

  const normalized = normalizeMessage(content ?? "");
  if (!normalized && !attachmentName && !attachmentUrl) {
    return NextResponse.json({ error: "Write a message or attach a file." }, { status: 400 });
  }

  let thread = database.chatThreads.find((entry) => {
    if (entry.id === threadId) return entry.organizationId === session.organizationId;
    return entry.organizationId === session.organizationId && entry.participants.includes(session.id) && entry.participants.includes(target.id);
  });

  if (!thread) {
    thread = {
      id: `chat_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
      organizationId: session.organizationId,
      participants: [session.id, target.id],
      createdBy: session.id,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    database.chatThreads.push(thread);
  }

  const message: import("@/lib/store").ChatMessage = {
    id: `msg_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
    threadId: thread.id,
    organizationId: session.organizationId,
    senderId: session.id,
    senderName: session.name,
    content: normalized || "Shared a file",
    attachment: attachmentName || attachmentUrl
      ? {
          kind: attachmentUrl?.match(/\.(png|jpe?g|gif|webp|mp4|mov|pdf)$/i) ? (attachmentUrl.match(/\.(png|jpe?g|gif|webp)$/i) ? "image" : attachmentUrl.match(/\.pdf$/i) ? "pdf" : "video") : "file",
          name: attachmentName || attachmentUrl?.split("/").pop() || "Shared attachment",
          url: attachmentUrl,
          sizeLabel: "new",
        }
      : null,
    createdAt: new Date().toISOString(),
    status: "sent",
  };

  database.chatMessages.push(message);
  thread.updatedAt = message.createdAt;
  thread.status = thread.status === "rejected" ? "active" : thread.status;
  await writeDatabase(database);

  return NextResponse.json({ success: true, data: { thread, message } });
}
