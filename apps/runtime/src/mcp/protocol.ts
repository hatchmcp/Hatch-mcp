import type { McpConfig } from '@hatchmcp/shared'
import { executeToolCall } from '@hatchmcp/exec'
import { logger } from '../lib/logger.js'

export const MCP_PROTOCOL_VERSION = '2024-11-05'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function err(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

// Handles a single MCP JSON-RPC message and returns the response.
// Session state (initialized flag, subscriptions) is owned by the transport layer.
export async function handleMcpMessage(
  request: JsonRpcRequest,
  config: McpConfig,
  secrets: Record<string, string>,
  subdomain: string
): Promise<JsonRpcResponse> {
  const { method, id, params } = request
  const log = logger.child({ subdomain, method, id })

  switch (method) {
    case 'initialize': {
      log.info('MCP initialize')
      return ok(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: config.server_name,
          version: '1.0.0',
        },
      })
    }

    case 'notifications/initialized':
      // Client acknowledgement — no response body needed
      return ok(id, null)

    case 'tools/list': {
      const tools = config.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema,
      }))
      return ok(id, { tools })
    }

    case 'tools/call': {
      const toolName = params?.['name'] as string | undefined
      const toolInput = (params?.['arguments'] ?? {}) as Record<string, unknown>

      if (!toolName) return err(id, -32602, 'Missing tool name')

      const tool = config.tools.find((t) => t.name === toolName)
      if (!tool) return err(id, -32602, `Unknown tool: ${toolName}`)

      log.info('Tool call', { tool: toolName })

      try {
        const result = await executeToolCall(tool, toolInput, config, secrets)

        if (!result.success) {
          const errorMsg = typeof result.data === 'object' && result.data !== null
            ? JSON.stringify(result.data)
            : `HTTP ${result.statusCode}`

          return ok(id, {
            content: [{ type: 'text', text: errorMsg }],
            isError: true,
          })
        }

        const text = typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data)

        return ok(id, {
          content: [{ type: 'text', text }],
        })
      } catch (callErr) {
        log.error('Tool call error', { tool: toolName, err: String(callErr) })
        return err(id, -32603, String(callErr))
      }
    }

    case 'ping':
      return ok(id, {})

    default:
      return err(id, -32601, `Method not found: ${method}`)
  }
}
