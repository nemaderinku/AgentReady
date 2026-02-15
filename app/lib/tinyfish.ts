/**
 * TinyFish API wrapper
 * Handles SSE streaming calls to the TinyFish web agent API.
 */

const TINYFISH_API_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

export interface TinyFishRequest {
  url: string;
  goal: string;
  proxy_config?: {
    enabled: boolean;
  };
}

export interface TinyFishEvent {
  type: string; // "ACTION" | "STEP" | "COMPLETE" | "ERROR" | "STREAMING_URL" and others
  status?: string;
  message?: string;
  resultJson?: Record<string, unknown>;
  result?: string;
  streamingUrl?: string; // Live browser preview URL (embeddable in iframe)
  streaming_url?: string; // Alternative field name
  step?: number;
  totalSteps?: number;
}

/**
 * Calls TinyFish API and returns the final result.
 * Parses SSE stream and extracts the COMPLETE event's resultJson.
 */
export async function runTinyFishAgent(
  request: TinyFishRequest
): Promise<{ success: boolean; data: Record<string, unknown> | null; streamingUrl?: string | null; error?: string }> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return { success: false, data: null, streamingUrl: null, error: "TINYFISH_API_KEY not set" };
  }

  try {
    const response = await fetch(TINYFISH_API_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: request.url,
        goal: request.goal,
        proxy_config: request.proxy_config || { enabled: false },
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `TinyFish API returned ${response.status}: ${response.statusText}`,
      };
    }

    if (!response.body) {
      return { success: false, data: null, error: "No response body" };
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: Record<string, unknown> | null = null;
    let lastMessage = "";
    let streamingUrl: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const events = buffer.split("\n\n");
      buffer = events.pop() || ""; // Keep incomplete event in buffer

      for (const eventBlock of events) {
        const lines = eventBlock.split("\n");
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            eventData += line.slice(6);
          } else if (line.startsWith("data:")) {
            eventData += line.slice(5);
          }
        }

        if (!eventData) continue;

        try {
          const parsed: TinyFishEvent = JSON.parse(eventData);

          if (parsed.message) {
            lastMessage = parsed.message;
          }

          // Capture live browser preview URL
          if (parsed.streamingUrl || parsed.streaming_url) {
            streamingUrl = parsed.streamingUrl || parsed.streaming_url || null;
          }
          // Also check for streaming_url event type
          if (parsed.type === "STREAMING_URL" || parsed.type === "streaming_url") {
            streamingUrl = parsed.streamingUrl || parsed.streaming_url || parsed.message || null;
          }

          if (parsed.type === "COMPLETE" && parsed.status === "COMPLETED") {
            if (parsed.resultJson) {
              finalResult = parsed.resultJson;
            } else if (parsed.result) {
              // Try to parse result string as JSON
              try {
                finalResult = JSON.parse(parsed.result);
              } catch {
                // If result isn't JSON, wrap it
                finalResult = { raw_result: parsed.result };
              }
            }
          }

          if (parsed.type === "ERROR") {
            return {
              success: false,
              data: null,
              streamingUrl,
              error: parsed.message || "TinyFish agent error",
            };
          }
        } catch {
          // Not valid JSON, skip
        }
      }
    }

    if (finalResult) {
      return { success: true, data: finalResult, streamingUrl };
    }

    // If no structured result, return last message
    return {
      success: true,
      data: { raw_result: lastMessage || "Agent completed but returned no structured data" },
      streamingUrl,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      streamingUrl: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calls TinyFish API with a streaming callback for real-time updates.
 * Used to push events to the client via SSE as the agent works.
 */
export async function runTinyFishAgentWithStream(
  request: TinyFishRequest,
  onEvent: (event: TinyFishEvent) => void
): Promise<{ success: boolean; data: Record<string, unknown> | null; error?: string }> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return { success: false, data: null, error: "TINYFISH_API_KEY not set" };
  }

  try {
    const response = await fetch(TINYFISH_API_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: request.url,
        goal: request.goal,
        proxy_config: request.proxy_config || { enabled: false },
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `TinyFish API returned ${response.status}: ${response.statusText}`,
      };
    }

    if (!response.body) {
      return { success: false, data: null, error: "No response body" };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: Record<string, unknown> | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const eventBlock of events) {
        const lines = eventBlock.split("\n");
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            eventData += line.slice(6);
          } else if (line.startsWith("data:")) {
            eventData += line.slice(5);
          }
        }

        if (!eventData) continue;

        try {
          const parsed: TinyFishEvent = JSON.parse(eventData);
          onEvent(parsed); // Forward to caller

          if (parsed.type === "COMPLETE" && parsed.status === "COMPLETED") {
            if (parsed.resultJson) {
              finalResult = parsed.resultJson;
            } else if (parsed.result) {
              try {
                finalResult = JSON.parse(parsed.result);
              } catch {
                finalResult = { raw_result: parsed.result };
              }
            }
          }

          if (parsed.type === "ERROR") {
            return {
              success: false,
              data: null,
              error: parsed.message || "TinyFish agent error",
            };
          }
        } catch {
          // Skip unparseable events
        }
      }
    }

    if (finalResult) {
      return { success: true, data: finalResult };
    }

    return {
      success: true,
      data: { raw_result: "Agent completed with no structured data" },
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
