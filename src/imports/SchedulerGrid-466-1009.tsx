function Box() {
  return (
    <div className="basis-0 bg-[#f6f6f6] grow h-[36px] min-h-px min-w-px relative rounded-[12px] shrink-0" data-name="box">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex h-[36px] items-center justify-center relative w-full">
        <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[12px] text-nowrap tracking-[-0.1504px] whitespace-pre">Январь</p>
      </div>
    </div>
  );
}

export default function SchedulerGrid() {
  return (
    <div className="bg-white relative size-full" data-name="SchedulerGrid">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex items-center px-[4px] py-0 relative size-full">
          <Box />
        </div>
      </div>
    </div>
  );
}