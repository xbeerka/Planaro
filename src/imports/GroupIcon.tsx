import svgPaths from "./svg-k2ncor8zr6";

function CursorRest() {
  return (
    <div className="absolute left-0 size-[16px] top-0" data-name="cursor_rest">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="cursor_rest">
          <path d={svgPaths.pb4a2500} fill="var(--fill-0, black)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function CursorActive() {
  return (
    <div className="absolute left-[29px] size-[16px] top-0" data-name="cursor_active">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="cursor_active">
          <path d={svgPaths.p268b500} fill="var(--fill-0, #0062FF)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function ScissorsRest() {
  return (
    <div className="absolute left-[58px] size-[16px] top-0" data-name="scissors_rest">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="scissors_rest">
          <path d={svgPaths.pd69ce00} fill="var(--fill-0, black)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function ScissorsActive() {
  return (
    <div className="absolute left-[87px] size-[16px] top-0" data-name="scissors_active">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="scissors_active">
          <path d={svgPaths.p201fc180} fill="var(--fill-0, #0062FF)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function CommentRest() {
  return (
    <div className="absolute left-[116px] size-[16px] top-0" data-name="comment_rest">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="comment_rest">
          <path d={svgPaths.pda47100} fill="var(--fill-0, black)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function CommentActive() {
  return (
    <div className="absolute left-[145px] size-[16px] top-0" data-name="comment_active">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="comment_active">
          <path d={svgPaths.p265f9c00} fill="var(--fill-0, #0062FF)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

export default function GroupIcon() {
  return (
    <div className="relative size-full" data-name="group icon">
      <CursorRest />
      <CursorActive />
      <ScissorsRest />
      <ScissorsActive />
      <CommentRest />
      <CommentActive />
    </div>
  );
}