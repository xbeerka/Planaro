import svgPaths from "./svg-bl5oypf3kt";
import imgAvatarOnline from "figma:asset/13999075da141928723b8c42fbe1a97dc4a5be20.png";
import imgAvatarOnline1 from "figma:asset/5bd0f85444d9f77271656b5be7fa3c91c10a9579.png";

function Building() {
  return (
    <div className="absolute inset-[5%]" data-name="building">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="building">
          <g id="Union">
            <path d={svgPaths.p23264200} fill="var(--fill-0, black)" />
            <path d={svgPaths.p15827a00} fill="var(--fill-0, black)" />
            <path clipRule="evenodd" d={svgPaths.p242ec700} fill="var(--fill-0, black)" fillRule="evenodd" />
          </g>
          <g id="Vector" opacity="0"></g>
        </g>
      </svg>
    </div>
  );
}

function VuesaxLinearBuilding() {
  return (
    <div className="absolute contents inset-[5%]" data-name="vuesax/linear/building">
      <Building />
    </div>
  );
}

function VuesaxLinearBuilding1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="vuesax/linear/building">
      <VuesaxLinearBuilding />
    </div>
  );
}

function Input() {
  return (
    <div className="box-border content-stretch flex gap-[4px] items-center justify-center px-[12px] py-[8px] relative rounded-[10px] shrink-0" data-name="input">
      <VuesaxLinearBuilding1 />
    </div>
  );
}

function Frame() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Frame">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Frame">
          <g id="Union">
            <path clipRule="evenodd" d={svgPaths.p2efbd480} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPaths.p6e2fb00} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPaths.p10986b00} fill="var(--fill-0, black)" fillRule="evenodd" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Input1() {
  return (
    <div className="box-border content-stretch flex gap-[4px] items-center justify-center px-[12px] py-[8px] relative rounded-[10px] shrink-0" data-name="input">
      <Frame />
    </div>
  );
}

function Profile2User() {
  return (
    <div className="absolute inset-[5%]" data-name="profile-2user">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="profile-2user">
          <g id="Union">
            <path clipRule="evenodd" d={svgPaths.pcae4500} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path d={svgPaths.p3a669680} fill="var(--fill-0, black)" />
            <path d={svgPaths.p3eda64f2} fill="var(--fill-0, black)" />
            <path clipRule="evenodd" d={svgPaths.p3717c9c0} fill="var(--fill-0, black)" fillRule="evenodd" />
          </g>
          <g id="Vector" opacity="0"></g>
        </g>
      </svg>
    </div>
  );
}

function VuesaxLinearProfile2User() {
  return (
    <div className="absolute contents inset-[5%]" data-name="vuesax/linear/profile-2user">
      <Profile2User />
    </div>
  );
}

function VuesaxLinearProfile2User1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="vuesax/linear/profile-2user">
      <VuesaxLinearProfile2User />
    </div>
  );
}

function Input2() {
  return (
    <div className="box-border content-stretch flex gap-[4px] items-center justify-center px-[12px] py-[8px] relative rounded-[10px] shrink-0" data-name="input">
      <VuesaxLinearProfile2User1 />
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex items-center justify-center relative rounded-[12px] shrink-0" data-name="container">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Input />
      <Input1 />
      <Input2 />
    </div>
  );
}

function Group() {
  return (
    <div className="absolute inset-[12.5%]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15 15">
        <g id="Group 3">
          <g id="Vector">
            <path clipRule="evenodd" d={svgPaths.pedce580} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPaths.p1b85a700} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPaths.p14cff340} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPaths.p20fa3280} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPaths.p6b7e880} fill="var(--fill-0, black)" fillRule="evenodd" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function IconLineCalendarActive() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="icon_line/Calendar_active">
      <Group />
    </div>
  );
}

function ArrowUp() {
  return (
    <div className="relative size-full" data-name="Arrow - Up 2">
      <div className="absolute inset-[-17.14%_-8.57%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11 7">
          <g id="Arrow - Up 2">
            <path d={svgPaths.p4616100} id="Stroke 1" stroke="var(--stroke-0, #868789)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function IconlyLightArrowUp() {
  return (
    <div className="relative size-[16px]" data-name="Iconly/Light/Arrow - Up 2">
      <div className="absolute flex inset-[35.42%_20.83%_35.41%_20.84%] items-center justify-center">
        <div className="flex-none h-[4.667px] rotate-[180deg] w-[9.333px]">
          <ArrowUp />
        </div>
      </div>
    </div>
  );
}

function IconlyRegularLightArrowUp() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Iconly/Regular/Light/Arrow - Up 2">
      <div className="absolute flex items-center justify-center left-1/2 size-[16px] top-1/2 translate-x-[-50%] translate-y-[-50%]">
        <div className="flex-none scale-y-[-100%]">
          <IconlyLightArrowUp />
        </div>
      </div>
    </div>
  );
}

function Input3() {
  return (
    <div className="box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative rounded-[12px] shrink-0" data-name="input">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <IconLineCalendarActive />
      <p className="font-['Onest:Medium',sans-serif] font-medium leading-[20px] relative shrink-0 text-[12px] text-black text-nowrap whitespace-pre">{`Вид `}</p>
      <IconlyRegularLightArrowUp />
    </div>
  );
}

function AvatarOnlineNoAvatar() {
  return (
    <div className="bg-[#f6f6f6] mr-[-8px] overflow-clip relative rounded-[12px] shrink-0 size-[32px]" data-name="avatarOnline (no avatar)">
      <p className="absolute font-['Onest:Regular',sans-serif] font-normal leading-[20px] left-[calc(50%-10px)] text-[#868789] text-[14px] text-nowrap top-[calc(50%-10px)] whitespace-pre">АС</p>
    </div>
  );
}

function AvatarOnline() {
  return (
    <div className="mr-[-8px] pointer-events-none relative rounded-[12px] shrink-0 size-[32px]" data-name="avatarOnline">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover rounded-[12px] size-full" src={imgAvatarOnline} />
      <div aria-hidden="true" className="absolute border-2 border-solid border-white inset-[-2px] rounded-[14px]" />
    </div>
  );
}

function AvatarOnline1() {
  return (
    <div className="mr-[-8px] pointer-events-none relative rounded-[12px] shrink-0 size-[32px]" data-name="avatarOnline">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover rounded-[12px] size-full" src={imgAvatarOnline1} />
      <div aria-hidden="true" className="absolute border-2 border-solid border-white inset-[-2px] rounded-[14px]" />
    </div>
  );
}

function Frame1() {
  return (
    <div className="box-border content-stretch flex items-center pl-0 pr-[8px] py-0 relative shrink-0">
      <AvatarOnlineNoAvatar />
      <AvatarOnline />
      <AvatarOnline1 />
    </div>
  );
}

export default function Frame2() {
  return (
    <div className="content-stretch flex gap-[16px] items-center relative size-full">
      <Container />
      <Input3 />
      <Frame1 />
    </div>
  );
}