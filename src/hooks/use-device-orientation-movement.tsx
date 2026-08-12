"use client"

import { useEffect, useRef, useState } from "react"
import { useDeviceOrientation } from "./use-device-orientation"

// Above this many degrees of raw delta, treat the reading as gimbal lock
// noise (alpha/gamma degenerate near beta ±90) and discard the frame.
const GIMBAL_LOCK_JUMP_THRESHOLD = 5

type Axios = "alpha" | "beta" | "gamma"

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

  currentWinner: Axios
  historicalWinner: Axios
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

  const [currentWinner, setCurrentWinner] = useState<Axios>("alpha")
  const [historicalWinner, setHistoricalWinner] = useState<Axios>("alpha")

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

    let { alpha, beta, gamma } = orientation
    if (typeof alpha === "number") {
      alpha += 1000
    }
    if (typeof beta === "number") {
      beta += 1000
    }
    if (typeof gamma === "number") {
      gamma += 1000
    }

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

    const movementAlpha = currentAlpha - previousAlpha.current,
      movementBeta = currentBeta - previousBeta.current,
      movementGamma = currentGamma - previousGamma.current

    // Always update baseline first (critical for gimbal lock).
    // If we skip the update on noise frames, the next frame keeps
    // comparing against the pre-jump value and the large delta persists.
    previousAlpha.current = currentAlpha
    previousBeta.current = currentBeta
    previousGamma.current = currentGamma

    const hasGimbalLockNoise =
      Math.abs(movementAlpha) > GIMBAL_LOCK_JUMP_THRESHOLD ||
      Math.abs(movementGamma) > GIMBAL_LOCK_JUMP_THRESHOLD

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

    const maxDelta = Math.max(absAlpha, absBeta, absGamma)

    let winner: Axios

    if (maxDelta === absBeta) {
      winner = "beta"
    } else if (
      maxDelta === absAlpha ||
      (maxDelta === absGamma && absAlpha >= absGamma * 0.5)
    ) {
      winner = "alpha"
    } else {
      winner = "gamma"
    }

    winnerHistory.current.push(winner)
    if (winnerHistory.current.length > 100) {
      winnerHistory.current.shift()
    }

    const alphaCount = winnerHistory.current.filter((w) => w === "alpha").length
    const betaCount = winnerHistory.current.filter((w) => w === "beta").length
    const gammaCount = winnerHistory.current.filter((w) => w === "gamma").length

    const maxCount = Math.max(alphaCount, betaCount, gammaCount)
    const dominantWinner: Axios =
      alphaCount === maxCount
        ? "alpha"
        : betaCount === maxCount
          ? "beta"
          : "gamma"

    setCurrentWinner(winner)
    setHistoricalWinner(dominantWinner)

    if (winner === "alpha") {
      setMovementAlpha(movementAlpha)
      setMovementBeta(0)
      setMovementGamma(0)
      return
    }

    if (winner === "beta") {
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
