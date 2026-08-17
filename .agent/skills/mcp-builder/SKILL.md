---
name: mcp-builder
description: >-
  Use this skill when developing, testing, or configuring Model Context Protocol (MCP)
  servers and tool integrations. Covers JSON-RPC protocol implementation, stdio/SSE transports,
  tool definitions with JSON schemas, resource providers, and client integration with Antigravity.
---

# MCP Server Development Skill

Guide for creating and maintaining Model Context Protocol (MCP) servers to extend AI agent capabilities.

---

## 1. Quickstart Architecture (TypeScript SDK)

Install official SDK:

```bash
npm install @modelcontextprotocol/sdk zod
```

### Server Implementation (`src/server.ts`)

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const server = new Server(
  {
    name: "onthilab-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// 1. Define Tool List
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_exam_catalog",
        description:
          "Search available exams in OnThiLab catalog by subject or keyword",
        inputSchema: {
          type: "object",
          properties: {
            subject: {
              type: "string",
              description: "Subject code (e.g. PRF192, PRO192)",
            },
            query: { type: "string", description: "Search keywords" },
          },
        },
      },
    ],
  };
});

// 2. Handle Tool Invocation
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query_exam_catalog") {
    const { subject, query } = request.params.arguments as {
      subject?: string;
      query?: string;
    };
    // Fetch and return formatted results
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            results: [`Exam 1 (${subject})`, `Exam 2 (${subject})`],
          }),
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// 3. Connect Transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 2. Antigravity MCP Configuration (`mcp_config.json`)

To register the MCP server with Antigravity:

```json
{
  "mcpServers": {
    "onthilab": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

---

## 3. Best Practices

- **Explicit Schemas**: Always provide clear property descriptions in `inputSchema` so LLMs know how to call parameters accurately.
- **Graceful Error Handling**: Return actionable error messages in tool responses instead of crashing the server process.
- **Deterministic Output**: Prefer JSON or concise text formatting for tool results to minimize token consumption.
