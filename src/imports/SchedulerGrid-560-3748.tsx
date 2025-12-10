import svgPaths from "./svg-6uotmbnrur";

function Icon() {
  return (
    <div className="h-[10.93px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute bottom-[0.6%] flex items-center justify-center left-0 right-[0.61%] top-0">
        <div className="flex-none h-[10.863px] rotate-[90deg] w-[10.864px]">
          <div className="relative size-full" data-name="Vector">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11 11">
              <path d={svgPaths.p2605e700} fill="var(--fill-0, black)" id="Vector" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowUp() {
  return (
    <div className="content-stretch flex flex-col h-[10.93px] items-start relative w-full" data-name="ArrowUp1">
      <Icon />
    </div>
  );
}

function IconlyRegularLightArrowUp() {
  return (
    <div className="h-[16px] relative w-full" data-name="IconlyRegularLightArrowUp1">
      <div className="size-full">
        <div className="content-stretch flex flex-col h-[16px] items-start pb-0 pl-[2.867px] pr-[2.203px] pt-[2.535px] relative w-full">
          <div className="flex items-center justify-center relative shrink-0 w-full">
            <div className="flex-none rotate-[180deg] w-full">
              <ArrowUp />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="h-[20px] relative w-full" data-name="Container">
      <div className="size-full">
        <div className="content-stretch flex flex-col h-[20px] items-start pb-0 pt-[2px] px-[2px] relative w-full">
          <div className="flex h-[16px] items-center justify-center relative shrink-0 w-full" style={{ "--transform-inner-width": "16", "--transform-inner-height": "16" } as React.CSSProperties}>
            <div className="flex-none rotate-[270deg] w-full">
              <IconlyRegularLightArrowUp />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderBackButton() {
  return (
    <div className="relative rounded-[12px] shrink-0 size-[36px]" data-name="HeaderBackButton">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-0 pt-[8px] px-[8px] relative size-[36px]">
        <div className="flex items-center justify-center relative shrink-0 w-full">
          <div className="flex-none rotate-[180deg] w-full">
            <Container />
          </div>
        </div>
      </div>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="bg-[#e2e2e2] content-stretch flex items-center overflow-clip px-[4px] py-0 relative rounded-bl-[4px] rounded-tl-[4px] shrink-0" data-name="Paragraph">
      <p className="font-['Onest:SemiBold',sans-serif] font-semibold leading-[20px] relative shrink-0 text-[14px] text-black text-nowrap whitespace-pre">123</p>
    </div>
  );
}

function Icon1() {
  return (
    <div className="h-[5.266px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute bottom-[12.23%] flex items-center justify-center left-0 right-[0.74%] top-0">
        <div className="flex-none h-[4.622px] rotate-[180deg] w-[8.863px]">
          <div className="relative size-full" data-name="Vector">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9 5">
              <path d={svgPaths.p37b4c100} fill="var(--fill-0, black)" id="Vector" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowUp1() {
  return (
    <div className="content-stretch flex flex-col h-[5.266px] items-start relative w-full" data-name="ArrowUp2">
      <Icon1 />
    </div>
  );
}

function Container1() {
  return (
    <div className="bg-[#f6f6f6] content-stretch flex flex-col items-start pb-0 pl-[5.531px] pr-[5.539px] pt-[7.531px] relative rounded-br-[4px] rounded-tr-[4px] shrink-0 size-[20px]" data-name="Container">
      <div className="flex items-center justify-center relative shrink-0 w-full">
        <div className="flex-none rotate-[180deg] w-full">
          <ArrowUp1 />
        </div>
      </div>
    </div>
  );
}

function HeaderTitle() {
  return (
    <div className="content-stretch flex gap-[2px] items-center relative shrink-0 w-full" data-name="HeaderTitle">
      <Paragraph />
      <Container1 />
    </div>
  );
}

function YearContainer() {
  return (
    <div className="relative shrink-0 w-full" data-name="YearContainer">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center px-[4px] py-0 relative w-full">
          <p className="font-['Onest:Regular',sans-serif] font-normal leading-[18px] relative shrink-0 text-[#868789] text-[12px] text-nowrap whitespace-pre">2026</p>
        </div>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-px items-start relative">
        <HeaderTitle />
        <YearContainer />
      </div>
    </div>
  );
}

export default function SchedulerGrid() {
  return (
    <div className="relative size-full" data-name="SchedulerGrid">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center pl-[12px] pr-0 py-0 relative size-full">
          <HeaderBackButton />
          <Container2 />
        </div>
      </div>
    </div>
  );
}