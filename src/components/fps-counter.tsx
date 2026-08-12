import { useEffect, useRef, useState } from "react"

export function FPSCounter() {
  const [fps, setFps] = useState(0)

  const frames = useRef(0)
  const lastTime = useRef(performance.now())

  useEffect(() => {
    let rafId: number

    const loop = (time: number) => {
      frames.current++

      const elapsed = time - lastTime.current

      if (elapsed >= 1000) {
        setFps(Math.round((frames.current * 1000) / elapsed))

        frames.current = 0
        lastTime.current = time
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div className="fixed right-3 top-3 z-[9999] rounded-md bg-black/75 px-2.5 py-1.5 font-mono text-xs text-white">
      {fps} FPS
    </div>
  )
}
