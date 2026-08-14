"use client"

import { useEffect, useRef, useState } from "react"
import { useDeviceOrientation } from "./use-device-orientation"

type Axis = "alpha" | "beta" | "gamma"

type Quaternion = {
  x: number
  y: number
  z: number
  w: number
}

interface UseDeviceOrientationMovementOptions {
  /** Clamp ceiling applied to every reported delta. Defaults to 1. */
  maxExpected?: number

  /**
   * When true, only the single dominant axis per frame is reported.
   * When false, all three axes are reported every frame.
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

  // x = beta / pitch
  // y = gamma / roll
  // z = alpha / yaw
  x: number
  y: number
  z: number

  forceX: number
  forceY: number
  forceZ: number

  currentWinner: Axis
  historicalWinner: Axis
}

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * Converte alpha/beta/gamma para quaternion.
 *
 * DeviceOrientation usa a sequência:
 * Z (alpha) → X' (beta) → Y'' (gamma)
 */
function deviceOrientationToQuaternion(
  alpha: number,
  beta: number,
  gamma: number
): Quaternion {
  const x = beta * DEG_TO_RAD
  const y = gamma * DEG_TO_RAD
  const z = alpha * DEG_TO_RAD

  const cX = Math.cos(x / 2)
  const cY = Math.cos(y / 2)
  const cZ = Math.cos(z / 2)

  const sX = Math.sin(x / 2)
  const sY = Math.sin(y / 2)
  const sZ = Math.sin(z / 2)

  return normalizeQuaternion({
    w: cX * cY * cZ - sX * sY * sZ,
    x: sX * cY * cZ - cX * sY * sZ,
    y: cX * sY * cZ + sX * cY * sZ,
    z: cX * cY * sZ + sX * sY * cZ,
  })
}

function multiplyQuaternion(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,

    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,

    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,

    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  }
}

function conjugateQuaternion(q: Quaternion): Quaternion {
  return {
    x: -q.x,
    y: -q.y,
    z: -q.z,
    w: q.w,
  }
}

function normalizeQuaternion(q: Quaternion): Quaternion {
  const length = Math.hypot(q.x, q.y, q.z, q.w)

  if (length === 0) {
    return {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
    }
  }

  return {
    x: q.x / length,
    y: q.y / length,
    z: q.z / length,
    w: q.w / length,
  }
}

/**
 * Calcula a rotação relativa entre duas orientações.
 *
 * Retorna um vetor de rotação em graus:
 *
 * x → componente de rotação no eixo X / beta
 * y → componente de rotação no eixo Y / gamma
 * z → componente de rotação no eixo Z / alpha
 */
function quaternionToDelta(previous: Quaternion, current: Quaternion) {
  let delta = normalizeQuaternion(
    multiplyQuaternion(conjugateQuaternion(previous), current)
  )

  // q e -q representam a mesma orientação.
  // Escolhemos a representação do menor arco.
  if (delta.w < 0) {
    delta = {
      x: -delta.x,
      y: -delta.y,
      z: -delta.z,
      w: -delta.w,
    }
  }

  const w = Math.max(-1, Math.min(1, delta.w))

  const angle = 2 * Math.acos(w)
  const sinHalfAngle = Math.sin(angle / 2)

  /*
   * Para uma rotação muito pequena:
   *
   * sin(angle / 2) ≈ angle / 2
   *
   * Portanto:
   *
   * rotationVector ≈ 2 * quaternion.xyz
   */
  if (Math.abs(sinHalfAngle) < 1e-6) {
    return {
      x: delta.x * 2 * RAD_TO_DEG,
      y: delta.y * 2 * RAD_TO_DEG,
      z: delta.z * 2 * RAD_TO_DEG,
    }
  }

  /*
   * axis = quaternion.xyz / sin(angle / 2)
   *
   * rotationVector = axis * angle
   */
  const angleInDegrees = angle * RAD_TO_DEG

  return {
    x: (delta.x / sinHalfAngle) * angleInDegrees,

    y: (delta.y / sinHalfAngle) * angleInDegrees,

    z: (delta.z / sinHalfAngle) * angleInDegrees,
  }
}

const useDeviceOrientationMovement = (
  options: UseDeviceOrientationMovementOptions = {}
): UseDeviceOrientationMovementReturn => {
  const { maxExpected = 1, hardAcumulator = false } = options

  const deviceOrientation = useDeviceOrientation()

  const { orientation } = deviceOrientation

  /*
   * IMPORTANTE:
   *
   * O baseline continua sendo (0, 0, 0),
   * exatamente como no código original.
   *
   * Não usamos null nem ignoramos o primeiro frame.
   */
  const previousQuaternion = useRef<Quaternion>(
    deviceOrientationToQuaternion(0, 0, 0)
  )

  const winnerHistory = useRef<Axis[]>([])

  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [z, setZ] = useState(0)

  const [currentWinner, setCurrentWinner] = useState<Axis>("alpha")

  const [historicalWinner, setHistoricalWinner] = useState<Axis>("alpha")

  useEffect(() => {
    /*
     * Quando o sensor deixa de fornecer orientação,
     * restauramos o baseline original.
     */
    if (!orientation) {
      previousQuaternion.current = deviceOrientationToQuaternion(0, 0, 0)

      winnerHistory.current = []

      setX(0)
      setY(0)
      setZ(0)

      setCurrentWinner("alpha")
      setHistoricalWinner("alpha")

      return
    }

    const { alpha, beta, gamma } = orientation

    /*
     * Mantém o comportamento original:
     * quando algum valor não está disponível,
     * usamos o valor anterior naquele eixo.
     */
    const currentAlpha = alpha ?? 0

    const currentBeta = beta ?? 0

    const currentGamma = gamma ?? 0

    const currentQuaternion = deviceOrientationToQuaternion(
      currentAlpha,
      currentBeta,
      currentGamma
    )

    /*
     * A diferença agora é calculada entre orientações,
     * não entre os números dos Euler angles.
     */
    const delta = quaternionToDelta(
      previousQuaternion.current,
      currentQuaternion
    )

    /*
     * Baseline sempre avança.
     *
     * Inclusive quando houver uma movimentação grande:
     * o próximo frame será comparado contra este.
     */
    previousQuaternion.current = currentQuaternion

    /*
     * maxExpected continua existindo exatamente
     * como controle de quanto um frame pode afetar
     * visualmente o movimento.
     */
    const deltaX = clamp(delta.x)
    const deltaY = clamp(delta.y)
    const deltaZ = clamp(delta.z)

    if (!hardAcumulator) {
      setX(deltaX)
      setY(deltaY)
      setZ(deltaZ)

      return
    }

    /*
     * hardAcumulator:
     * mantém apenas o eixo dominante.
     *
     * A correspondência continua sendo:
     *
     * x → beta
     * y → gamma
     * z → alpha
     */
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const absZ = Math.abs(deltaZ)

    const maxDelta = Math.max(absX, absY, absZ)

    let winner: Axis

    /*
     * Mantém a prioridade original:
     * beta primeiro,
     * depois alpha,
     * depois gamma.
     *
     * E mantém o viés especial:
     * alpha ganha de gamma quando gamma
     * não é significativamente maior.
     */
    if (maxDelta === absX) {
      winner = "beta"
    } else if (maxDelta === absZ || (maxDelta === absY && absZ >= absY * 0.5)) {
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

    const dominantWinner: Axis =
      alphaCount === maxCount
        ? "alpha"
        : betaCount === maxCount
          ? "beta"
          : "gamma"

    setCurrentWinner(winner)
    setHistoricalWinner(dominantWinner)

    if (winner === "beta") {
      setX(deltaX)
      setY(0)
      setZ(0)
      return
    }

    if (winner === "gamma") {
      setX(0)
      setY(deltaY)
      setZ(0)
      return
    }

    setX(0)
    setY(0)
    setZ(deltaZ)
  }, [orientation, maxExpected, hardAcumulator])

  function clamp(value: number) {
    return Math.max(Math.min(value, maxExpected), -maxExpected)
  }

  /*
   * Mantém o contrato existente:
   *
   * forceX = gamma / y
   * forceY = beta  / x
   * forceZ = alpha / z
   */
  const forceX = y
  const forceY = x
  const forceZ = z

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

export { useDeviceOrientationMovement }
