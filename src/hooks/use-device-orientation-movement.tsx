"use client"

import { useEffect, useRef, useState } from "react"
import { useDeviceOrientation } from "./use-device-orientation"

// Above this many degrees of raw delta between frames, treat the reading as
// gimbal lock noise (alpha/gamma degenerate near beta ±90) and discard the
// frame entirely — regardless of which axis spiked. Value is intentionally
// large: gimbal lock artifacts are ~90°+ jumps, far above any plausible
// human movement between frames. See tradeoffs.md item 1.
const DISCARD_ABOVE = 67.5

type Axis = "alpha" | "beta" | "gamma"

interface UseDeviceOrientationMovementOptions {
  /** Clamp ceiling (degrees-equivalent) applied to every reported delta. Defaults to 1. */
  maxExpected?: number
  /**
   * When true, only the single dominant axis per frame is reported (the
   * other two are zeroed), chosen by magnitude with a bias toward alpha
   * over gamma on near-ties. Also tracks a rolling historical winner over
   * the last 10 frames. When false/omitted, all three axes are reported
   * every frame (each still clamped).
   */
  hardAcumulator?: boolean
}

interface UseDeviceOrientationMovementReturn {
  orientation: ReturnType<typeof useDeviceOrientation>["orientation"]
  isSupported: boolean
  error: string | null
  requestPermission: () => Promise<boolean>
  startListening: () => void
  stopListening: () => void
  isListening: boolean

  // Valores "crus", na nomenclatura do sensor: x = beta (pitch), y = gamma
  // (roll), z = alpha (yaw). Mantidos por compatibilidade — quem já
  // consome x/y/z não é afetado.
  x: number
  y: number
  z: number

  // ATENÇÃO: x é derivado de beta e y é derivado de gamma — sim, "trocado"
  // em relação ao que o nome sugere. Isso NÃO é um erro de troca de eixo.
  // x = beta = giro pra frente/trás (pitch) → conceitualmente é o eixo "Y" do
  //     mundo web (vertical, como no scroll: inclinar pra frente ~ avançar/descer).
  // y = gamma = giro lateral esquerda/direita (roll) → conceitualmente é o
  //     eixo "X" do mundo web (horizontal: inclinar pra direita aumenta X).
  // z = alpha (yaw/compass) não sofre do mesmo cruzamento — forceZ é
  //     identidade (forceZ = z). Ver tradeoffs.md item 9.
  //
  // forceX/forceY/forceZ existem justamente pra deixar esse cruzamento
  // explícito e intencional. Se um dia alguém for "consertar" achando que
  // x/forceY ou y/forceX estão invertidos: não estão. Essa é a intenção.
  forceX: number
  forceY: number
  forceZ: number

  /** Eixo dominante no frame mais recente (só relevante com hardAcumulator). */
  currentWinner: Axis
  /** Eixo mais frequentemente dominante nos últimos 10 frames. */
  historicalWinner: Axis
}

const useDeviceOrientationMovement = (
  options: UseDeviceOrientationMovementOptions = {}
): UseDeviceOrientationMovementReturn => {
  const { maxExpected = 1, hardAcumulator = false } = options

  const deviceOrientation = useDeviceOrientation()
  const { orientation } = deviceOrientation

  // Baseline começa em 0, sem guard de "primeiro frame" com null — decisão
  // consciente (tradeoffs.md item 6): o maior desvio possível no primeiro
  // frame é o próprio maxExpected, imperceptível no início de uma animação.
  const previousAlpha = useRef(0)
  const previousBeta = useRef(0)
  const previousGamma = useRef(0)
  const winnerHistory = useRef<Axis[]>([])

  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [z, setZ] = useState(0)

  const [currentWinner, setCurrentWinner] = useState<Axis>("alpha")
  const [historicalWinner, setHistoricalWinner] = useState<Axis>("alpha")

  useEffect(() => {
    if (!orientation) {
      previousAlpha.current = 0
      previousBeta.current = 0
      previousGamma.current = 0
      winnerHistory.current = []

      setX(0)
      setY(0)
      setZ(0)
      setCurrentWinner("alpha")
      setHistoricalWinner("alpha")

      return
    }

    const { alpha, beta, gamma } = orientation

    // Valores crus, com sinal preservado. Nada de Math.abs()/+100 aqui: o
    // delta já cancela qualquer offset constante (é um no-op matemático), e
    // aplicar abs() no valor bruto ANTES do delta apaga movimento real perto
    // de zero-crossing (ex: -1° → 1° é um giro real de 2°, mas viraria
    // delta 0 se os dois lados fossem abs()'d antes de subtrair).
    const currentAlpha = alpha ?? previousAlpha.current,
      currentBeta = beta ?? previousBeta.current,
      currentGamma = gamma ?? previousGamma.current

    const deltaAlpha = currentAlpha - previousAlpha.current,
      deltaBeta = currentBeta - previousBeta.current,
      deltaGamma = currentGamma - previousGamma.current

    // Qualquer oscilação grande em qualquer eixo é descartada — não é só
    // proteção contra gimbal lock especificamente, é um teto máximo geral
    // de plausibilidade por frame.
    const hasNoise =
      Math.abs(deltaAlpha) > DISCARD_ABOVE * 2 ||
      Math.abs(deltaBeta) > DISCARD_ABOVE ||
      Math.abs(deltaGamma) > DISCARD_ABOVE

    // Baseline sempre atualiza, mesmo em frame de ruído (tradeoffs.md item 5)
    previousAlpha.current = currentAlpha
    previousBeta.current = currentBeta
    previousGamma.current = currentGamma

    if (hasNoise) return

    if (!hardAcumulator) {
      setX(clamp(deltaBeta, maxExpected))
      setY(clamp(deltaGamma, maxExpected))
      setZ(clamp(deltaAlpha, maxExpected))
      return
    }

    const absAlpha = Math.abs(deltaAlpha),
      absBeta = Math.abs(deltaBeta),
      absGamma = Math.abs(deltaGamma)

    const maxDelta = Math.max(absAlpha, absBeta, absGamma)

    let winner: Axis

    if (maxDelta === absBeta) {
      winner = "beta"
    } else if (
      maxDelta === absAlpha ||
      (maxDelta === absGamma && absAlpha >= absGamma * 0.5)
    ) {
      // Viés proposital: alpha ganha de gamma mesmo em quase-empate.
      winner = "alpha"
    } else {
      winner = "gamma"
    }

    winnerHistory.current.push(winner)
    if (winnerHistory.current.length > 10) {
      winnerHistory.current.shift()
    }

    const alphaCount = winnerHistory.current.filter(
        (w) => w === "alpha"
      ).length,
      betaCount = winnerHistory.current.filter((w) => w === "beta").length,
      gammaCount = winnerHistory.current.filter((w) => w === "gamma").length

    const maxCount = Math.max(alphaCount, betaCount, gammaCount),
      dominantWinner: Axis =
        alphaCount === maxCount
          ? "alpha"
          : betaCount === maxCount
            ? "beta"
            : "gamma"

    setCurrentWinner(winner)
    setHistoricalWinner(dominantWinner)

    if (winner === "beta") {
      setX(clamp(deltaBeta, maxExpected))
      setY(0)
      setZ(0)
      return
    }

    if (winner === "gamma") {
      setX(0)
      setY(clamp(deltaGamma, maxExpected))
      setZ(0)
      return
    }

    setX(0)
    setY(0)
    setZ(clamp(deltaAlpha, maxExpected))
  }, [orientation, maxExpected, hardAcumulator])

  const forceX = y,
    forceY = x,
    forceZ = z

  return {
    ...deviceOrientation,
    x,
    y,
    z,
    forceX,
    forceY,
    forceZ,
    currentWinner,
    historicalWinner,
  }
}

function clamp(value: number, maxExpected: number) {
  return Math.max(Math.min(value, maxExpected), -maxExpected)
}

export { useDeviceOrientationMovement }
