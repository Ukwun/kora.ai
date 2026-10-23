import { query, withTransaction } from "./db";
import type { ChatMessage, ChatThread } from "./store";

export type ChatMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  organizationId: string;
};

export class ChatStoreError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ThreadRow = Omit<ChatThread, "participants"> & { participants: string[] };

export async function readPostgresChat(organizationId: string, userId: string, threadId?: string | null) {
  const members = await query<ChatMember>(`
    SELECT u.id, u.name, u.email, m.role, COALESCE(u.title, CASE m.role WHEN 'owner' THEN 'Founder' WHEN 'admin' THEN 'Operations Lead' WHEN 'manager' THEN 'Team Lead' ELSE 'Team Member' END) AS title,
           m.organization_id AS "organizationId"
    FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.organization_id = $1 AND m.status = 'active' AND u.account_status <> 'suspended'
    ORDER BY u.name ASC`, [organizationId]);
  const threads = await query<ThreadRow>(`
    SELECT t.id, t.organization_id AS "organizationId", t.created_by AS "createdBy", t.status,
           t.created_at AS "createdAt", t.updated_at AS "updatedAt",
           ARRAY_AGG(tm.user_id ORDER BY tm.user_id) AS participants
    FROM chat_threads t JOIN chat_thread_members tm ON tm.thread_id = t.id
    WHERE t.organization_id = $1 AND EXISTS (
      SELECT 1 FROM chat_thread_members mine WHERE mine.thread_id = t.id AND mine.user_id = $2
    )
    GROUP BY t.id ORDER BY t.updated_at DESC`, [organizationId, userId]);
  const messages = threadId
    ? await query<ChatMessage>(`SELECT id, thread_id AS "threadId", organization_id AS "organizationId", sender_id AS "senderId", sender_name AS "senderName", content, attachment, created_at AS "createdAt", status FROM chat_messages WHERE thread_id = $1 AND organization_id = $2 AND EXISTS (SELECT 1 FROM chat_thread_members WHERE thread_id = $1 AND user_id = $3) ORDER BY created_at ASC`, [threadId, organizationId, userId])
    : { rows: [] as ChatMessage[] };
  return { members: members.rows, threads: threads.rows, messages: messages.rows };
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export async function updatePostgresChatThread(organizationId: string, userId: string, threadId: string, action: "accept" | "reject") {
  const result = await query<ChatThread>(`UPDATE chat_threads t SET status = $1, updated_at = NOW() WHERE t.id = $2 AND t.organization_id = $3 AND EXISTS (SELECT 1 FROM chat_thread_members m WHERE m.thread_id = t.id AND m.user_id = $4) RETURNING id, organization_id AS "organizationId", created_by AS "createdBy", status, created_at AS "createdAt", updated_at AS "updatedAt"`, [action === "accept" ? "active" : "rejected", threadId, organizationId, userId]);
  if (!result.rows[0]) throw new ChatStoreError("Conversation not found or you are not a participant.", 404);
  const data = await readPostgresChat(organizationId, userId, threadId);
  return { ...result.rows[0], participants: data.threads.find((thread) => thread.id === threadId)?.participants ?? [] };
}

export async function createPostgresChatMessage(input: { organizationId: string; userId: string; userName: string; participantId: string; content: string; attachment: ChatMessage["attachment"]; threadId?: string }) {
  const target = await query<{ id: string }>(`SELECT u.id FROM users u JOIN memberships m ON m.user_id = u.id WHERE u.id = $1 AND u.account_status <> 'suspended' AND m.organization_id = $2 AND m.status = 'active'`, [input.participantId, input.organizationId]);
  if (!target.rows[0]) throw new ChatStoreError("This person is not in your workspace.", 403);
  if (input.participantId === input.userId) throw new ChatStoreError("Select another member to start a conversation.", 400);

  const result = await withTransaction(async (client) => {
    let thread: ThreadRow | undefined;
    if (input.threadId) {
      const found = await client.query<ThreadRow>(`SELECT t.id, t.organization_id AS "organizationId", t.created_by AS "createdBy", t.status, t.created_at AS "createdAt", t.updated_at AS "updatedAt", ARRAY_AGG(tm.user_id ORDER BY tm.user_id) AS participants FROM chat_threads t JOIN chat_thread_members tm ON tm.thread_id = t.id WHERE t.id = $1 AND t.organization_id = $2 AND EXISTS (SELECT 1 FROM chat_thread_members m WHERE m.thread_id = t.id AND m.user_id = $3) GROUP BY t.id`, [input.threadId, input.organizationId, input.userId]);
      thread = found.rows[0];
      if (!thread || !thread.participants.includes(input.participantId)) throw new ChatStoreError("Conversation not found.", 404);
    } else {
      const found = await client.query<ThreadRow>(`SELECT t.id, t.organization_id AS "organizationId", t.created_by AS "createdBy", t.status, t.created_at AS "createdAt", t.updated_at AS "updatedAt", ARRAY_AGG(tm.user_id ORDER BY tm.user_id) AS participants FROM chat_threads t JOIN chat_thread_members tm ON tm.thread_id = t.id WHERE t.organization_id = $1 AND EXISTS (SELECT 1 FROM chat_thread_members a WHERE a.thread_id = t.id AND a.user_id = $2) AND EXISTS (SELECT 1 FROM chat_thread_members b WHERE b.thread_id = t.id AND b.user_id = $3) GROUP BY t.id ORDER BY t.updated_at DESC LIMIT 1`, [input.organizationId, input.userId, input.participantId]);
      thread = found.rows[0];
    }
    const now = new Date().toISOString();
    if (!thread) {
      const id = makeId("chat");
      await client.query(`INSERT INTO chat_threads (id, organization_id, created_by, status, created_at, updated_at) VALUES ($1,$2,$3,'pending',$4,$4)`, [id, input.organizationId, input.userId, now]);
      await client.query(`INSERT INTO chat_thread_members (thread_id, organization_id, user_id) VALUES ($1,$2,$3),($1,$2,$4)`, [id, input.organizationId, input.userId, input.participantId]);
      thread = { id, organizationId: input.organizationId, createdBy: input.userId, status: "pending", createdAt: now, updatedAt: now, participants: [input.userId, input.participantId] };
    }
    const message: ChatMessage = { id: makeId("msg"), threadId: thread.id, organizationId: input.organizationId, senderId: input.userId, senderName: input.userName, content: input.content || "Shared a file", attachment: input.attachment, createdAt: now, status: "sent" };
    await client.query(`INSERT INTO chat_messages (id, thread_id, organization_id, sender_id, sender_name, content, attachment, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [message.id, message.threadId, message.organizationId, message.senderId, message.senderName, message.content, message.attachment ? JSON.stringify(message.attachment) : null, message.status, now]);
    await client.query(`UPDATE chat_threads SET updated_at = $1, status = CASE WHEN status = 'rejected' THEN 'active' ELSE status END WHERE id = $2`, [now, thread.id]);
    return { thread: { ...thread, updatedAt: now, status: thread.status === "rejected" ? "active" : thread.status }, message };
  });
  return result;
}
