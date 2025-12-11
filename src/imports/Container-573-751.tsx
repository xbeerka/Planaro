import svgPaths from "./svg-y47ejozhr0";

function ProjectBadge() {
  return (
    <div className="absolute content-stretch flex flex-col h-[20px] items-start justify-center left-[24px] opacity-50 rounded-[8px] top-[86px]" data-name="ProjectBadge">
      <div className="bg-[#f6f6f6] h-[18px] rounded-[6px] shrink-0 w-[48px]" data-name="NameBlock" />
    </div>
  );
}

function ProjectBadge1() {
  return (
    <div className="absolute content-stretch flex flex-col h-[20px] items-start justify-center left-[78px] opacity-50 rounded-[8px] top-[86px]" data-name="ProjectBadge">
      <div className="bg-[#f6f6f6] h-[18px] rounded-[6px] shrink-0 w-[48px]" data-name="NameBlock" />
    </div>
  );
}

function Paragraph() {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col h-full items-start overflow-clip px-0 py-[3px] relative rounded-[inherit]">
        <div className="bg-[#f6f6f6] h-[14px] rounded-[4px] shrink-0 w-[136px]" data-name="NameBlock" />
      </div>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="h-[16px] relative shrink-0 w-[150px]" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex h-[16px] items-center overflow-clip relative rounded-[inherit] w-[150px]">
        <div className="bg-[#f6f6f6] h-[10px] relative rounded-[4px] shrink-0 w-[96px]" data-name="NameBlock">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid h-[10px] w-[96px]" />
        </div>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="absolute content-stretch flex flex-col h-[36px] items-start left-[48px] top-0 w-[150px]" data-name="Container">
      <Paragraph />
      <Paragraph1 />
    </div>
  );
}

function Paragraph2() {
  return (
    <div className="h-[20px] relative shrink-0 w-[16.219px]" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid h-[20px] w-[16.219px]" />
    </div>
  );
}

function Container1() {
  return (
    <div className="bg-[#f6f6f6] content-stretch flex h-[36px] items-center justify-center relative rounded-[12px] shrink-0 w-full" data-name="Container">
      <Paragraph2 />
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-0 overflow-clip rounded-[12px] size-[36px] top-0" data-name="Container">
      <Container1 />
    </div>
  );
}

function Icon() {
  return (
    <div className="absolute left-[8px] size-[16px] top-[8px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d={svgPaths.p36e45a00} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p150f5b00} id="Vector_2" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p2d6e5280} id="Vector_3" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Container3() {
  return <div className="absolute border border-[rgba(0,0,0,0.12)] border-solid left-0 rounded-[12px] size-[32px] top-0" data-name="Container" />;
}

function Button() {
  return (
    <div className="absolute left-[202px] opacity-0 rounded-[12px] size-[32px] top-[4px]" data-name="Button">
      <Icon />
      <Container3 />
    </div>
  );
}

function ResourceRowWithMenu() {
  return (
    <div className="absolute h-[36px] left-[24px] top-[38px] w-[242px]" data-name="ResourceRowWithMenu">
      <Container />
      <Container2 />
      <Button />
    </div>
  );
}

export default function Container4() {
  return (
    <div className="bg-white border-[#f0f0f0] border-[0px_1px] border-solid relative size-full" data-name="Container">
      <ProjectBadge />
      <ProjectBadge1 />
      <ResourceRowWithMenu />
    </div>
  );
}