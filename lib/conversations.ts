import { MODEL } from "@/config/constants";
import { query } from "@/lib/db";

export type ConversationSummary = {
  id: string;
  title: string;
  model: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ConversationState = ConversationSummary & {
  tools_state: unknown;
  chat_messages: unknown[];
  conversation_items: unknown[];
};

type ConversationRow = {
  id: string;
  title: string;
  model: string;
  tools_state: unknown;
  chat_messages: unknown[];
  conversation_items: unknown[];
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export async function listConversations(userId: string) {
  const result = await query<ConversationSummary>(
    `select id, title, model, archived, created_at, updated_at
     from conversations
     where user_id = $1 and archived = false
     order by updated_at desc`,
    [userId]
  );
  return result.rows;
}

export async function createConversation({
  userId,
  title = "New chat",
  model = MODEL,
  toolsState = {},
}: {
  userId: string;
  title?: string;
  model?: string;
  toolsState?: unknown;
}) {
  const result = await query<ConversationRow>(
    `insert into conversations (user_id, title, model, tools_state)
     values ($1, $2, $3, $4)
     returning id, title, model, tools_state, chat_messages, conversation_items, archived, created_at, updated_at`,
    [userId, title, model, JSON.stringify(toolsState)]
  );
  return result.rows[0];
}

export async function getConversation(userId: string, conversationId: string) {
  const result = await query<ConversationRow>(
    `select id, title, model, tools_state, chat_messages, conversation_items, archived, created_at, updated_at
     from conversations
     where id = $1 and user_id = $2
     limit 1`,
    [conversationId, userId]
  );
  return result.rows[0] ?? null;
}

export async function updateConversation({
  userId,
  conversationId,
  title,
  archived,
}: {
  userId: string;
  conversationId: string;
  title?: string;
  archived?: boolean;
}) {
  const result = await query<ConversationRow>(
    `update conversations
     set
       title = coalesce($3, title),
       archived = coalesce($4, archived),
       updated_at = now()
     where id = $1 and user_id = $2
     returning id, title, model, tools_state, chat_messages, conversation_items, archived, created_at, updated_at`,
    [conversationId, userId, title ?? null, archived ?? null]
  );
  return result.rows[0] ?? null;
}

export async function saveConversationState({
  userId,
  conversationId,
  model,
  toolsState,
  chatMessages,
  conversationItems,
}: {
  userId: string;
  conversationId: string;
  model: string;
  toolsState: unknown;
  chatMessages: unknown[];
  conversationItems: unknown[];
}) {
  const result = await query<ConversationRow>(
    `update conversations
     set
       model = $3,
       tools_state = $4,
       chat_messages = $5,
       conversation_items = $6,
       updated_at = now()
     where id = $1 and user_id = $2
     returning id, title, model, tools_state, chat_messages, conversation_items, archived, created_at, updated_at`,
    [
      conversationId,
      userId,
      model,
      JSON.stringify(toolsState),
      JSON.stringify(chatMessages),
      JSON.stringify(conversationItems),
    ]
  );
  return result.rows[0] ?? null;
}
