"use client"

import { useEffect, useRef, useState } from "react"
import { useDeviceOrientation } from "./use-device-orientation"

// Above this many degrees of raw delta, treat the reading as gimbal lock
// noise (alpha/gamma degenerate near beta ±90) and discard the frame.
const GIMBAL_LOCK_JUMP_THRESHOLD = 5

interface UseDeviceOrientationMovementReturn {
  orientation: ReturnType<typeof useDeviceOrientation>["orientation"]
  isSupported: boolean
  error: string | null
  requestPermission: () => Promise<boolean>
  startListening: () => void
  stopListening: () => void
  isListening: boolean

  movementAlpha: number
  movementBeta: number
  movementGamma: number
}

interface UseDeviceOrientationMovementOptions {
  hardAcumulator?: boolean
}

const useDeviceOrientationMovement = (
  options?: UseDeviceOrientationMovementOptions,
): UseDeviceOrientationMovementReturn => {
  const deviceOrientation = useDeviceOrientation()

  const previousAlpha = useRef<number | null>(null),
    previousBeta = useRef<number | null>(null),
    previousGamma = useRef<number | null>(null)

  const [movementAlpha, setMovementAlpha] = useState(0),
    [movementBeta, setMovementBeta] = useState(0),
    [movementGamma, setMovementGamma] = useState(0)

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

      return
    }

    const currentAlpha = alpha ?? previousAlpha.current,
      currentBeta = beta ?? previousBeta.current,
      currentGamma = gamma ?? previousGamma.current

    // Normalize alpha delta to [-180, 180).
    //
    // This makes circular transitions behave correctly:
    // 358 -> 359 = +1
    // 359 ->   0 = +1
    //   0 ->   1 = +1
    //   1 ->   3 = +2
    const movementAlpha =
      ((currentAlpha - previousAlpha.current + 540) % 360) - 180

    const movementBeta = currentBeta - previousBeta.current,
      movementGamma = currentGamma - previousGamma.current

    const hasGimbalLockNoise =
      Math.abs(movementAlpha) > GIMBAL_LOCK_JUMP_THRESHOLD ||
      Math.abs(movementGamma) > GIMBAL_LOCK_JUMP_THRESHOLD

    // Always update the reference with the latest sensor reading.
    //
    // Even when the delta is invalid, the current value must become
    // the new baseline so the next frame can recover normally.
    previousAlpha.current = currentAlpha
    previousBeta.current = currentBeta
    previousGamma.current = currentGamma

    // The current reading is valid as a reference,
    // but its movement delta is too large to report.
    if (hasGimbalLockNoise) {
      return
    }

    setMovementAlpha(movementAlpha)
    setMovementBeta(movementBeta)
    setMovementGamma(movementGamma)
  }, [deviceOrientation.orientation])

  return {
    ...deviceOrientation,
    movementAlpha,
    movementBeta,
    movementGamma,
  }
}

export { useDeviceOrientationMovement }
