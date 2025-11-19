import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPClient } from "./create-mcp-client";
import type { MCPServerConfig } from "app-types/mcp";

// Mock server-only modules
vi.mock("./pg-oauth-provider", () => ({
  PgOAuthClientProvider: vi.fn(),
}));

describe("MCPClient - Prompts Support", () => {
  let client: MCPClient;
  const mockConfig: MCPServerConfig = {
    url: "http://localhost:3000/mcp",
    headers: {},
  };

  beforeEach(() => {
    client = new MCPClient("test-id", "test-server", mockConfig);
  });

  describe("listPrompts", () => {
    it("should list available prompts from connected server", async () => {
      const mockClient = {
        listPrompts: vi.fn().mockResolvedValue({
          prompts: [
            {
              name: "code_review",
              description: "Review code and suggest improvements",
              arguments: [
                {
                  name: "code",
                  description: "Code to review",
                  required: true,
                },
                {
                  name: "language",
                  description: "Programming language",
                  required: false,
                },
              ],
            },
            {
              name: "summarize_docs",
              description: "Summarize documentation",
              arguments: [
                {
                  name: "url",
                  description: "Documentation URL",
                  required: true,
                },
              ],
            },
          ],
        }),
      };

      // @ts-ignore
      client["client"] = mockClient;
      // @ts-ignore
      client["isConnected"] = true;

      const prompts = await client.listPrompts();

      expect(prompts).toHaveLength(2);
      expect(prompts[0]).toMatchObject({
        name: "code_review",
        description: "Review code and suggest improvements",
      });
      expect(prompts[0].arguments).toHaveLength(2);
      expect(prompts[0].arguments?.[0].required).toBe(true);
      expect(mockClient.listPrompts).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when not connected", async () => {
      const prompts = await client.listPrompts();
      expect(prompts).toEqual([]);
    });

    it("should handle pagination with cursor", async () => {
      const mockClient = {
        listPrompts: vi.fn().mockResolvedValue({
          prompts: [
            {
              name: "prompt1",
              description: "Test prompt",
            },
          ],
          nextCursor: "page2",
        }),
      };

      // @ts-ignore
      client["client"] = mockClient;
      // @ts-ignore
      client["isConnected"] = true;

      const result = await client.listPrompts({ cursor: "page1" });

      expect(result).toHaveLength(1);
      expect(mockClient.listPrompts).toHaveBeenCalledWith({ cursor: "page1" });
    });

    it("should handle errors gracefully", async () => {
      const mockClient = {
        listPrompts: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };

      // @ts-ignore
      client["client"] = mockClient;
      // @ts-ignore
      client["isConnected"] = true;

      const prompts = await client.listPrompts();
      expect(prompts).toEqual([]);
    });
  });

  describe("getPrompt", () => {
    it("should retrieve prompt with arguments", async () => {
      const mockClient = {
        getPrompt: vi.fn().mockResolvedValue({
          description: "Code review prompt",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Please review this Python code:\ndef hello():\n  print('world')",
              },
            },
          ],
        }),
      };

      // @ts-ignore
      client["client"] = mockClient;
      // @ts-ignore
      client["isConnected"] = true;

      const prompt = await client.getPrompt("code_review", {
        code: "def hello(): print('world')",
        language: "python",
      });

      expect(prompt).toBeDefined();
      expect(prompt.messages).toHaveLength(1);
      expect(prompt.messages[0].role).toBe("user");
      expect(prompt.messages[0].content.text).toContain("Python code");
      expect(mockClient.getPrompt).toHaveBeenCalledWith({
        name: "code_review",
        arguments: {
          code: "def hello(): print('world')",
          language: "python",
        },
      });
    });

    it("should handle prompts without arguments", async () => {
      const mockClient = {
        getPrompt: vi.fn().mockResolvedValue({
          description: "Simple prompt",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Hello, how can I help?",
              },
            },
          ],
        }),
      };

      // @ts-ignore
      client["client"] = mockClient;
      // @ts-ignore
      client["isConnected"] = true;

      const prompt = await client.getPrompt("greeting");

      expect(prompt).toBeDefined();
      expect(prompt.messages).toHaveLength(1);
      expect(mockClient.getPrompt).toHaveBeenCalledWith({
        name: "greeting",
        arguments: undefined,
      });
    });

    it("should handle multi-message prompts", async () => {
      const mockClient = {
        getPrompt: vi.fn().mockResolvedValue({
          description: "Multi-turn conversation",
          messages: [
            {
              role: "user",
              content: { type: "text", text: "First message" },
            },
            {
              role: "assistant",
              content: { type: "text", text: "Response" },
            },
            {
              role: "user",
              content: { type: "text", text: "Follow-up" },
            },
          ],
        }),
      };

      // @ts-ignore
      client["client"] = mockClient;
      // @ts-ignore
      client["isConnected"] = true;

      const prompt = await client.getPrompt("conversation");

      expect(prompt.messages).toHaveLength(3);
      expect(prompt.messages[1].role).toBe("assistant");
    });

    it("should handle prompts with embedded resources", async () => {
      const mockClient = {
        getPrompt: vi.fn().mockResolvedValue({
          description: "Prompt with resource",
          messages: [
            {
              role: "user",
              content: {
                type: "resource",
                resource: {
                  uri: "file:///project/README.md",
                  text: "# Documentation",
                  mimeType: "text/markdown",
                },
              },
            },
          ],
        }),
      };

      // @ts-ignore
      client["client"] = mockClient;
      // @ts-ignore
      client["isConnected"] = true;

      const prompt = await client.getPrompt("doc_analysis");

      expect(prompt.messages[0].content.type).toBe("resource");
      expect(prompt.messages[0].content.resource.uri).toContain("README.md");
    });

    it("should return null when not connected", async () => {
      const prompt = await client.getPrompt("test");
      expect(prompt).toBeNull();
    });

    it("should handle prompt not found", async () => {
      const mockClient = {
        getPrompt: vi.fn().mockRejectedValue(new Error("Prompt not found")),
      };

      // @ts-ignore
      client["client"] = mockClient;
      // @ts-ignore
      client["isConnected"] = true;

      const prompt = await client.getPrompt("nonexistent");
      expect(prompt).toBeNull();
    });
  });
});
