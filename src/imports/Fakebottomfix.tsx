import svgPaths from "./svg-npv0o5ikv5";

function LeftRound() {
  return (
    <div className="relative shrink-0 size-[17px]" data-name="leftRound">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 17">
        <g id="leftRound">
          <path d={svgPaths.p15561d00} fill="var(--fill-0, #F0F0F0)" id="Rectangle 15 (Stroke)" />
        </g>
      </svg>
    </div>
  );
}

function RightRound() {
  return (
    <div className="relative shrink-0 size-[17px]" data-name="rightRound">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 17">
        <g id="rightRound">
          <g id="Rectangle 15 (Stroke)">
            <mask fill="white" id="path-1-inside-1_462_3137">
              <path d={svgPaths.p3db90a00} />
            </mask>
            <path d={svgPaths.p1a1f5980} fill="var(--stroke-0, #F0F0F0)" mask="url(#path-1-inside-1_462_3137)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Frame() {
  return (
    <div className="box-border content-stretch flex items-start justify-between mb-[-1px] pl-2 relative shrink-0 w-full">
      <LeftRound />
      <RightRound />
    </div>
  );
}

function Panel() {
  return (
    <div className="h-[10px] mb-[-1px] relative shrink-0 w-full" data-name="panel">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 276 10">
        <g id="panel">
          <g id="divider">
            <path d="M259 1V0H17V1H259Z" fill="var(--fill-0, #F0F0F0)" id="div" />
          </g>
          <path d="M276 10V1H0V10H276Z" fill="var(--fill-0, white)" id="background" />
        </g>
      </svg>
    </div>
  );
}

export default function Fakebottomfix() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-px pt-0 px-0 relative size-full" data-name="fakebottomfix">
      <Frame />
      <Panel />
    </div>
  );
}
