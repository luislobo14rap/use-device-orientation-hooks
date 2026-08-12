import React, { useEffect, useState } from "react"
import { useDeviceOrientationMovement } from "./hooks/use-device-orientation-movement"
import "./App.css"

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: 16,
        borderRadius: 8,
        width: 300,
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div>{children}</div>
    </div>
  )
}

export default function OrientationExamples() {
  const [hardAcumulator, setHardAcumulator] = useState(false)
  const device = useDeviceOrientationMovement({ hardAcumulator })

  const [totalAlpha, setTotalAlpha] = useState(0)
  const [totalBeta, setTotalBeta] = useState(0)
  const [totalGamma, setTotalGamma] = useState(0)

  useEffect(() => {
    if (!device.isListening) {
      setTotalAlpha(0)
      setTotalBeta(0)
      setTotalGamma(0)
      return
    }

    setTotalAlpha(a => a + Math.abs(device.movementAlpha))
    setTotalBeta(b => b + Math.abs(device.movementBeta))
    setTotalGamma(g => g + Math.abs(device.movementGamma))
  }, [device.isListening, device.movementAlpha, device.movementBeta, device.movementGamma])

  let alpha = device.orientation?.alpha ?? "-",
    beta = device.orientation?.beta ?? "-",
    gamma = device.orientation?.gamma ?? "-"

  alpha = typeof alpha === "number" ? alpha.toFixed(2) : "-"
  beta = typeof beta === "number" ? beta.toFixed(2) : "-"
  gamma = typeof gamma === "number" ? gamma.toFixed(2) : "-"

  return (
    <main style={{ padding: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
      <Card title="usehooks.io (useDeviceOrientation)">
        <div>supported: {device.isSupported ? "yes" : "no"}</div>
        <div>Status: {device.isListening ? "listening" : "stopped"}</div>
        {device.error && (
          <div style={{ color: "red" }}>Error: {device.error}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={async () => {
              const ok = await device.requestPermission()
              if (ok) device.startListening()
            }}
            disabled={!device.isSupported || device.isListening}
          >
            Request + Start
          </button>
          <button
            onClick={() => device.startListening()}
            disabled={!device.isSupported || device.isListening}
          >
            Start
          </button>
          <button
            onClick={() => device.stopListening()}
            disabled={!device.isListening}
          >
            Stop
          </button>
          <button
            onClick={() => setHardAcumulator((v: boolean) => !v)}
            disabled={!device.isSupported}
          >
            {hardAcumulator ? "Hard acumulator ON" : "Hard acumulator OFF"}
          </button>
        </div>

        <div style={{ marginTop: 8 }}>
          <div>alpha: {alpha ?? "—"}</div>
          <div>beta: {beta ?? "—"}</div>
          <div>gamma: {gamma ?? "—"}</div>
          <div>absolute: {String(device.orientation?.absolute ?? "—")}</div>
          <div>
            webkitCompassHeading:{" "}
            {device.orientation?.webkitCompassHeading ?? "—"}
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>Movement (delta):</strong>
          <div>alpha: {device.movementAlpha.toFixed(2)}</div>
          <div>beta: {device.movementBeta.toFixed(2)}</div>
          <div>gamma: {device.movementGamma.toFixed(2)}</div>
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>Movement acumulado:</strong>
          <div>alpha: {totalAlpha.toFixed(2)}</div>
          <div>beta: {totalBeta.toFixed(2)}</div>
          <div>gamma: {totalGamma.toFixed(2)}</div>
        </div>
      </Card>
    </main>
  )
}
