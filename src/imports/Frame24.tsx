import svgPaths from "./svg-jys0cyf1sl";

function Frame() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Frame 23">
          <path d={svgPaths.p3b7a5900} fill="var(--fill-0, #0062FF)" id="Vector 193" />
        </g>
      </svg>
    </div>
  );
}

function Input() {
  return (
    <div className="box-border content-stretch flex gap-[6px] items-center justify-center p-[8px] relative rounded-[12px] shrink-0" data-name="input">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Frame />
    </div>
  );
}

function Icon() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <g id="Union">
            <path clipRule="evenodd" d={svgPaths.p260f3480} fill="var(--fill-0, #0062FF)" fillRule="evenodd" />
            <path d={svgPaths.p33398ea8} fill="var(--fill-0, #0062FF)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Input1() {
  return (
    <div className="box-border content-stretch flex gap-[6px] items-center justify-center p-[8px] relative rounded-[12px] shrink-0" data-name="input">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Icon />
    </div>
  );
}

function Icon1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p220c8000} fill="var(--fill-0, #0062FF)" id="Vector (Stroke)" />
        </g>
      </svg>
    </div>
  );
}

function Input2() {
  return (
    <div className="box-border content-stretch flex gap-[6px] items-center justify-center p-[8px] relative rounded-[12px] shrink-0" data-name="input">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Icon1 />
    </div>
  );
}

export default function Frame1() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative size-full">
      <Input />
      <Input1 />
      <Input2 />
    </div>
  );
}