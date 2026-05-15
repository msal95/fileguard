import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRateLimiter } from '../../src/core/rateLimiter.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('createRateLimiter', () => {
  it('allows uploads within the limit', () => {
    const limiter = createRateLimiter({ maxUploads: 3, windowMs: 60_000 })
    expect(limiter.check('user1').success).toBe(true)
    expect(limiter.check('user1').success).toBe(true)
    expect(limiter.check('user1').success).toBe(true)
  })

  it('blocks the upload that exceeds the limit', () => {
    const limiter = createRateLimiter({ maxUploads: 2, windowMs: 60_000 })
    limiter.check('user1')
    limiter.check('user1')
    const result = limiter.check('user1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('tracks different keys independently', () => {
    const limiter = createRateLimiter({ maxUploads: 1, windowMs: 60_000 })
    expect(limiter.check('userA').success).toBe(true)
    expect(limiter.check('userB').success).toBe(true) // fresh counter for userB
    expect(limiter.check('userA').success).toBe(false) // userA exhausted
  })

  it('resets the counter after the window expires', () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({ maxUploads: 1, windowMs: 1_000 })
    limiter.check('user1')
    expect(limiter.check('user1').success).toBe(false)

    vi.advanceTimersByTime(1_001)
    expect(limiter.check('user1').success).toBe(true) // new window
  })

  it('manual reset clears the counter immediately', () => {
    const limiter = createRateLimiter({ maxUploads: 1, windowMs: 60_000 })
    limiter.check('user1')
    expect(limiter.check('user1').success).toBe(false)
    limiter.reset('user1')
    expect(limiter.check('user1').success).toBe(true)
  })

  it('uses default limits when no config provided', () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < 10; i++) {
      expect(limiter.check('ip').success).toBe(true)
    }
    expect(limiter.check('ip').success).toBe(false)
  })

  it('blocks every upload when maxUploads is 0', () => {
    const limiter = createRateLimiter({ maxUploads: 0, windowMs: 60_000 })
    const result = limiter.check('user1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('tracks an empty-string key without crashing', () => {
    const limiter = createRateLimiter({ maxUploads: 1, windowMs: 60_000 })
    expect(limiter.check('').success).toBe(true)
    expect(limiter.check('').success).toBe(false) // same key, exhausted
  })

  it('error result includes RATE_LIMIT_EXCEEDED code and message', () => {
    const limiter = createRateLimiter({ maxUploads: 0, windowMs: 60_000 })
    const result = limiter.check('u')
    expect(result.success).toBe(false)
    expect(result.error).toBe('RATE_LIMIT_EXCEEDED')
    expect(typeof result.message).toBe('string')
    expect(result.message.length).toBeGreaterThan(0)
  })
})
