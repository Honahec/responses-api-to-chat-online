"use client";

import React from "react";
import { Archive, Edit3, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationSummary } from "@/stores/useConversationStore";
import { cn } from "@/lib/utils";

type ConversationSidebarProps = {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  loading: boolean;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onArchiveConversation: (id: string) => void;
};

export default function ConversationSidebar({
  conversations,
  activeConversationId,
  loading,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onArchiveConversation,
}: ConversationSidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-stone-200 bg-stone-50">
      <div className="flex h-14 items-center gap-2 border-b border-stone-200 px-3">
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          onClick={onNewConversation}
        >
          <Plus className="size-4" />
          New chat
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="px-3 py-2 text-sm text-stone-500">Loading chats...</div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-2 text-sm text-stone-500">No chats yet.</div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group flex h-10 items-center gap-1 rounded-md px-2",
                  activeConversationId === conversation.id
                    ? "bg-white shadow-sm"
                    : "hover:bg-white"
                )}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                  onClick={() => onSelectConversation(conversation.id)}
                  title={conversation.title}
                >
                  <MessageSquare className="size-4 shrink-0 text-stone-500" />
                  <span className="truncate">{conversation.title}</span>
                </button>
                <button
                  className="hidden size-7 items-center justify-center rounded text-stone-500 hover:bg-stone-100 group-hover:flex"
                  title="Rename"
                  onClick={() => {
                    const title = window.prompt("Rename chat", conversation.title);
                    if (title?.trim()) {
                      onRenameConversation(conversation.id, title.trim());
                    }
                  }}
                >
                  <Edit3 className="size-4" />
                </button>
                <button
                  className="hidden size-7 items-center justify-center rounded text-stone-500 hover:bg-stone-100 group-hover:flex"
                  title="Archive"
                  onClick={() => onArchiveConversation(conversation.id)}
                >
                  <Archive className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

