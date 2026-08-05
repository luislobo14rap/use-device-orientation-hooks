import React from "react";
import { useOrientation as useOrientationReactUse } from "react-use";
import { useOrientation as useOrientationUidot } from "@uidotdev/usehooks";
import useDeviceOrientation from "./hooks/use-device-orientation";
import "./App.css";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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
  );
}

export default function OrientationExamples() {
  type ReactUseOrientationState =
    | {
        angle?: number;
        type?: string;
        alpha?: number | null;
        beta?: number | null;
        gamma?: number | null;
        supported?: boolean;
      }
    | undefined;

  const ru = useOrientationReactUse() as ReactUseOrientationState;
  const uidot = useOrientationUidot();
  const device = useDeviceOrientation();

  return (
    <main style={{ padding: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
      <Card title="react-use (useOrientation)">
        <div>angle: {ru?.angle ?? "n/a"}</div>
        <div>type: {ru?.type ?? "n/a"}</div>
        <div>alpha: {String(ru?.alpha ?? "—")}</div>
        <div>beta: {String(ru?.beta ?? "—")}</div>
        <div>gamma: {String(ru?.gamma ?? "—")}</div>
        <div>supported: {String(ru?.supported ?? false)}</div>
      </Card>

      <Card title="@uidotdev/usehooks (useOrientation)">
        <div>angle: {uidot?.angle ?? "n/a"}</div>
        <div>type: {uidot?.type ?? "n/a"}</div>
        <div style={{ marginTop: 8, fontStyle: "italic", color: "#444" }}>
          Note: @uidotdev/usehooks returns only <strong>angle</strong> and{" "}
          <strong>type</strong>; it does not provide <strong>alpha</strong>/
          <strong>beta</strong>/<strong>gamma</strong>.
        </div>
      </Card>

      <Card title="usehooks.io (useDeviceOrientation)">
        <div>supported: {device.isSupported ? "yes" : "no"}</div>
        <div>Status: {device.isListening ? "listening" : "stopped"}</div>
        {device.error && (
          <div style={{ color: "red" }}>Error: {device.error}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={async () => {
              const ok = await device.requestPermission();
              if (ok) device.startListening();
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
      </Card>
    </main>
  );
}
