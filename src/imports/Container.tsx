function Paragraph() {
  return (
    <div className="h-[20px] relative shrink-0 w-[16.219px]" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[20px] relative w-[16.219px]">
        <p className="absolute font-['Onest:Regular',sans-serif] font-normal leading-[20px] left-0 text-[#868789] text-[14px] text-nowrap top-0 whitespace-pre">ТТ</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="bg-[#f6f6f6] content-stretch flex h-[36px] items-center justify-center relative rounded-[12px] shrink-0 w-full" data-name="Container">
      <Paragraph />
    </div>
  );
}

export default function Container1() {
  return (
    <div className="content-stretch flex flex-col items-start overflow-clip relative rounded-[12px] size-full" data-name="Container">
      <Container />
    </div>
  );
}