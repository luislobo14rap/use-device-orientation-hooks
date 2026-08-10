"use client"

import { useEffect, useRef, useState } from "react"
import { useDeviceOrientation } from "./use-device-orientation"

// Above this many degrees of raw delta, treat the reading as gimbal lock
// noise (alpha/gamma degenerate near beta ±90) and discard the frame
const GIMBAL_LOCK_JUMP_THRESHOLD = 45

interface UseDeviceOrientationMovementReturn {
  orientation: ReturnType<typeof useDeviceOrientation>["orientation"]
  isSupported: boolean
  error: string | null
  requestPermission: () => Promise<boolean>
  startListening: () => void
  stopListening: () => void
  isListening: boolean
  offset: { x: number; y: number; z: number }

  movementAlpha: number
  movementBeta: number
  movementGamma: number
}

const useDeviceOrientationMovement = (): UseDeviceOrientationMovementReturn => {
  const deviceOrientation = useDeviceOrientation()

  const previousAlpha = useRef<number | null>(null)
  const previousBeta = useRef<number | null>(null)
  const previousGamma = useRef<number | null>(null)

  const [movementAlpha, setMovementAlpha] = useState(0)
  const [movementBeta, setMovementBeta] = useState(0)
  const [movementGamma, setMovementGamma] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0, z: 0 })

  useEffect(() => {
    const { orientation } = deviceOrientation

    if (!orientation) {
      previousAlpha.current = null
      previousBeta.current = null
      previousGamma.current = null

      setMovementAlpha(0)
      setMovementBeta(0)
      setMovementGamma(0)

      return
    }

    const { alpha, beta, gamma } = orientation

    if (
      previousAlpha.current === null ||
      previousBeta.current === null ||
      previousGamma.current === null
    ) {
      previousAlpha.current = alpha
      previousBeta.current = beta
      previousGamma.current = gamma

      setOffset({
        x: alpha ?? 0,
        y: beta ?? 0,
        z: gamma ?? 0,
      })

      return
    }

    const currentAlpha = alpha ?? previousAlpha.current
    const currentBeta = beta ?? previousBeta.current
    const currentGamma = gamma ?? previousGamma.current

    const movementAlpha =
      ((currentAlpha - previousAlpha.current + 180) % 360) - 180

    const movementBeta = currentBeta - previousBeta.current
    const movementGamma = currentGamma - previousGamma.current

    // Discard frames where alpha or gamma jump too much at once — this is
    // gimbal lock noise near beta ±90, not real movement, so we skip the
    // update and keep the previous reference for the next frame
    if (
      Math.abs(movementAlpha) > GIMBAL_LOCK_JUMP_THRESHOLD ||
      Math.abs(movementGamma) > GIMBAL_LOCK_JUMP_THRESHOLD
    ) {
      return
    }

    setMovementAlpha(movementAlpha)
    setMovementBeta(movementBeta)
    setMovementGamma(movementGamma)

    previousAlpha.current = currentAlpha
    previousBeta.current = currentBeta
    previousGamma.current = currentGamma
  }, [deviceOrientation.orientation])

  return {
    ...deviceOrientation,
    offset,
    movementAlpha,
    movementBeta,
    movementGamma,
  }
}

export { useDeviceOrientationMovement }
