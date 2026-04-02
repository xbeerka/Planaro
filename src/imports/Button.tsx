function Icon() {
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

export default function Button() {
  return (
    <div className="bg-white content-stretch flex gap-[4px] items-center px-[8px] py-[4px] relative rounded-[6px] size-full" data-name="Button">
      <p className="font-['Onest:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#1a1a1a] text-[12px] text-center whitespace-nowrap">Просмотр</p>
      <Icon />
    </div>
  );
}