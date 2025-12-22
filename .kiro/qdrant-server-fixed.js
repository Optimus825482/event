#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { QdrantClient } from "@qdrant/js-client-rest";

// Qdrant client initialization
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || "kiro_memory";

const client = new QdrantClient({ url: QDRANT_URL });

// Collection'ı başlat
async function initializeCollection() {
  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME
    );

    if (!exists) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1536,
          distance: "Cosine",
        },
      });
      console.error(`✓ Collection '${COLLECTION_NAME}' created`);
    }
  } catch (error) {
    console.error("Collection init error:", error.message);
  }
}

// Simple embedding function
function simpleHash(text) {
  const hash = Array.from(text).reduce((acc, char, i) => {
    return acc + char.charCodeAt(0) * (i + 1);
  }, 0);

  const vector = new Array(1536).fill(0).map((_, i) => {
    return Math.sin((hash * (i + 1)) / 1000) * Math.cos(hash / (i + 1));
  });

  return vector;
}

// MCP Server
const server = new Server(
  {
    name: "qdrant-memory-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "mem_store",
        description:
          "Store information in Qdrant memory with semantic search capability",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Content to store in memory",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags for categorization",
            },
            metadata: {
              type: "object",
              description: "Optional metadata",
            },
          },
          required: ["content"],
        },
      },
      {
        name: "mem_search",
        description: "Search memory using semantic similarity",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
            limit: {
              type: "number",
              description: "Max results to return",
              default: 5,
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Filter by tags",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "mem_list",
        description: "List all memories with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Filter by tags",
            },
            limit: {
              type: "number",
              description: "Max results",
              default: 10,
            },
          },
        },
      },
      {
        name: "mem_delete",
        description: "Delete a memory by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Memory ID to delete",
            },
          },
          required: ["id"],
        },
      },
    ],
  };
});

// Tool execution handler - FIXED: args null safety
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // DEBUG LOG
  console.error(
    "DEBUG request.params:",
    JSON.stringify(request.params, null, 2)
  );

  const { name, arguments: args = {} } = request.params;
  const safeArgs = args || {};

  console.error("DEBUG name:", name);
  console.error("DEBUG safeArgs:", JSON.stringify(safeArgs, null, 2));

  try {
    switch (name) {
      case "mem_store": {
        const content = safeArgs.content;
        const tags = safeArgs.tags || [];
        const metadata = safeArgs.metadata || {};

        if (!content) {
          throw new Error("content is required");
        }

        // Qdrant için UUID formatında ID oluştur
        const id = crypto.randomUUID();
        const vector = simpleHash(content);

        console.error("DEBUG: Attempting upsert with id:", id);

        await client.upsert(COLLECTION_NAME, {
          points: [
            {
              id: id,
              vector: vector,
              payload: {
                content: content,
                tags: tags,
                metadata: metadata,
                timestamp: new Date().toISOString(),
              },
            },
          ],
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  id: id,
                  message: "Memory stored successfully",
                  content: content,
                  tags: tags,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "mem_search": {
        const query = safeArgs.query;
        const limit = safeArgs.limit || 5;
        const tags = safeArgs.tags || [];

        if (!query) {
          throw new Error("query is required");
        }

        const queryVector = simpleHash(query);

        const filter =
          tags.length > 0
            ? {
                must: [
                  {
                    key: "tags",
                    match: { any: tags },
                  },
                ],
              }
            : undefined;

        const searchResult = await client.search(COLLECTION_NAME, {
          vector: queryVector,
          limit: limit,
          filter: filter,
        });

        const results = searchResult.map((hit) => ({
          id: hit.id,
          score: hit.score,
          content: hit.payload.content,
          tags: hit.payload.tags,
          timestamp: hit.payload.timestamp,
          metadata: hit.payload.metadata,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  query: query,
                  results_count: results.length,
                  results: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "mem_list": {
        const tags = safeArgs.tags || [];
        const limit = safeArgs.limit || 10;

        const filter =
          tags.length > 0
            ? {
                must: [
                  {
                    key: "tags",
                    match: { any: tags },
                  },
                ],
              }
            : undefined;

        const scrollResult = await client.scroll(COLLECTION_NAME, {
          filter: filter,
          limit: limit,
          with_payload: true,
          with_vector: false,
        });

        const results = scrollResult.points.map((point) => ({
          id: point.id,
          content: point.payload.content,
          tags: point.payload.tags,
          timestamp: point.payload.timestamp,
          metadata: point.payload.metadata,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  count: results.length,
                  memories: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "mem_delete": {
        const id = safeArgs.id;

        if (!id) {
          throw new Error("id is required");
        }

        await client.delete(COLLECTION_NAME, {
          points: [id],
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Memory ${id} deleted successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  await initializeCollection();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Qdrant Memory MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
