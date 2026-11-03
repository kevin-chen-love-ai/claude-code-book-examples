import { EventEmitter } from 'node:events'
import type { BusEventMap } from './types'

class MessageBus extends EventEmitter {
  emit<K extends keyof BusEventMap>(event: K, payload: BusEventMap[K]): boolean {
    return super.emit(event as string, payload)
  }

  on<K extends keyof BusEventMap>(
    event: K,
    listener: (payload: BusEventMap[K]) => void,
  ): this {
    return super.on(event as string, listener as (...args: unknown[]) => void)
  }

  once<K extends keyof BusEventMap>(
    event: K,
    listener: (payload: BusEventMap[K]) => void,
  ): this {
    return super.once(event as string, listener as (...args: unknown[]) => void)
  }

  off<K extends keyof BusEventMap>(
    event: K,
    listener: (payload: BusEventMap[K]) => void,
  ): this {
    return super.off(event as string, listener as (...args: unknown[]) => void)
  }
}

export const messageBus = new MessageBus()
