import { create } from "zustand";
import { Item } from "@/lib/assistant";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { INITIAL_MESSAGE } from "@/config/constants";

export type ConversationSummary = {
  id: string;
  title: string;
  model: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export function createInitialChatMessages(): Item[] {
  return [{
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text: INITIAL_MESSAGE }],
  }];
}

interface ConversationState {
  // Active server-side conversation id
  activeConversationId: string | null;
  activeStreamConversationId: string | null;
  conversations: ConversationSummary[];
  isConversationListLoading: boolean;
  isConversationLoading: boolean;
  // Items displayed in the chat
  chatMessages: Item[];
  // Items sent to the Responses API
  conversationItems: any[];
  // Whether we are waiting for the assistant response
  isAssistantLoading: boolean;

  setActiveConversationId: (id: string | null) => void;
  setActiveStreamConversationId: (id: string | null) => void;
  setConversations: (conversations: ConversationSummary[]) => void;
  setConversationListLoading: (loading: boolean) => void;
  setConversationLoading: (loading: boolean) => void;
  setChatMessages: (items: Item[]) => void;
  setConversationItems: (messages: any[]) => void;
  addChatMessage: (item: Item) => void;
  addConversationItem: (message: ChatCompletionMessageParam) => void;
  setAssistantLoading: (loading: boolean) => void;
  rawSet: (state: any) => void;
  resetConversation: () => void;
}

const useConversationStore = create<ConversationState>((set) => ({
  activeConversationId: null,
  activeStreamConversationId: null,
  conversations: [],
  isConversationListLoading: false,
  isConversationLoading: false,
  chatMessages: createInitialChatMessages(),
  conversationItems: [],
  isAssistantLoading: false,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setActiveStreamConversationId: (id) =>
    set({ activeStreamConversationId: id }),
  setConversations: (conversations) => set({ conversations }),
  setConversationListLoading: (loading) =>
    set({ isConversationListLoading: loading }),
  setConversationLoading: (loading) => set({ isConversationLoading: loading }),
  setChatMessages: (items) => set({ chatMessages: items }),
  setConversationItems: (messages) => set({ conversationItems: messages }),
  addChatMessage: (item) =>
    set((state) => ({ chatMessages: [...state.chatMessages, item] })),
  addConversationItem: (message) =>
    set((state) => ({
      conversationItems: [...state.conversationItems, message],
    })),
  setAssistantLoading: (loading) => set({ isAssistantLoading: loading }),
  rawSet: set,
  resetConversation: () =>
    set(() => ({
      chatMessages: createInitialChatMessages(),
      conversationItems: [],
      activeConversationId: null,
      activeStreamConversationId: null,
      isAssistantLoading: false,
    })),
}));

export default useConversationStore;
