import { ReactNode } from 'react';

interface ManagementModalHeaderProps {
  title: string;
  onAdd: () => void;
  addButtonLabel: string;
  onClose: () => void;
  addButtonIcon?: ReactNode;
}

export function ManagementModalHeader({
  title,
  onAdd,
  addButtonLabel,
  onClose,
  addButtonIcon
}: ManagementModalHeaderProps) {
  return (
    <div className="flex items-center justify-between p-6 border-b">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="flex items-center gap-3">
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          {addButtonIcon || (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          )}
          {addButtonLabel}
        </button>
        
      </div>
    </div>
  );
}
