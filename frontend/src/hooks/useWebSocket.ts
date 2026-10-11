import { useEffect, useRef, useState } from 'react'

/** Auto-reconnecting WebSocket hook. Calls `onMessage` for each parsed JSON message. */
export function useWebSocket<T = unknown>(
  url: string | null,
  onMessage: (msg: T) => void,
  options: { enabled?: boolean; maxRetries?: number } = {},
): { connected: boolean; retry: () => void } {
  const { enabled = true, maxRetries = 10 } = options
  const [connected, setConnected] = useState(false)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const retryCount = useRef(0)
  const shouldRun = useRef(enabled)

  const connect = useRef<(() => void) | null>(null)

  const retry = (): void => {
    retryCount.current = 0
    connect.current?.()
  }

  useEffect(() => {
    shouldRun.current = enabled
    if (!url || !enabled) {
      setConnected(false)
      return
    }

    let ws: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let closed = false

    const doConnect = (): void => {
      if (closed || !shouldRun.current) return
      try {
        ws = new WebSocket(url)
      } catch {
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        retryCount.current = 0
        setConnected(true)
      }
      ws.onclose = () => {
        setConnected(false)
        scheduleReconnect()
      }
      ws.onerror = () => {
        ws?.close()
      }
      ws.onmessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(String(event.data)) as T
          onMessageRef.current(parsed)
        } catch {
          // ignore non-JSON frames
        }
      }
    }

    const scheduleReconnect = (): void => {
      if (closed || !shouldRun.current) return
      if (retryCount.current >= maxRetries) return
      const delay = Math.min(1000 * 2 ** retryCount.current, 15000)
      retryCount.current += 1
      timer = setTimeout(doConnect, delay)
    }

    connect.current = doConnect
    doConnect()

    return () => {
      closed = true
      if (timer) clearTimeout(timer)
      ws?.close()
      setConnected(false)
    }
  }, [url, enabled, maxRetries])

  return { connected, retry }
}
