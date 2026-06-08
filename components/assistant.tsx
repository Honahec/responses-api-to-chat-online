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
    addConversationItem,
    addChatMessage,
    setActiveConversationId,
    setAssistantLoading,
  } =
    useConversationStore();
  const toolsState = useToolsStore();

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
    if (!message.trim()) return;

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
      setAssistantLoading(true);
      addConversationItem(userMessage);
      addChatMessage(userItem);
      await processMessages();
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
      addConversationItem(approvalItem);
      await processMessages();
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
