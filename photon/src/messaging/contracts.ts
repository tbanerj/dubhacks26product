export type MessageChannel = "imessage" | "demo";
export type ProgressSource = "demo" | "live";

export interface MessageRoute {
  servingLine?: string;
  providerConversationRef: string;
}

export interface IncomingAttachment {
  attachmentId: string;
  declaredMimeType?: string;
  declaredSizeBytes?: number;
  originalName?: string;
  bytes?: Uint8Array;
  rejected?: "too_large" | "unreadable";
}

export interface IncomingMessage {
  channel: MessageChannel;
  projectScope: string;
  messageId: string;
  senderId: string;
  receivedAt: string;
  text?: string;
  attachments: IncomingAttachment[];
  route: MessageRoute;
  /** Honored only when the runtime allows demo scenarios. Never set by the live adapter. */
  verifierScenario?: "success" | "mismatch" | "unavailable";
}

export interface OutboxItem {
  operationKey: string;
  conversationId: string;
  text: string;
  route: MessageRoute;
}

export interface StageResult {
  replies: OutboxItem[];
  submissionId?: string;
  duplicate: boolean;
}
