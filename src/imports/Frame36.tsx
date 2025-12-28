function Frame1() {
  return (
    <div className="h-[18px] relative shrink-0 w-[16px]">
      <div className="absolute bg-[#4677ee] left-0 rounded-[20px] size-[16px] top-px" data-name="avatar" />
    </div>
  );
}

export default function Frame() {
  return (
    <div className="bg-[rgba(255,255,255,0.8)] relative rounded-[12px] size-full">
      <div aria-hidden="true" className="absolute border border-[rgba(206,206,206,0.8)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[4px] items-center pl-[6px] pr-[8px] py-[4px] relative size-full">
          <Frame1 />
          <p className="font-['Onest:Regular',sans-serif] font-normal leading-[18px] relative shrink-0 text-[10px] text-black text-nowrap">Текст комментария</p>
        </div>
      </div>
    </div>
  );
}