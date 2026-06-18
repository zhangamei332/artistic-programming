import React from "react";
import {
  createMotionCurveSvgPath,
  motionCurveMenuPresets,
} from "../curves/svgWaveform.js";
import type { MotionCurveVariant } from "../curves/motionCurves.js";

export interface MotionCurveMenuProps {
  value: MotionCurveVariant;
  onChange: (value: MotionCurveVariant) => void;
  disabled?: boolean;
}

export function MotionCurveMenu({
  value,
  onChange,
  disabled = false,
}: MotionCurveMenuProps) {
  return (
    <div
      role="listbox"
      aria-label="运动规律"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
      }}
    >
      {motionCurveMenuPresets.map((preset) => {
        const selected = preset.id === value;
        const path = createMotionCurveSvgPath(preset.params, {
          width: 160,
          height: 48,
          samples: 160,
          cycles: preset.id === "spring" ? 1.1 : 1.25,
        });

        return (
          <button
            key={preset.id}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(preset.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr",
              alignItems: "center",
              gap: 10,
              minHeight: 66,
              padding: 8,
              borderRadius: 10,
              border: selected ? "1px solid #69b7ff" : "1px solid #343a43",
              background: selected ? "#172534" : "#1d2025",
              color: "#f3f5f7",
              cursor: disabled ? "not-allowed" : "pointer",
              textAlign: "left",
            }}
          >
            <svg
              viewBox="0 0 160 48"
              width="80"
              height="38"
              aria-hidden="true"
              style={{ overflow: "visible" }}
            >
              <line x1="4" y1="24" x2="156" y2="24" stroke="#4d5560" strokeWidth="1" />
              <path
                d={path}
                fill="none"
                stroke={selected ? "#73c2ff" : "#bec8d4"}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <span style={{ fontSize: 13, lineHeight: 1.25 }}>{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
