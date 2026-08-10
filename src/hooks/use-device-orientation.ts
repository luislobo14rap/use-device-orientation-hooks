import { useCallback, useEffect, useRef, useState } from "react";

export type UseDeviceOrientationOptions = {
  absolute?: boolean;
};

export type OrientationData = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute?: boolean | null;
  webkitCompassHeading?: number | null;
};

function useDeviceOrientation(options?: UseDeviceOrientationOptions) {
  const isSupported =
    typeof window !== "undefined" && "DeviceOrientationEvent" in window;

  const [orientation, setOrientation] = useState<OrientationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | undefined>(
    undefined,
  );

  // include WebKit-specific compass heading property when present
  type WebkitDeviceOrientationEvent = DeviceOrientationEvent & {
    webkitCompassHeading?: number | null;
  };

  const onDeviceOrientation = useCallback((e: DeviceOrientationEvent) => {
    setOrientation({
      alpha: e.alpha ?? null,
      beta: e.beta ?? null,
      gamma: e.gamma ?? null,
      absolute: e.absolute ?? null,
      // some WebKit iOS devices expose compass heading here
      webkitCompassHeading:
        (e as WebkitDeviceOrientationEvent).webkitCompassHeading ?? null,
    });
    setError(null);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("DeviceOrientationEvent is not supported");
      return;
    }
    if (isListening) return;
    handlerRef.current = onDeviceOrientation;
    window.addEventListener("deviceorientation", onDeviceOrientation);
    setIsListening(true);
  }, [isSupported, isListening, onDeviceOrientation]);

  const stopListening = useCallback(() => {
    if (!handlerRef.current) return;
    window.removeEventListener("deviceorientation", handlerRef.current);
    handlerRef.current = undefined;
    setIsListening(false);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Some platforms (iOS) expose a static `requestPermission` on the
    // DeviceOrientationEvent constructor. Narrow its shape without using `any`.
    const DeviceOrientationEventWithRequest =
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };

    if (
      typeof DeviceOrientationEventWithRequest.requestPermission === "function"
    ) {
      try {
        // iOS 13+ permission flow
        const result =
          await DeviceOrientationEventWithRequest.requestPermission();
        return result === "granted";
      } catch (err: unknown) {
        setError(
          String((err as Error)?.message ?? String(err) ?? "permission denied"),
        );
        return false;
      }
    }

    // not required on this platform
    return true;
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    if (options?.absolute) {
      (async () => {
        const ok = await requestPermission();
        if (ok) startListening();
      })();
    }

    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    orientation,
    isSupported,
    error,
    requestPermission,
    startListening,
    stopListening,
    isListening,
  };
}

export { useDeviceOrientation };
