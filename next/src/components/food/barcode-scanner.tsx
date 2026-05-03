"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScanLineIcon, CameraOffIcon } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
}

const SCANNER_ELEMENT_ID = "barcode-scanner-region";

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
];

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);

  // Check camera availability on mount
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          setHasCamera(videoDevices.length > 0);
        })
        .catch(() => {
          setHasCamera(false);
        });
    } else {
      setHasCamera(false);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // State 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
      } catch {
        // Scanner may already be stopped
      }
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    scannedRef.current = false;

    // Small delay to ensure DOM element is rendered
    await new Promise((resolve) => setTimeout(resolve, 100));

    const element = document.getElementById(SCANNER_ELEMENT_ID);
    if (!element) {
      setError("Scanner element not found");
      return;
    }

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => {
          // Prevent multiple callbacks for same scan session
          if (scannedRef.current) return;
          scannedRef.current = true;

          onScan(decodedText);
          setOpen(false);
        },
        () => {
          // Scan failure (no barcode found in frame) — silent, expected
        }
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start camera";

      if (
        message.includes("NotAllowedError") ||
        message.includes("Permission")
      ) {
        setError("Camera access denied. Please allow camera access in your browser settings.");
      } else if (
        message.includes("NotFoundError") ||
        message.includes("no video")
      ) {
        setError("No camera found on this device.");
      } else {
        setError(message);
      }
    }
  }, [onScan]);

  // Start scanner when dialog opens, stop when it closes
  useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  // Don't render button if no camera available
  if (hasCamera === false) {
    return null;
  }

  // While checking camera availability, render disabled button
  if (hasCamera === null) {
    return (
      <Button variant="outline" size="sm" disabled>
        <ScanLineIcon data-icon="inline-start" />
        Scan
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ScanLineIcon data-icon="inline-start" />
        Scan Barcode
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
            <DialogDescription>
              Point your camera at a food product barcode
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            {error ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CameraOffIcon className="size-10 text-muted-foreground" />
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    startScanner();
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <div
                id={SCANNER_ELEMENT_ID}
                className="w-full overflow-hidden rounded-lg [&_video]:rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BarcodeScanner;
