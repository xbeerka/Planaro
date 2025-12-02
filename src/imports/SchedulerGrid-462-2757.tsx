import svgPaths from "./svg-k0w039fxgr";

function ArrowUp() {
  return (
    <div className="relative size-full" data-name="Arrow - Up 2">
      <div className="absolute bottom-[-0.01%] left-0 right-0 top-0">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11 11">
          <g id="Arrow - Up 2">
            <path d={svgPaths.p22ff0c80} fill="var(--fill-0, black)" id="Stroke 1 (Stroke)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function IconlyLightArrowUp() {
  return (
    <div className="relative size-[16px]" data-name="Iconly/Light/Arrow - Up 2">
      <div className="absolute bottom-[13.74%] flex items-center justify-center left-1/2 top-[17.92%] translate-x-[-50%] w-[10.933px]">
        <div className="flex-none h-[10.934px] rotate-[180deg] w-[10.933px]">
          <ArrowUp />
        </div>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp1() {
  return (
    <div className="relative size-[20px]" data-name="Iconly/Regular/Light/Arrow - Up 3">
      <div className="absolute flex items-center justify-center left-1/2 size-[16px] top-1/2 translate-x-[-50%] translate-y-[-50%]" style={{ "--transform-inner-width": "16", "--transform-inner-height": "16" } as React.CSSProperties}>
        <div className="flex-none rotate-[270deg] scale-y-[-100%]">
          <IconlyLightArrowUp />
        </div>
      </div>
    </div>
  );
}

function Input() {
  return (
    <div className="relative rounded-[12px] shrink-0 w-[36px]" data-name="input">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative w-[36px]">
        <div className="flex items-center justify-center relative shrink-0">
          <div className="flex-none rotate-[180deg] scale-y-[-100%]">
            <IconlyRegularLightArrowUp1 />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowUp1() {
  return (
    <div className="relative size-full" data-name="Arrow - Up 2">
      <div className="absolute bottom-0 left-0 right-[-0.01%] top-[-0.01%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9 6">
          <g id="Arrow - Up 2">
            <path d={svgPaths.p1c596770} fill="var(--fill-0, black)" id="Stroke 1 (Stroke)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Iconly/Regular/Light/Arrow - Up 2">
      <div className="absolute flex inset-[37.67%_27.67%_36%_27.67%] items-center justify-center">
        <div className="flex-none h-[5.266px] rotate-[180deg] scale-y-[-100%] w-[8.933px]">
          <ArrowUp1 />
        </div>
      </div>
    </div>
  );
}

function HeaderTitle() {
  return (
    <div className="content-stretch flex gap-[4px] items-start relative shrink-0" data-name="Header Title">
      <p className="font-['Onest:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[14px] text-black text-nowrap whitespace-pre">Название пространства</p>
      <IconlyRegularLightArrowUp />
    </div>
  );
}

function Container() {
  return (
    <div className="h-[16px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Onest:Regular',sans-serif] font-normal leading-[normal] left-0 text-[#868789] text-[12px] text-nowrap top-px whitespace-pre">2026</p>
    </div>
  );
}

function Container1() {
  return (
    <div className="basis-0 grow h-[36px] min-h-px min-w-px relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[36px] items-start relative w-full">
        <HeaderTitle />
        <Container />
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="basis-0 grow h-[36px] min-h-px min-w-px relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] h-[36px] items-center relative w-full">
        <Input />
        <Container1 />
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="basis-0 grow h-[40px] min-h-px min-w-px relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex h-[40px] items-center justify-between relative w-full">
        <Container2 />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="h-[72px] relative rounded-tl-[16px] rounded-tr-[16px] shrink-0 w-full" data-name="header">
      <div aria-hidden="true" className="absolute border-[#f0f0f0] border-[1px_1px_0px] border-solid inset-0 pointer-events-none rounded-tl-[16px] rounded-tr-[16px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex h-[72px] items-start pb-[16px] pl-[5px] pr-[9px] pt-[17px] relative w-full">
          <Container3 />
        </div>
      </div>
    </div>
  );
}

function InterfaceEssentialMagnifier() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Interface essential/Magnifier">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Interface essential/Magnifier">
          <path clipRule="evenodd" d={svgPaths.p2a8c8580} fill="var(--fill-0, #868789)" fillRule="evenodd" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Input1() {
  return (
    <div className="basis-0 bg-[rgba(0,0,0,0.03)] grow h-[36px] min-h-px min-w-px relative rounded-[10px] shrink-0" data-name="input">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[6px] h-[36px] items-center justify-center px-[12px] py-[10px] relative w-full">
          <InterfaceEssentialMagnifier />
          <p className="basis-0 font-['Onest:Regular',sans-serif] font-normal grow leading-[20px] min-h-px min-w-px relative shrink-0 text-[#868789] text-[14px]">Поиск</p>
        </div>
      </div>
    </div>
  );
}

function SearchUser() {
  return (
    <div className="relative shrink-0 w-full" data-name="search_user">
      <div aria-hidden="true" className="absolute border-[#f0f0f0] border-[0px_1px] border-solid inset-0 pointer-events-none" />
      <div className="size-full">
        <div className="box-border content-stretch flex items-start pb-[36px] pl-[5px] pr-[9px] pt-0 relative w-full">
          <Input1 />
        </div>
      </div>
    </div>
  );
}

export default function SchedulerGrid() {
  return (
    <div className="bg-white relative size-full" data-name="SchedulerGrid">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[8px] px-[8px] relative size-full">
          <Header />
          <SearchUser />
        </div>
      </div>
    </div>
  );
}