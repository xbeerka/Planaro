import svgPaths from "./svg-ucc8hsc2zq";

function LeftRound() {
  return (
    <div className="absolute contents left-0 top-0" data-name="leftRound">
      <div className="absolute h-[17px] left-0 top-0 w-[25px]" data-name="Rectangle 15 (Stroke)">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 25 17">
          <path d={svgPaths.p99b5b00} fill="var(--fill-0, white)" id="Rectangle 15 (Stroke)" />
        </svg>
      </div>
      <div className="absolute left-[8px] size-[17px] top-0" data-name="Rectangle 15 (Stroke)">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 17">
          <path d={svgPaths.pff79200} fill="var(--fill-0, #F0F0F0)" id="Rectangle 15 (Stroke)" />
        </svg>
      </div>
    </div>
  );
}

function RightRound() {
  return (
    <div className="absolute contents right-[8px] top-0" data-name="RightRound">
      <div className="absolute right-[8px] size-[17px] top-0" data-name="Rectangle 15 (Stroke)">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 17">
          <path d={svgPaths.pbafcb00} fill="var(--fill-0, white)" id="Rectangle 15 (Stroke)" />
        </svg>
      </div>
      <div className="absolute right-[8px] size-[17px] top-0" data-name="Rectangle 15 (Stroke)">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 17">
          <path d={svgPaths.p3db90a00} fill="var(--fill-0, #F0F0F0)" id="Rectangle 15 (Stroke)" />
        </svg>
      </div>
    </div>
  );
}

function Frame() {
  return (
    <div className="absolute h-[17px] left-0 right-0 top-0" data-name="Frame">
      <LeftRound />
      <RightRound />
    </div>
  );
}

function Panel() {
  return (
    <div className="absolute h-[10px] left-0 right-0 top-[16px]" data-name="Panel">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 332 10">
        <g id="Panel">
          <g id="divider">
            <path d="M307 1V0H25V1H307Z" fill="var(--fill-0, #F0F0F0)" id="div" />
          </g>
          <path d="M324 10V1H0V10H324Z" fill="var(--fill-0, white)" id="background" />
        </g>
      </svg>
    </div>
  );
}

export default function Fakebottomfix() {
  return (
    <div className="relative size-full" data-name="Fakebottomfix">
      <Frame />
      <Panel />
    </div>
  );
}