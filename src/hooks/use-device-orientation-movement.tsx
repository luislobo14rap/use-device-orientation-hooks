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

  currentWinner: "alpha" | "beta" | "gamma"
  historicalWinner: "alpha" | "beta" | "gamma"
}

interface UseDeviceOrientationMovementOptions {
  hardAcumulator?: boolean
}

const useDeviceOrientationMovement = (
  options?: UseDeviceOrientationMovementOptions
): UseDeviceOrientationMovementReturn => {
  const deviceOrientation = useDeviceOrientation()

  const previousAlpha = useRef<number | null>(null),
    previousBeta = useRef<number | null>(null),
    previousGamma = useRef<number | null>(null),
    winnerHistory = useRef<string[]>([])

  const [movementAlpha, setMovementAlpha] = useState(0),
    [movementBeta, setMovementBeta] = useState(0),
    [movementGamma, setMovementGamma] = useState(0)

  const [currentWinner, setCurrentWinner] = useState<
    "alpha" | "beta" | "gamma"
  >("alpha")
  const [historicalWinner, setHistoricalWinner] = useState<
    "alpha" | "beta" | "gamma"
  >("alpha")

  useEffect(() => {
    const { orientation } = deviceOrientation

    if (!orientation) {
      previousAlpha.current = null
      previousBeta.current = null
      previousGamma.current = null

      setMovementAlpha(0)
      setMovementBeta(0)
      setMovementGamma(0)

      setCurrentWinner("alpha")
      setHistoricalWinner("alpha")

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

    previousAlpha.current = currentAlpha
    previousBeta.current = currentBeta
    previousGamma.current = currentGamma

    if (hasGimbalLockNoise) {
      return
    }

    if (!options?.hardAcumulator) {
      setMovementAlpha(movementAlpha)
      setMovementBeta(movementBeta)
      setMovementGamma(movementGamma)
      return
    }

    const absAlpha = Math.abs(movementAlpha),
      absBeta = Math.abs(movementBeta),
      absGamma = Math.abs(movementGamma)

    const winner: "alpha" | "beta" | "gamma" =
      absAlpha >= absBeta && absAlpha >= absGamma
        ? "alpha"
        : absBeta >= absAlpha && absBeta >= absGamma
          ? "beta"
          : "gamma"

    winnerHistory.current.push(winner)
    if (winnerHistory.current.length > 100) {
      winnerHistory.current.shift()
    }

    const alphaCount = winnerHistory.current.filter((w) => w === "alpha").length
    const betaCount = winnerHistory.current.filter((w) => w === "beta").length
    const gammaCount = winnerHistory.current.filter((w) => w === "gamma").length

    const maxCount = Math.max(alphaCount, betaCount, gammaCount)
    const dominantWinner: "alpha" | "beta" | "gamma" =
      alphaCount === maxCount
        ? "alpha"
        : betaCount === maxCount
          ? "beta"
          : "gamma"

    const adjustedAlpha =
        dominantWinner === "alpha" ? absAlpha * 1.45 : absAlpha,
      adjustedBeta = dominantWinner === "beta" ? absBeta * 1.15 : absBeta,
      adjustedGamma = dominantWinner === "gamma" ? absGamma * 1.15 : absGamma

    const adjustedMaxDelta = Math.max(
      adjustedAlpha,
      adjustedBeta,
      adjustedGamma
    )

    setCurrentWinner(winner)
    setHistoricalWinner(dominantWinner)

    if (adjustedMaxDelta === adjustedAlpha) {
      setMovementAlpha(movementAlpha)
      setMovementBeta(0)
      setMovementGamma(0)
      return
    }

    if (adjustedMaxDelta === adjustedBeta) {
      setMovementAlpha(0)
      setMovementBeta(movementBeta)
      setMovementGamma(0)
      return
    }

    setMovementAlpha(0)
    setMovementBeta(0)
    setMovementGamma(movementGamma)
  }, [deviceOrientation.orientation, options?.hardAcumulator])

  return {
    ...deviceOrientation,
    movementAlpha,
    movementBeta,
    movementGamma,
    currentWinner,
    historicalWinner,
  }
}

export { useDeviceOrientationMovement }
