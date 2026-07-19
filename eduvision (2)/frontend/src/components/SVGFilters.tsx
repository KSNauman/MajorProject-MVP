import React from "react";

export default function SVGFilters() {
  return (
    <svg className="absolute w-0 h-0 pointer-events-none" style={{ visibility: "hidden" }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="wave-displacement">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015 0.04"
            numOctaves="2"
            result="noise"
          />
          <feDisplacementMap
            id="wave-displacement-map"
            in="SourceGraphic"
            in2="noise"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
