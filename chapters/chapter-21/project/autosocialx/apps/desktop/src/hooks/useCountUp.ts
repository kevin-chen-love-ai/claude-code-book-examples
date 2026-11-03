import { useState, useEffect } from 'react'

/**
 * A hook that animates a numeric value from its current state to a target state.
 * @param end The target value
 * @param duration The duration of the animation in milliseconds
 */
export function useCountUp(end: number, duration: number = 800) {
    const [count, setCount] = useState(0)

    useEffect(() => {
        let startTime: number | null = null
        const startValue = count

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)

            // Easing function: easeOutExpo
            const easing = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

            const currentCount = Math.floor(startValue + (end - startValue) * easing)
            setCount(currentCount)

            if (progress < 1) {
                requestAnimationFrame(animate)
            }
        }

        const frameId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(frameId)
    }, [end, duration])

    return count
}
