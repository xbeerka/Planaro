import svgPaths from "./svg-b9z45on2vt";
import imgAvatarImage from "figma:asset/a9436492f49567c6b6a3ffc8716801ff6ec889b7.png";

function Container3() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2px] items-start leading-[normal] relative w-full">
        <p className="font-['Onest:SemiBold',sans-serif] font-semibold relative shrink-0 text-[#1a1a1a] text-[15px] w-full">Поделиться</p>
        <p className="font-['Onest:Regular',sans-serif] font-normal relative shrink-0 text-[#868789] text-[12px] w-full">Организация «Тестовая организация»</p>
      </div>
    </div>
  );
}

function Icon() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d="M12 4L4 12" id="Vector" stroke="var(--stroke-0, #868789)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M4 4L12 12" id="Vector_2" stroke="var(--stroke-0, #868789)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button() {
  return (
    <div className="relative rounded-[8px] shrink-0 size-[28px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[6px] relative size-full">
        <Icon />
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full" data-name="Container">
      <Container3 />
      <Button />
    </div>
  );
}

function Icon1() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Icon" opacity="0.5">
          <path d="M3 4.5L6 7.5L9 4.5" id="Vector" stroke="var(--stroke-0, #999999)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-white content-stretch flex gap-[4px] h-[28px] items-center px-[8px] py-[4px] relative rounded-[6px] shrink-0" data-name="Button">
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#1a1a1a] text-[12px] text-center whitespace-nowrap">Просмотр</p>
      <Icon1 />
    </div>
  );
}

function TextInput() {
  return (
    <div className="bg-[#f6f6f6] flex-[166.531_0_0] h-[36px] min-h-px min-w-px relative rounded-[10px]" data-name="Text Input">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-between pl-[12px] pr-[4px] relative size-full">
          <p className="flex-[1_0_0] font-['Onest:Regular',sans-serif] font-normal leading-[normal] min-h-px min-w-px relative text-[#333] text-[13px]">{`xbeerka@gmail.com `}</p>
          <Button1 />
        </div>
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#0062ff] h-[36px] relative rounded-[10px] shrink-0" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex h-full items-center justify-center px-[16px] relative">
        <p className="font-['Onest:Medium',sans-serif] font-medium leading-[19.5px] relative shrink-0 text-[13px] text-center text-white whitespace-nowrap">Пригласить</p>
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="content-stretch flex gap-[8px] h-[36px] items-center relative shrink-0 w-full" data-name="Container">
      <TextInput />
      <Button2 />
    </div>
  );
}

function Container1() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="content-stretch flex flex-col gap-[16px] items-start p-[20px] relative w-full">
        <Container2 />
        <Container4 />
      </div>
    </div>
  );
}

function Container5() {
  return <div className="bg-[#f0f0f0] h-px shrink-0 w-[400px]" data-name="Container" />;
}

function AvatarImage() {
  return (
    <div className="flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[6px]" data-name="AvatarImage">
      <img alt="" className="absolute bg-clip-padding border-0 border-[transparent] border-solid inset-0 max-w-none object-cover pointer-events-none rounded-[6px] size-full" src={imgAvatarImage} />
    </div>
  );
}

function Avatar() {
  return (
    <div className="content-stretch flex items-start overflow-clip relative rounded-[6px] shrink-0 size-[28px]" data-name="Avatar">
      <AvatarImage />
    </div>
  );
}

function Container8() {
  return (
    <div className="content-stretch flex flex-col font-['Onest:Regular',sans-serif] font-normal items-start leading-[normal] relative shrink-0 w-[288.297px] whitespace-nowrap" data-name="Container">
      <p className="relative shrink-0 text-[#1a1a1a] text-[12px]">Александр Синицкий</p>
      <p className="relative shrink-0 text-[#b0b0b0] text-[11px]">test@kode.ru</p>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex flex-[1_0_0] gap-[8px] items-center min-h-px min-w-px relative">
      <Avatar />
      <Container8 />
    </div>
  );
}

function MemberRow() {
  return (
    <div className="content-stretch flex items-center justify-between py-[7px] relative rounded-[10px] shrink-0 w-full" data-name="MemberRow">
      <Frame1 />
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[18px] relative shrink-0 text-[#999] text-[12px] whitespace-nowrap">owner</p>
    </div>
  );
}

function AvatarFallback() {
  return (
    <div className="flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[6px]" data-name="AvatarFallback">
      <div aria-hidden="true" className="absolute bg-clip-padding border-0 border-[transparent] border-solid inset-0 pointer-events-none rounded-[6px]">
        <img alt="" className="absolute bg-clip-padding border-0 border-[transparent] border-solid max-w-none object-cover rounded-[6px] size-full" src={imgAvatarImage} />
        <div className="absolute bg-[#ececf0] bg-clip-padding border-0 border-[transparent] border-solid inset-0 rounded-[6px]" />
      </div>
      <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center px-[5px] py-[6px] relative size-full">
          <p className="font-['Onest:Medium',sans-serif] font-medium leading-[15px] relative shrink-0 text-[#868789] text-[10px] w-full">ПЮ</p>
        </div>
      </div>
    </div>
  );
}

function Avatar1() {
  return (
    <div className="content-stretch flex items-start overflow-clip relative rounded-[6px] shrink-0 size-[28px]" data-name="Avatar">
      <AvatarFallback />
    </div>
  );
}

function Container9() {
  return (
    <div className="content-stretch flex flex-col font-['Onest:Regular',sans-serif] font-normal items-start relative shrink-0 w-[288.297px] whitespace-nowrap" data-name="Container">
      <p className="leading-[0] relative shrink-0 text-[#1a1a1a] text-[12px]">
        <span className="leading-[normal]">{`Первый Юзер `}</span>
        <span className="leading-[normal] text-[#999]">(Вы)</span>
      </p>
      <p className="leading-[normal] relative shrink-0 text-[#b0b0b0] text-[11px]">for@kode.ru</p>
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex flex-[1_0_0] gap-[8px] items-center min-h-px min-w-px relative">
      <Avatar1 />
      <Container9 />
    </div>
  );
}

function Icon2() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Icon" opacity="0.5">
          <path d="M3 4.5L6 7.5L9 4.5" id="Vector" stroke="var(--stroke-0, #999999)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Button3() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Button">
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#999] text-[12px] text-center whitespace-nowrap">Изменение</p>
      <Icon2 />
    </div>
  );
}

function MemberRow1() {
  return (
    <div className="content-stretch flex items-center justify-between py-[7px] relative rounded-[10px] shrink-0 w-full" data-name="MemberRow">
      <Frame2 />
      <Button3 />
    </div>
  );
}

function AvatarFallback1() {
  return (
    <div className="flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[6px]" data-name="AvatarFallback">
      <div aria-hidden="true" className="absolute bg-clip-padding border-0 border-[transparent] border-solid inset-0 pointer-events-none rounded-[6px]">
        <img alt="" className="absolute bg-clip-padding border-0 border-[transparent] border-solid max-w-none object-cover rounded-[6px] size-full" src={imgAvatarImage} />
        <div className="absolute bg-[#ececf0] bg-clip-padding border-0 border-[transparent] border-solid inset-0 rounded-[6px]" />
      </div>
      <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center px-[5px] py-[6px] relative size-full">
          <p className="font-['Onest:Medium',sans-serif] font-medium leading-[15px] relative shrink-0 text-[#868789] text-[10px] w-full">ПЮ</p>
        </div>
      </div>
    </div>
  );
}

function Avatar2() {
  return (
    <div className="content-stretch flex items-start overflow-clip relative rounded-[6px] shrink-0 size-[28px]" data-name="Avatar">
      <AvatarFallback1 />
    </div>
  );
}

function Container10() {
  return (
    <div className="content-stretch flex flex-col font-['Onest:Regular',sans-serif] font-normal items-start leading-[normal] relative shrink-0 w-[288.297px] whitespace-nowrap" data-name="Container">
      <p className="relative shrink-0 text-[#1a1a1a] text-[12px]">Первый Юзер</p>
      <p className="relative shrink-0 text-[#b0b0b0] text-[11px]">for@kode.ru</p>
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-[1_0_0] gap-[8px] items-center min-h-px min-w-px relative">
      <Avatar2 />
      <Container10 />
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Icon" opacity="0.5">
          <path d="M3 4.5L6 7.5L9 4.5" id="Vector" stroke="var(--stroke-0, #999999)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Button4() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Button">
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#999] text-[12px] text-center whitespace-nowrap">Просмотр</p>
      <Icon3 />
    </div>
  );
}

function MemberRow2() {
  return (
    <div className="content-stretch flex items-center justify-between py-[7px] relative rounded-[10px] shrink-0 w-full" data-name="MemberRow">
      <Frame3 />
      <Button4 />
    </div>
  );
}

function Frame() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Frame">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Frame">
          <path d={svgPaths.p27b79a00} fill="var(--fill-0, #999999)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function AvatarFallback2() {
  return (
    <div className="flex-[1_0_0] h-full min-h-px min-w-px relative rounded-[6px]" data-name="AvatarFallback">
      <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center px-[5px] py-[6px] relative size-full">
          <Frame />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#999] border-dashed inset-0 pointer-events-none rounded-[6px]" />
    </div>
  );
}

function Avatar3() {
  return (
    <div className="content-stretch flex items-start overflow-clip relative rounded-[6px] shrink-0 size-[28px]" data-name="Avatar">
      <AvatarFallback2 />
    </div>
  );
}

function Container11() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-[288.297px]" data-name="Container">
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[0] relative shrink-0 text-[#1a1a1a] text-[12px] whitespace-nowrap">
        <span className="leading-[normal]">for@kode.ru</span>
        <span className="leading-[normal] text-[#999]">{` (Отправлено)`}</span>
      </p>
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex flex-[1_0_0] gap-[8px] items-center min-h-px min-w-px relative">
      <Avatar3 />
      <Container11 />
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Icon" opacity="0.5">
          <path d="M3 4.5L6 7.5L9 4.5" id="Vector" stroke="var(--stroke-0, #999999)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Button5() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Button">
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#999] text-[12px] text-center whitespace-nowrap">Просмотр</p>
      <Icon4 />
    </div>
  );
}

function MemberRow3() {
  return (
    <div className="content-stretch flex items-center justify-between py-[7px] relative rounded-[10px] shrink-0 w-full" data-name="MemberRow">
      <Frame4 />
      <Button5 />
    </div>
  );
}

function Container7() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Container">
      <MemberRow />
      <MemberRow1 />
      <MemberRow2 />
      <MemberRow3 />
    </div>
  );
}

function Container6() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start px-[20px] py-[12px] relative w-full">
          <Container7 />
        </div>
      </div>
    </div>
  );
}

export default function Container() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center overflow-clip relative rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] size-full" data-name="Container">
      <Container1 />
      <Container5 />
      <Container6 />
    </div>
  );
}