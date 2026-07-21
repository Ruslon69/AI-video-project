let localOperationSequence = 0

export function createOperationId(prefix: string) {
  localOperationSequence += 1
  const uniqueId = globalThis.crypto?.randomUUID?.()
    ?? `local-${localOperationSequence.toString(36)}`

  return `${prefix}-${uniqueId}`
}

export function createOperationTimestamp() {
  return new Date().toISOString()
}
