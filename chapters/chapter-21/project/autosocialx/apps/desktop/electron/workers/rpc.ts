// JSON-RPC 2.0 types for Main ↔ Worker process communication

export interface JsonRpcRequest<P = unknown> {
  jsonrpc: '2.0'
  method: string
  params: P
  id: string | number
}

export interface JsonRpcSuccess<R = unknown> {
  jsonrpc: '2.0'
  id: string | number
  result: R
}

export interface JsonRpcError {
  jsonrpc: '2.0'
  id: string | number
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export type JsonRpcResponse<R = unknown> = JsonRpcSuccess<R> | JsonRpcError

export function isRpcError<R>(res: JsonRpcResponse<R>): res is JsonRpcError {
  return 'error' in res
}

export const RPC_ERROR_CODES = {
  PARSE_ERROR:      -32700,
  INVALID_REQUEST:  -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS:   -32602,
  INTERNAL_ERROR:   -32603,
} as const
