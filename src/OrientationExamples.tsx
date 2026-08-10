import React from "react"
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
  const device = useDeviceOrientationMovement()

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
        </div>

        <div style={{ marginTop: 8 }}>
          <div>alpha: {device.orientation?.alpha ?? "—"}</div>
          <div>beta: {device.orientation?.beta ?? "—"}</div>
          <div>gamma: {device.orientation?.gamma ?? "—"}</div>
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
          <strong>Offset:</strong>
          <div>x (alpha): {device.offset.x.toFixed(2)}</div>
          <div>y (beta): {device.offset.y.toFixed(2)}</div>
          <div>z (gamma): {device.offset.z.toFixed(2)}</div>
        </div>
      </Card>
    </main>
  )
}
