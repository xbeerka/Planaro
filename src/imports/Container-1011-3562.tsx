export default function Container() {
  return (
    <div className="content-stretch flex flex-col items-start justify-center pl-[17px] pr-px relative size-full" data-name="Container">
      <div aria-hidden="true" className="absolute bg-[rgba(255,255,255,0)] inset-0 pointer-events-none" />
      <div aria-hidden="true" className="absolute border-[#f0f0f0] border-l border-r border-solid inset-0 pointer-events-none" />
      <div className="h-[144px] relative shrink-0 w-[242px]" data-name="TableViewCell">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[8px] items-start justify-center py-[44px] relative size-full">
          <div className="relative shrink-0 w-[242px]" data-name="Container">
            <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-start relative w-full">
              <div className="flex-[160.742_0_0] min-h-px min-w-px relative" data-name="Container">
                <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full whitespace-nowrap">
                  <p className="font-['Onest:Medium',sans-serif] font-medium leading-[18px] relative shrink-0 text-[13px] text-black">Пешков Игорь</p>
                  <div className="content-stretch flex font-['Onest:Regular',sans-serif] font-normal gap-[4px] items-start relative shrink-0 text-[10px]">
                    <p className="leading-[13px] relative shrink-0 text-[#0062ff]">Sheverev</p>
                    <p className="leading-[14px] relative shrink-0 text-[#868789]">Mobile</p>
                  </div>
                </div>
              </div>
              <div className="h-[18px] relative shrink-0" data-name="Container">
                <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] h-full items-center relative">
                  <div className="relative rounded-[4px] shrink-0" data-name="Text">
                    <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[4px]" />
                    <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[8px] py-[2px] relative">
                      <p className="font-['Onest:Medium',sans-serif] font-medium leading-[14px] relative shrink-0 text-[#555] text-[10px] whitespace-nowrap">Middle</p>
                    </div>
                  </div>
                  <div className="bg-[#ef4444] h-[16px] relative rounded-[4px] shrink-0 w-[28px]" data-name="SizeBadge">
                    <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[5px] py-px relative size-full">
                      <p className="font-['Onest:SemiBold',sans-serif] font-semibold leading-[14px] relative shrink-0 text-[10px] text-white whitespace-nowrap">L</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-[16px] relative shrink-0 w-[242px]" data-name="ProjectsContainer">
            <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
              <div className="absolute bg-[#e21858] content-stretch flex flex-col h-[16px] items-start left-0 pt-px px-[6px] rounded-[4px] top-0 w-[76.414px]" data-name="Container">
                <div className="h-[14px] overflow-clip relative shrink-0 w-full" data-name="Container">
                  <p className="absolute font-['Onest:Medium',sans-serif] font-medium leading-[14px] left-0 text-[10px] text-white top-[0.5px] whitespace-nowrap">Дневник ДИТ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_-1px_0px_0px_#f0f0f0]" />
    </div>
  );
}