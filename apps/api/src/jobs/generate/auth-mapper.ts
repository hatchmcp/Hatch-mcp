import type { McpAuthConfig } from '@hatchmcp/shared'

// Maps the auth type the user selected in the UI to a fully specified auth_config block
export function buildAuthConfig(authType: string): McpAuthConfig {
  switch (authType) {
    case 'bearer':
      return {
        type: 'bearer',
        header_name: 'Authorization',
        header_prefix: 'Bearer ',
        query_param: null,
        user_must_provide: ['token'],
      }

    case 'api_key_header':
      return {
        type: 'api_key_header',
        header_name: 'X-API-Key',
        header_prefix: null,
        query_param: null,
        user_must_provide: ['api_key'],
      }

    case 'api_key_query':
      return {
        type: 'api_key_query',
        header_name: null,
        header_prefix: null,
        query_param: 'api_key',
        user_must_provide: ['api_key'],
      }

    case 'basic':
      return {
        type: 'basic',
        header_name: 'Authorization',
        header_prefix: 'Basic ',
        query_param: null,
        user_must_provide: ['username', 'password'],
      }

    case 'oauth2_client_credentials':
      return {
        type: 'oauth2_client_credentials',
        header_name: null,
        header_prefix: null,
        query_param: null,
        user_must_provide: ['client_id', 'client_secret', 'token_url'],
      }

    default:
      return {
        type: 'none',
        header_name: null,
        header_prefix: null,
        query_param: null,
        user_must_provide: [],
      }
  }
}
