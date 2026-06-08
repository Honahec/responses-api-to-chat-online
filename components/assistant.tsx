"use client";
import React from "react";
import Chat from "./chat";
import useConversationStore from "@/stores/useConversationStore";
import { Item, processMessages } from "@/lib/assistant";
import useToolsStore from "@/stores/useToolsStore";

export default function Assistant() {
  const {
    activeConversationId,
    chatMessages,
    conversationItems,
    isAssistantLoading,
    addChatMessage,
    setActiveConversationId,
    setChatMessages,
    setConversationItems,
    setAssistantLoading,
  } =
    useConversationStore();
  const toolsState = useToolsStore();

  React.useEffect(() => {
    if (activeConversationId) return;

    let cancelled = false;
    const loadLatestConversation = async () => {
      const listResponse = await fetch("/api/conversations");
      if (!listResponse.ok) return;
      const { conversations } = await listResponse.json();
      const latest = conversations?.[0];
      if (!latest?.id || cancelled) return;

      const conversationResponse = await fetch(`/api/conversations/${latest.id}`);
      if (!conversationResponse.ok || cancelled) return;
      const { conversation } = await conversationResponse.json();
      setActiveConversationId(conversation.id);
      if (Array.isArray(conversation.chat_messages) && conversation.chat_messages.length > 0) {
        setChatMessages(conversation.chat_messages);
      }
      if (Array.isArray(conversation.conversation_items)) {
        setConversationItems(conversation.conversation_items);
      }
    };

    loadLatestConversation().catch((error) => {
      console.error("Error loading latest conversation:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeConversationId,
    setActiveConversationId,
    setChatMessages,
    setConversationItems,
  ]);

  const ensureConversation = async () => {
    if (activeConversationId) return activeConversationId;

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
    setActiveConversationId(conversation.id);
    return conversation.id as string;
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isAssistantLoading) return;

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
      await ensureConversation();
      const nextConversationItems = [...conversationItems, userMessage];
      setAssistantLoading(true);
      setConversationItems(nextConversationItems);
      addChatMessage(userItem);
      await processMessages(nextConversationItems);
    } catch (error) {
      console.error("Error processing message:", error);
    }
  };

  const handleApprovalResponse = async (
    approve: boolean,
    id: string
  ) => {
    const approvalItem = {
      type: "mcp_approval_response",
      approve,
      approval_request_id: id,
    } as any;
    try {
      await ensureConversation();
      const nextConversationItems = [...conversationItems, approvalItem];
      setConversationItems(nextConversationItems);
      await processMessages(nextConversationItems);
    } catch (error) {
      console.error("Error sending approval response:", error);
    }
  };

  return (
    <div className="h-full p-4 w-full bg-white">
      <Chat
        items={chatMessages}
        onSendMessage={handleSendMessage}
        onApprovalResponse={handleApprovalResponse}
      />
    </div>
  );
}
