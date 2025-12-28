import svgPaths from "./svg-biajfpvj42";

function LeftRound() {
  return (
    <div
      className="absolute contents left-0 top-0"
      data-name="leftRound"
    >
      <div
        className="absolute h-[17px] left-0 top-0 w-[25px]"
        data-name="Rectangle 15 (Stroke)"
      >
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 25 17"
        >
          <path
            d={svgPaths.p99b5b00}
            fill="var(--fill-0, white)"
            id="Rectangle 15 (Stroke)"
          />
        </svg>
      </div>
      <div
        className="absolute left-[8px] size-[17px] top-0"
        data-name="Rectangle 15 (Stroke)"
      >
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 17 17"
        >
          <path
            d={svgPaths.pff79200}
            fill="var(--fill-0, #F0F0F0)"
            id="Rectangle 15 (Stroke)"
          />
        </svg>
      </div>
    </div>
  );
}

function RightRound() {
  return (
    <div
      className="absolute contents right-[8px] top-0"
      data-name="RightRound"
    >
      <div
        className="absolute right-[8px] size-[17px] top-0"
        data-name="Rectangle 15 (Stroke)"
      >
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 17 17"
        >
          <path
            d={svgPaths.pbafcb00}
            fill="var(--fill-0, white)"
            id="Rectangle 15 (Stroke)"
          />
        </svg>
      </div>
      <div
        className="absolute right-[8px] size-[17px] top-0"
        data-name="Rectangle 15 (Stroke)"
      >
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 17 17"
        >
          <path
            d={svgPaths.p3db90a00}
            fill="var(--fill-0, #F0F0F0)"
            id="Rectangle 15 (Stroke)"
          />
        </svg>
      </div>
    </div>
  );
}

function Frame() {
  return (
    <div
      className="absolute h-[17px] left-0 right-[-8px] top-0"
      data-name="Frame"
    >
      <LeftRound />
      <RightRound />
    </div>
  );
}

function Panel() {
  return (
    <div
      className="absolute h-[10px] left-0 right-[-8px] top-[16px] -z-10"
      data-name="Panel"
    >
      {/* фон панели */}
      <div className="absolute inset-0 right-[8px] bg-[var(--fill-0,white)]" />

      {/* резиновый дивайдер */}
      <div
        className="absolute left-[25px] right-[25px] top-0 h-[1px]
                   bg-[var(--fill-0,#F0F0F0)]"
        data-name="divider"
      />
    </div>
  );
}

export default function Fakebottomfix() {
  return (
    <div
      className="relative size-full"
      data-name="Fakebottomfix"
    >
      <Frame />
      <Panel />
    </div>
  );
}