import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  buildSystemPrompt,
  getChatTools,
  mapToolCallToEngineResult,
} from "@/lib/chatbot/ai-tools";
import type {
  ChatApiRequest,
  ChatApiResponse,
  ChatMessage,
} from "@/lib/chatbot/types";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorResponse(error: string, status = 200): NextResponse<ChatApiResponse> {
  return NextResponse.json({
    messages: [
      {
        id: makeId(),
        role: "bot" as const,
        content: error,
        timestamp: Date.now(),
        type: "text" as const,
      },
    ],
    newState: { phase: "idle" as const, pendingAction: null },
    error,
  }, { status });
}

export async function POST(req: Request) {
  // Auth check
  const session = await getServerSession();
  if (!session) {
    return errorResponse("Please log in to use the assistant.", 401);
  }

  // Check for API key
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return errorResponse("AI assistant is not configured. Please set up the GROQ_API_KEY.");
  }

  // Parse request
  let body: ChatApiRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request.");
  }

  const { message, conversationState, history } = body;

  if (!message || typeof message !== "string") {
    return errorResponse("Please enter a message.");
  }

  try {
    const groq = createGroq({ apiKey });

    // Build messages for the AI
    const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildSystemPrompt() },
    ];

    // Add conversation history for context
    if (history && history.length > 0) {
      for (const msg of history.slice(-10)) {
        aiMessages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Add context about current conversation state if relevant
    if (conversationState.phase === "awaiting_fields" && conversationState.pendingAction) {
      const action = conversationState.pendingAction;
      const existingParams = Object.entries(action.params)
        .filter(([, v]) => v && v.trim() !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const missing = action.missingFields?.join(", ") ?? "";

      aiMessages.push({
        role: "system",
        content: `The user is providing additional fields for a ${action.type} action. Already collected: ${existingParams || "none"}. Still needed: ${missing}. Merge the user's response with existing fields and call the appropriate tool with ALL fields (existing + new).`,
      });
    }

    // Add the current user message
    aiMessages.push({ role: "user", content: message });

    // Call Groq via Vercel AI SDK
    const result = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      messages: aiMessages,
      tools: getChatTools(),
      temperature: 0.3,
      maxOutputTokens: 500,
    });

    // Process result
    const toolCalls = result.toolCalls;

    if (toolCalls && toolCalls.length > 0) {
      const firstCall = toolCalls[0];
      if (firstCall) {
        const engineResult = mapToolCallToEngineResult(
          firstCall.toolName,
          firstCall.input as Record<string, string | undefined>,
          conversationState,
        );

        // If we're in awaiting_fields phase and the AI returned a create_ tool,
        // merge with existing params
        if (
          conversationState.phase === "awaiting_fields" &&
          conversationState.pendingAction &&
          engineResult.newState.pendingAction
        ) {
          const mergedParams = {
            ...conversationState.pendingAction.params,
            ...engineResult.newState.pendingAction.params,
          };
          engineResult.newState.pendingAction.params = mergedParams;

          // Re-check if we need to rebuild confirmation with merged params
          if (engineResult.newState.phase === "awaiting_confirmation") {
            // Update the confirmation message with merged params
            const confirmMsg = engineResult.messages[0];
            if (confirmMsg && confirmMsg.actionData) {
              confirmMsg.actionData.params = mergedParams;
            }
          }
        }

        const response: ChatApiResponse = {
          messages: engineResult.messages,
          newState: engineResult.newState,
        };
        return NextResponse.json(response);
      }
    }

    // If no tool call, return text response
    const textContent = result.text || "I'm not sure how to help with that. Try asking a question about the app or asking me to create something.";

    const botMsg: ChatMessage = {
      id: makeId(),
      role: "bot",
      content: textContent,
      timestamp: Date.now(),
      type: "text",
    };

    const response: ChatApiResponse = {
      messages: [botMsg],
      newState: { phase: "idle", pendingAction: null },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Chat API error:", err);

    // Handle rate limiting
    if (err instanceof Error && err.message.includes("rate")) {
      return errorResponse("I'm a bit busy right now. Please try again in a moment.");
    }

    return errorResponse("Something went wrong. Please try again.");
  }
}
