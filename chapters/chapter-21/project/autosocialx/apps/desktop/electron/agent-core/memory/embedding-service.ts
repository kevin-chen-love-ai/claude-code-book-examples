/**
 * EmbeddingService — wraps Ollama nomic-embed-text for local vector generation.
 *
 * Strategy:
 *   1. Try Ollama /api/embeddings (nomic-embed-text, 768 dims)
 *   2. If Ollama unavailable → return null (caller falls back to keyword search)
 *
 * Availability is lazily checked and cached for 5 minutes to avoid repeated
 * network probes on every embed call.
 */

const OLLAMA_BASE = 'http://localhost:11434'
const EMBED_MODEL = 'nomic-embed-text'
const EMBED_TIMEOUT_MS = 10_000
const AVAIL_CHECK_TTL_MS = 5 * 60 * 1000   // re-check every 5 min

interface OllamaEmbeddingsResponse {
    embedding: number[]
}

interface OllamaTagsResponse {
    models?: { name: string }[]
}

class EmbeddingService {
    private availableCachedAt = 0
    private availableCached: boolean | null = null

    /**
     * Check if Ollama is running and has nomic-embed-text pulled.
     * Result is cached for AVAIL_CHECK_TTL_MS.
     */
    async isAvailable(): Promise<boolean> {
        const now = Date.now()
        if (this.availableCached !== null && now - this.availableCachedAt < AVAIL_CHECK_TTL_MS) {
            return this.availableCached
        }

        try {
            const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
                signal: AbortSignal.timeout(2000),
            })
            if (!res.ok) {
                this.availableCached = false
                this.availableCachedAt = now
                return false
            }
            const data = await res.json() as OllamaTagsResponse
            const models = (data.models ?? []).map(m => m.name)
            // Accept partial match: "nomic-embed-text:latest", "nomic-embed-text:v1.5", etc.
            const found = models.some(m => m.startsWith(EMBED_MODEL))
            this.availableCached = found
            this.availableCachedAt = now
            return found
        } catch {
            this.availableCached = false
            this.availableCachedAt = now
            return false
        }
    }

    /** Invalidate availability cache (e.g. after ollama model pulled) */
    invalidateCache(): void {
        this.availableCached = null
        this.availableCachedAt = 0
    }

    /**
     * Generate an embedding for the given text.
     * Returns null without throwing if Ollama is unavailable.
     * Text is truncated to 2000 chars to stay well within model limits.
     */
    async embed(text: string): Promise<number[] | null> {
        if (!(await this.isAvailable())) return null

        const prompt = text.slice(0, 2000).trim()
        if (!prompt) return null

        try {
            const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: EMBED_MODEL, prompt }),
                signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
            })
            if (!res.ok) {
                console.warn(`[EmbeddingService] Ollama returned ${res.status}`)
                return null
            }
            const data = await res.json() as OllamaEmbeddingsResponse
            if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
                console.warn('[EmbeddingService] Empty embedding received')
                return null
            }
            return data.embedding
        } catch (err) {
            console.warn('[EmbeddingService] embed failed:', err instanceof Error ? err.message : err)
            // Invalidate cache so next call re-probes
            this.availableCached = null
            return null
        }
    }

    /**
     * Cosine similarity between two equal-length float vectors.
     * Returns value in [-1, 1]; higher = more similar.
     */
    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length || a.length === 0) return 0
        let dot = 0, normA = 0, normB = 0
        for (let i = 0; i < a.length; i++) {
            const ai = a[i]!
            const bi = b[i]!
            dot += ai * bi
            normA += ai * ai
            normB += bi * bi
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB)
        return denom === 0 ? 0 : dot / denom
    }
}

export const embeddingService = new EmbeddingService()
