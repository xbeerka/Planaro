import imgAvatarFallback from "figma:asset/a9436492f49567c6b6a3ffc8716801ff6ec889b7.png";

function Container3() {
  return <div className="absolute bg-[#1a1a1a] h-[2px] left-[12px] right-[12px] rounded-[16777200px] top-[27.5px]" data-name="Container" />;
}

function Button() {
  return (
    <div className="absolute h-[29.5px] left-0 top-0 w-[47.297px]" data-name="Button">
      <p className="absolute font-['Onest:Medium',sans-serif] font-medium leading-[19.5px] left-[12px] right-[11.3px] text-[#1a1a1a] text-[13px] text-center top-[0.5px] whitespace-nowrap">Все</p>
      <Container3 />
    </div>
  );
}

function Button1() {
  return (
    <div className="absolute h-[29.5px] left-[47.3px] top-0 w-[93.898px]" data-name="Button">
      <p className="-translate-x-1/2 absolute font-['Onest:Medium',sans-serif] font-medium leading-[0] left-[47px] text-[#868789] text-[0px] text-center top-[0.5px] whitespace-nowrap">
        <span className="leading-[19.5px] text-[13px]">Инвайты</span>
        <span className="leading-[16.5px] text-[11px]">(1)</span>
      </p>
    </div>
  );
}

function Button2() {
  return (
    <div className="absolute h-[29.5px] left-[141.2px] top-0 w-[139.086px]" data-name="Button">
      <p className="-translate-x-1/2 absolute font-['Onest:Medium',sans-serif] font-medium leading-[0] left-[70px] text-[#868789] text-[0px] text-center top-[0.5px] whitespace-nowrap">
        <span className="leading-[19.5px] text-[13px]">Непрочитанные</span>
        <span className="leading-[16.5px] text-[11px]">(1)</span>
      </p>
    </div>
  );
}

function Container2() {
  return (
    <div className="h-[29.5px] relative shrink-0 w-[280.281px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Button />
        <Button1 />
        <Button2 />
      </div>
    </div>
  );
}

function Button3() {
  return (
    <div className="h-[28px] relative shrink-0 w-[84.836px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Onest:Medium',sans-serif] font-medium leading-[18px] left-[42.5px] text-[#0062ff] text-[12px] text-center top-[-0.5px] whitespace-nowrap">Прочитать все</p>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[42.5px] relative shrink-0 w-[418px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#f0f0f0] border-b border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-end justify-between pb-px px-[16px] relative size-full">
        <Container2 />
        <Button3 />
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[42px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-end size-full">
        <div className="content-stretch flex items-end px-[16px] py-[9px] relative size-full">
          <p className="font-['Onest:Medium',sans-serif] font-medium leading-[16.5px] relative shrink-0 text-[#868789] text-[11px] tracking-[0.55px] uppercase whitespace-nowrap">Сегодня</p>
        </div>
      </div>
    </div>
  );
}

function AvatarFallback() {
  return (
    <div className="flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[10px]" data-name="AvatarFallback">
      <div aria-hidden="true" className="absolute bg-clip-padding border-0 border-[transparent] border-solid inset-0 pointer-events-none rounded-[10px]">
        <img alt="" className="absolute bg-clip-padding border-0 border-[transparent] border-solid max-w-none object-cover rounded-[10px] size-full" src={imgAvatarFallback} />
        <div className="absolute bg-[#ececf0] bg-clip-padding border-0 border-[transparent] border-solid inset-0 rounded-[10px]" />
      </div>
      <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center px-[5px] py-[6px] relative size-full">
          <p className="font-['Onest:Medium',sans-serif] font-medium leading-[15px] relative shrink-0 text-[#868789] text-[12px] whitespace-nowrap">ПЮ</p>
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="content-stretch flex items-start overflow-clip relative rounded-[6px] shrink-0 size-[40px]" data-name="Avatar">
      <AvatarFallback />
    </div>
  );
}

function Container9() {
  return <div className="bg-[#0062ff] rounded-[16777200px] shrink-0 size-[7px]" data-name="Container" />;
}

function Container8() {
  return (
    <div className="h-[16.5px] relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] h-full items-center relative">
        <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#b0b0b0] text-[12px] whitespace-nowrap">3 мин назад</p>
        <Container9 />
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <p className="flex-[1_0_0] font-['Onest:Regular',sans-serif] font-normal leading-[normal] min-h-px min-w-px relative text-[#1a1a1a] text-[12px]">Приглашение в «Александр Синицкий»</p>
      <Container8 />
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex flex-col gap-[3px] items-start relative shrink-0 w-full">
      <Container7 />
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#b0b0b0] text-[11px] w-full">Александр Синицкий приглашает вас в организацию «Александр Синицкий» с ролью Редактор</p>
    </div>
  );
}

function Button4() {
  return (
    <div className="bg-white flex-[164_0_0] h-[34px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#e0e0e0] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-px relative size-full">
        <p className="font-['Onest:Medium',sans-serif] font-medium leading-[18px] relative shrink-0 text-[#333] text-[12px] text-center whitespace-nowrap">Отклонить</p>
      </div>
    </div>
  );
}

function Button5() {
  return (
    <div className="bg-[#0062ff] flex-[162_0_0] h-[34px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <p className="font-['Onest:Medium',sans-serif] font-medium leading-[18px] relative shrink-0 text-[12px] text-center text-white whitespace-nowrap">Принять</p>
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="content-stretch flex gap-[8px] h-[34px] items-start relative shrink-0 w-full" data-name="Container">
      <Button4 />
      <Button5 />
    </div>
  );
}

function Container6() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[10px] items-start min-h-px min-w-px relative" data-name="Container">
      <Frame />
      <Container10 />
    </div>
  );
}

function NotificationRow() {
  return (
    <div className="relative shrink-0 w-full" data-name="NotificationRow">
      <div className="content-stretch flex gap-[12px] items-start pb-[16px] pt-[8px] px-[16px] relative w-full">
        <Avatar />
        <Container6 />
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="h-[42px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-end size-full">
        <div className="content-stretch flex items-end px-[16px] py-[9px] relative size-full">
          <p className="font-['Onest:Medium',sans-serif] font-medium leading-[16.5px] relative shrink-0 text-[#868789] text-[11px] tracking-[0.55px] uppercase whitespace-nowrap">Вчера</p>
        </div>
      </div>
    </div>
  );
}

function AvatarImage() {
  return (
    <div className="flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[10px]" data-name="AvatarImage">
      <img alt="" className="absolute bg-clip-padding border-0 border-[transparent] border-solid inset-0 max-w-none object-cover pointer-events-none rounded-[10px] size-full" src={imgAvatarFallback} />
    </div>
  );
}

function Avatar1() {
  return (
    <div className="content-stretch flex items-start overflow-clip relative rounded-[6px] shrink-0 size-[40px]" data-name="Avatar">
      <AvatarImage />
    </div>
  );
}

function Container15() {
  return <div className="bg-[#0062ff] rounded-[16777200px] shrink-0 size-[7px]" data-name="Container" />;
}

function Container14() {
  return (
    <div className="h-[16.5px] relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] h-full items-center relative">
        <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#b0b0b0] text-[12px] whitespace-nowrap">3 мин назад</p>
        <Container15 />
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <p className="flex-[1_0_0] font-['Onest:Regular',sans-serif] font-normal leading-[normal] min-h-px min-w-px relative text-[#1a1a1a] text-[12px]">Приглашение в «Александр Синицкий»</p>
      <Container14 />
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex flex-col gap-[3px] items-start relative shrink-0 w-full">
      <Container13 />
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#b0b0b0] text-[11px] w-full">Александр Синицкий приглашает вас в организацию «Александр Синицкий» с ролью Редактор</p>
    </div>
  );
}

function Button6() {
  return (
    <div className="bg-white flex-[164_0_0] h-[34px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#e0e0e0] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-px relative size-full">
        <p className="font-['Onest:Medium',sans-serif] font-medium leading-[18px] relative shrink-0 text-[#333] text-[12px] text-center whitespace-nowrap">Отклонить</p>
      </div>
    </div>
  );
}

function Button7() {
  return (
    <div className="bg-[#0062ff] flex-[162_0_0] h-[34px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <p className="font-['Onest:Medium',sans-serif] font-medium leading-[18px] relative shrink-0 text-[12px] text-center text-white whitespace-nowrap">Принять</p>
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex gap-[8px] h-[34px] items-start relative shrink-0 w-full" data-name="Container">
      <Button6 />
      <Button7 />
    </div>
  );
}

function Container12() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[10px] items-start min-h-px min-w-px relative" data-name="Container">
      <Frame1 />
      <Container16 />
    </div>
  );
}

function NotificationRow1() {
  return (
    <div className="relative shrink-0 w-full" data-name="NotificationRow">
      <div className="content-stretch flex gap-[12px] items-start pb-[16px] pt-[8px] px-[16px] relative w-full">
        <Avatar1 />
        <Container12 />
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] w-full">
        <Container5 />
        <NotificationRow />
        <Container11 />
        <NotificationRow1 />
      </div>
    </div>
  );
}

export default function Container() {
  return (
    <div className="bg-white relative rounded-[14px] size-full" data-name="Container">
      <div className="content-stretch flex flex-col items-start overflow-clip p-px relative rounded-[inherit] size-full">
        <Container1 />
        <Container4 />
      </div>
      <div aria-hidden="true" className="absolute border border-[#f0f0f0] border-solid inset-0 pointer-events-none rounded-[14px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.12)]" />
    </div>
  );
}