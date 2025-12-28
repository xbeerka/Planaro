function Frame() {
  return (
    <div className="h-[18px] relative shrink-0 w-[16px]">
      <div className="absolute bg-[#4677ee] left-0 rounded-[20px] size-[16px] top-px" data-name="avatar" />
    </div>
  );
}

function Container() {
  return (
    <div className="basis-0 grow h-[36px] min-h-px min-w-px relative rounded-[12px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.5px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center px-[12px] py-[8px] relative size-full">
          <p className="font-['Onest:Medium',sans-serif] font-medium leading-[20px] relative shrink-0 text-[12px] text-black text-nowrap">Изменить</p>
        </div>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="basis-0 grow h-[36px] min-h-px min-w-px relative rounded-[12px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.5px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center px-[12px] py-[8px] relative size-full">
          <p className="font-['Onest:Medium',sans-serif] font-medium leading-[20px] relative shrink-0 text-[#e7000b] text-[12px] text-nowrap">Удалить</p>
        </div>
      </div>
    </div>
  );
}

function ButtonGroup() {
  return (
    <div className="content-stretch flex gap-[8px] items-start pb-0 pt-[8px] px-0 relative shrink-0 w-full" data-name="buttonGroup">
      <Container />
      <Container1 />
    </div>
  );
}

function Frame1() {
  return (
    <div className="basis-0 content-stretch flex flex-col grow items-start justify-center min-h-px min-w-px relative shrink-0">
      <p className="font-['Onest:Medium',sans-serif] font-medium leading-[18px] relative shrink-0 text-[10px] text-[rgba(0,0,0,0.5)] text-nowrap">Имя пользователя</p>
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] min-w-full relative shrink-0 text-[12px] text-black w-[min-content]">Текст комментария в несколько строк</p>
      <ButtonGroup />
    </div>
  );
}

export default function MaxiComment() {
  return (
    <div className="backdrop-blur-[2px] backdrop-filter bg-[rgba(255,255,255,0.8)] relative rounded-[12px] size-full" data-name="maxiComment">
      <div aria-hidden="true" className="absolute border border-[rgba(206,206,206,0.8)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <div className="size-full">
        <div className="content-stretch flex gap-[8px] items-start pb-[12px] pl-[10px] pr-[12px] pt-[8px] relative size-full">
          <Frame />
          <Frame1 />
        </div>
      </div>
    </div>
  );
}