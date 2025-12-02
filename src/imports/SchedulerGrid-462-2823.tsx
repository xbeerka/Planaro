import imgLogoContainer from "figma:asset/5bd0f85444d9f77271656b5be7fa3c91c10a9579.png";

function LogoContainer() {
  return (
    <div className="relative rounded-[12px] shrink-0 size-[36px]" data-name="logo_container">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none rounded-[12px] size-full" src={imgLogoContainer} />
    </div>
  );
}

function Info() {
  return (
    <div className="basis-0 content-stretch flex flex-col gap-[4px] grow items-start justify-center min-h-px min-w-px relative shrink-0 text-nowrap" data-name="Info">
      <p className="[white-space-collapse:collapse] font-['Onest:Medium',sans-serif] font-medium leading-[20px] overflow-ellipsis overflow-hidden relative shrink-0 text-[14px] text-black w-full">Шпак Александр Александрович</p>
      <p className="[white-space-collapse:collapse] font-['Onest:Regular',sans-serif] font-normal leading-[16px] overflow-ellipsis overflow-hidden relative shrink-0 text-[#868789] text-[12px] w-full">Senior Python-разработчик</p>
    </div>
  );
}

function Profile() {
  return (
    <div className="content-stretch flex gap-[12px] items-center justify-center relative shrink-0 w-full" data-name="Profile">
      <LogoContainer />
      <Info />
    </div>
  );
}

function Container() {
  return (
    <div className="bg-[#aeeb3d] relative rounded-[8px] shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] items-center justify-center px-[7px] py-[2px] relative">
        <p className="font-['Onest:SemiBold',sans-serif] font-semibold leading-[16px] relative shrink-0 text-[10px] text-black text-nowrap whitespace-pre">BackApp</p>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="bg-[#720abd] relative rounded-[8px] shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] items-center justify-center px-[7px] py-[2px] relative">
        <p className="font-['Onest:SemiBold',sans-serif] font-semibold leading-[16px] relative shrink-0 text-[10px] text-nowrap text-white whitespace-pre">Проект1</p>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="content-center flex flex-wrap gap-[6px] items-center relative shrink-0 w-full" data-name="Container">
      <Container />
      <Container1 />
    </div>
  );
}

function ProfileBox() {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0 w-full" data-name="ProfileBox">
      <div aria-hidden="true" className="absolute border-[#f0f0f0] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-col justify-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col gap-[12px] items-start justify-center pl-0 pr-[16px] py-0 relative size-full">
          <Profile />
          <Container2 />
        </div>
      </div>
    </div>
  );
}

function SchedulerGrid() {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0 w-full" data-name="SchedulerGrid">
      <div aria-hidden="true" className="absolute border-[#f0f0f0] border-[0px_1px] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-col items-center size-full">
        <div className="box-border content-stretch flex flex-col items-center pl-[17px] pr-px py-0 relative size-full">
          <ProfileBox />
        </div>
      </div>
    </div>
  );
}

export default function SchedulerGrid1() {
  return (
    <div className="bg-white relative size-full" data-name="SchedulerGrid">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[8px] items-start px-[8px] py-0 relative size-full">
          <SchedulerGrid />
        </div>
      </div>
    </div>
  );
}