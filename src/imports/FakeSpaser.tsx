function SchedulerGridSpacer() {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0 w-full" data-name="SchedulerGridSpacer">
      <div aria-hidden="true" className="absolute border-[#f0f0f0] border-[0px_1px] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-col items-center size-full">
        <div className="size-full" />
      </div>
    </div>
  );
}

export default function FakeSpaser() {
  return (
    <div className="bg-white relative size-full" data-name="fakeSpaser">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[8px] items-start pl-2 py-0 relative size-full">
          <SchedulerGridSpacer />
        </div>
      </div>
    </div>
  );
}
