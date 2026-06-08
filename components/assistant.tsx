"use client";
import React from "react";
import Chat from "./chat";
import ConversationSidebar from "./conversation-sidebar";
import useConversationStore, {
  createInitialChatMessages,
} from "@/stores/useConversationStore";
import { Item, processMessages } from "@/lib/assistant";
import useToolsStore from "@/stores/useToolsStore";

export default function Assistant() {
  const {
    activeConversationId,
    conversations,
    chatMessages,
    conversationItems,
    isAssistantLoading,
    isConversationListLoading,
    isConversationLoading,
    addChatMessage,
    setActiveConversationId,
    setActiveStreamConversationId,
    setConversations,
    setConversationListLoading,
    setConversationLoading,
    setChatMessages,
    setConversationItems,
    setAssistantLoading,
  } = useConversationStore();
  const toolsState = useToolsStore();

  const refreshConversations = React.useCallback(async () => {
    setConversationListLoading(true);
    try {
      const response = await fetch("/api/conversations");
      if (!response.ok) return;
      const { conversations: nextConversations } = await response.json();
      setConversations(nextConversations || []);
    } finally {
      setConversationListLoading(false);
    }
  }, [setConversationListLoading, setConversations]);

  const loadConversation = React.useCallback(
    async (conversationId: string) => {
      setConversationLoading(true);
      setAssistantLoading(false);
      try {
        const response = await fetch(`/api/conversations/${conversationId}`);
        if (!response.ok) return;
        const { conversation } = await response.json();
        setActiveConversationId(conversation.id);
        setChatMessages(
          Array.isArray(conversation.chat_messages) &&
            conversation.chat_messages.length > 0
            ? conversation.chat_messages
            : createInitialChatMessages()
        );
        setConversationItems(
          Array.isArray(conversation.conversation_items)
            ? conversation.conversation_items
            : []
        );
      } finally {
        setConversationLoading(false);
      }
    },
    [
      setActiveConversationId,
      setAssistantLoading,
      setChatMessages,
      setConversationItems,
      setConversationLoading,
    ]
  );

  React.useEffect(() => {
    let cancelled = false;

    const loadInitialConversation = async () => {
      setConversationListLoading(true);
      try {
        const listResponse = await fetch("/api/conversations");
        if (!listResponse.ok || cancelled) return;
        const { conversations: nextConversations } = await listResponse.json();
        const list = nextConversations || [];
        setConversations(list);
        const latest = list[0];
        if (!activeConversationId && latest?.id && !cancelled) {
          await loadConversation(latest.id);
        }
      } finally {
        if (!cancelled) setConversationListLoading(false);
      }
    };

    loadInitialConversation().catch((error) => {
      console.error("Error loading conversations:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeConversationId,
    loadConversation,
    setConversationListLoading,
    setConversations,
  ]);

  const createConversation = async () => {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: toolsState.selectedModel,
        toolsState,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to create conversation");
    }
    const { conversation } = await response.json();
    await refreshConversations();
    await loadConversation(conversation.id);
    return conversation.id as string;
  };

  const ensureConversation = async () => {
    if (activeConversationId) return activeConversationId;
    return createConversation();
  };

  const handleNewConversation = async () => {
    if (isAssistantLoading) return;
    try {
      await createConversation();
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    if (conversationId === activeConversationId || isAssistantLoading) return;
    await loadConversation(conversationId);
  };

  const handleRenameConversation = async (
    conversationId: string,
    title: string
  ) => {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (response.ok) await refreshConversations();
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (isAssistantLoading) return;
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    await refreshConversations();
    if (conversationId === activeConversationId) {
      const remaining = conversations.filter((item) => item.id !== conversationId);
      const next = remaining[0];
      if (next) {
        await loadConversation(next.id);
      } else {
        setActiveConversationId(null);
        setChatMessages(createInitialChatMessages());
        setConversationItems([]);
      }
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isAssistantLoading || isConversationLoading) return;

    const userItem: Item = {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: message.trim() }],
    };
    const userMessage: any = {
      role: "user",
      content: message.trim(),
    };

    try {
      const conversationId = await ensureConversation();
      const nextConversationItems = [...conversationItems, userMessage];
      setActiveStreamConversationId(conversationId);
      setAssistantLoading(true);
      setConversationItems(nextConversationItems);
      addChatMessage(userItem);
      await processMessages(nextConversationItems, conversationId);
      await refreshConversations();
    } catch (error) {
      console.error("Error processing message:", error);
    } finally {
      setActiveStreamConversationId(null);
      setAssistantLoading(false);
    }
  };

  const handleApprovalResponse = async (approve: boolean, id: string) => {
    const approvalItem = {
      type: "mcp_approval_response",
      approve,
      approval_request_id: id,
    } as any;
    try {
      const conversationId = await ensureConversation();
      const nextConversationItems = [...conversationItems, approvalItem];
      setActiveStreamConversationId(conversationId);
      setAssistantLoading(true);
      setConversationItems(nextConversationItems);
      await processMessages(nextConversationItems, conversationId);
      await refreshConversations();
    } catch (error) {
      console.error("Error sending approval response:", error);
    } finally {
      setActiveStreamConversationId(null);
      setAssistantLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-white">
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        loading={isConversationListLoading}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onArchiveConversation={handleArchiveConversation}
      />
      <div className="min-w-0 flex-1 p-4">
        <Chat
          items={chatMessages}
          onSendMessage={handleSendMessage}
          onApprovalResponse={handleApprovalResponse}
          disabled={isConversationLoading}
        />
      </div>
    </div>
  );
}
