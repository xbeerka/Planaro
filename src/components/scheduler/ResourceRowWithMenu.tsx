import { memo } from "react";
import { Resource, Grade } from "../../types/scheduler";

interface ResourceRowWithMenuProps {
  resource: Resource;
  grades: Grade[];
  searchQuery?: string;
  getUserInitials: (displayName?: string, email?: string) => string;
  onEdit?: (resourceId: string) => void;
  onDelete?: (resourceId: string) => void;
  rowHeight?: number;
  isHovered?: boolean;
  showOnlyAvatar?: boolean; // ✨ Новый проп для collapsed режима
  departmentColor?: string;
}

export const ResourceRowWithMenu = memo(function ResourceRowWithMenu({
  resource,
  grades,
  searchQuery,
  getUserInitials,
  onEdit,
  onDelete,
  rowHeight = 144, // Default to standard height
  isHovered = false,
  showOnlyAvatar = false, // ✨ По умолчанию false
  departmentColor,
}: ResourceRowWithMenuProps) {
  // Responsive logic based on rowHeight
  const numericHeight = Number(rowHeight);
  const isExtraSmall = numericHeight <= 60; // XS size: <= 60px

  // ✅ Показываем аватарку если не XS или если свернут сайдбар (showOnlyAvatar=true)
  // Для S (96px) теперь показываем аватарку (раньше скрывали)
  const showAvatar = !isExtraSmall || showOnlyAvatar;
  const showRole = !isExtraSmall && !showOnlyAvatar; // ✅ Скрываем роль при XS (≤60px) или showOnlyAvatar=true

  // ✅ Для режима S (96px) и ниже используем компактную аватарку (28px), 
  // но только если сайдбар развернут (!showOnlyAvatar)
  const useCompactAvatar = numericHeight <= 96 && !showOnlyAvatar;
  const avatarSize = useCompactAvatar ? "28px" : "36px";
  const avatarRadius = useCompactAvatar ? "8px" : "12px";
  // ✅ Адаптируем размер шрифта инициалов: 10px для маленького аватара, 14px (text-sm) для обычного
  const initialsTextSize = useCompactAvatar ? "text-[10px]" : "text-sm";
  const isSmall = numericHeight <= 96;

  // Highlight search matches
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span
              key={i}
              style={{ backgroundColor: "#FFD700" }}
            >
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </>
    );
  };

  // ✅ Форматирование позиции с грейдом
  const formatPosition = (resource: Resource): string => {
    const gradeName = resource.grade
      ? grades.find((g) => g.name === resource.grade)?.name  // ✅ ИСПРАВЛЕНО: ищем по name вместо id
      : undefined;

    const position = resource.position || "Employee";

    return gradeName ? `${gradeName} ${position}` : position;
  };

  const formattedPosition = formatPosition(resource);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: isSmall ? "8px" : "12px",
        alignItems: "center",
        justifyContent: showOnlyAvatar ? "center" : "flex-start", // ✅ Центрируем только аватарку
        width: "100%",
      }}
    >
      {/* Avatar */}
      {showAvatar && (
        <div
          style={{
            position: "relative",
            borderRadius: avatarRadius,
            flexShrink: 0,
            width: avatarSize,
            height: avatarSize,
            overflow: "hidden",
          }}
        >
          {resource.avatarUrl ? (
            <img
              src={resource.avatarUrl}
              alt={resource.fullName || `User ${resource.id}`}
              style={{
                position: "absolute",
                inset: 0,
                maxWidth: "none",
                objectFit: "cover",
                pointerEvents: "none",
                borderRadius: avatarRadius,
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
            <div
              style={{
                background: departmentColor ? "rgba(0,0,0,0.05)" : "#f6f6f6",
                borderRadius: avatarRadius,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p className={`${initialsTextSize} text-[#868789]`}>
                {getUserInitials(resource.fullName, resource.email)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info (Name + Position) */}
      {!showOnlyAvatar && (
        <div
          style={{
            flex: 1,
            minWidth: "1px",
            minHeight: "1px",
            display: "flex",
            flexDirection: "column",
            gap: "0px",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            whiteSpace: "nowrap",
          }}
        >
          <p
            className={`font-medium ${isSmall ? "text-xs" : "text-sm"} text-black w-full`}
            style={{
              lineHeight: isSmall ? "16px" : "20px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 1,
            }}
          >
            {searchQuery
              ? highlightMatch(
                  resource.fullName || `User ${resource.id}`,
                  searchQuery,
                )
              : resource.fullName || `User ${resource.id}`}
          </p>
          {showRole && (
            <p
              className={`${isSmall ? "text-[10px]" : "text-xs"} text-[#868789] w-full`}
              style={{
                lineHeight: isSmall ? "14px" : "16px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flexShrink: 1,
              }}
            >
              {searchQuery
                ? highlightMatch(formattedPosition, searchQuery)
                : formattedPosition}
            </p>
          )}
        </div>
      )}
    </div>
  );
});