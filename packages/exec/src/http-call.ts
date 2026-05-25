import axios, { type AxiosError } from 'axios'
import { substituteTemplate, substituteObject } from './template.js'
import { buildAuthHeaders, buildAuthQuery, buildAuthVars } from './auth-injector.js'
import { applyTransform } from './transform.js'
import type { McpTool, McpConfig } from '@hatchmcp/shared'

const REQUEST_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024

export interface ToolCallResult {
  success: boolean
  statusCode: number
  data: unknown
  latencyMs: number
}

export async function executeToolCall(
  tool: McpTool,
  inputs: Record<string, unknown>,
  config: McpConfig,
  secrets: Record<string, string>
): Promise<ToolCallResult> {
  const startMs = Date.now()

  const authVars = buildAuthVars(config.auth_config, secrets)
  const templateVars = {
    env: config.env,
    input: inputs,
    auth: authVars,
  }

  const url = substituteTemplate(tool.http.url_template, templateVars)

  const authHeaders = buildAuthHeaders(config.auth_config, authVars)
  const toolHeaders: Record<string, string> = {}
  if (tool.http.headers_template) {
    for (const [k, v] of Object.entries(tool.http.headers_template)) {
      toolHeaders[k] = substituteTemplate(v, templateVars)
    }
  }
  const headers = { ...authHeaders, ...toolHeaders }

  const authQuery = buildAuthQuery(config.auth_config, authVars)
  const toolQuery: Record<string, string> = {}
  if (tool.http.query_template) {
    for (const [k, v] of Object.entries(tool.http.query_template)) {
      toolQuery[k] = substituteTemplate(v, templateVars)
    }
  }
  const params = { ...authQuery, ...toolQuery }

  let data: unknown = undefined
  if (tool.http.body_template) {
    if (typeof tool.http.body_template === 'string') {
      data = substituteTemplate(tool.http.body_template, templateVars)
    } else {
      data = substituteObject(tool.http.body_template as Record<string, unknown>, templateVars)
    }
  }

  let statusCode = 0
  let responseData: unknown

  try {
    const response = await axios.request({
      method: tool.http.method,
      url,
      headers,
      params,
      data,
      timeout: REQUEST_TIMEOUT_MS,
      maxContentLength: MAX_RESPONSE_BYTES,
      validateStatus: () => true,
    })

    statusCode = response.status
    responseData = response.data
  } catch (err) {
    const axiosErr = err as AxiosError
    statusCode = axiosErr.response?.status ?? 0
    const latencyMs = Date.now() - startMs
    return {
      success: false,
      statusCode,
      data: { error: axiosErr.message },
      latencyMs,
    }
  }

  const latencyMs = Date.now() - startMs
  const success = tool.response.success_codes.includes(statusCode)
  const transformed = applyTransform(responseData, tool.response.transform)

  return { success, statusCode, data: transformed, latencyMs }
}
