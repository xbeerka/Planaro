import { useState, useEffect } from 'react';
import { Project, EventPattern, SchedulerEvent } from '../../types/scheduler';
import { ManagementModalHeader } from './ManagementModalHeader';

interface ProjectsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  events: SchedulerEvent[];
  eventPatterns: EventPattern[];
  onCreateProject: (projectData: { name: string; backgroundColor?: string; textColor?: string; patternId?: string }) => Promise<void>;
  onUpdateProject: (projectId: string, projectData: { name: string; backgroundColor?: string; textColor?: string; patternId?: string }) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onResetHistory?: () => void; // Сброс истории после изменений
}

interface LocalNewProject {
  tempId: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  patternId: string;
}

export function ProjectsManagementModal({
  isOpen,
  onClose,
  projects,
  events,
  eventPatterns,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onResetHistory
}: ProjectsManagementModalProps) {
  const [editingProjects, setEditingProjects] = useState<Record<string, { name: string; backgroundColor?: string; textColor?: string; patternId?: string }>>({});
  const [localNewProjects, setLocalNewProjects] = useState<LocalNewProject[]>([]);
  const [deletedProjectIds, setDeletedProjectIds] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [colorGenConfirmed, setColorGenConfirmed] = useState(false);
  const [editColorGenConfirmed, setEditColorGenConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize editing state with current projects
      const initialState: Record<string, { name: string; backgroundColor?: string; textColor?: string; patternId?: string }> = {};
      projects.forEach(p => {
        initialState[p.id] = {
          name: p.name,
          backgroundColor: p.backgroundColor || '',
          textColor: p.textColor || '',
          patternId: p.patternId || ''
        };
      });
      setEditingProjects(initialState);
      setLocalNewProjects([]);
      setDeletedProjectIds([]);
      setHasChanges(false);
      setColorGenConfirmed(false);
      setEditColorGenConfirmed(false);
    }
  }, [isOpen, projects]);

  // Check if there are unsaved changes
  useEffect(() => {
    if (!isOpen) return;

    // Check if there are new projects
    const hasNewProjects = localNewProjects.length > 0;

    // Check if there are deleted projects
    const hasDeletedProjects = deletedProjectIds.length > 0;

    // Check if existing projects have changes
    let hasExistingChanges = false;
    for (const projectId in editingProjects) {
      const editedData = editingProjects[projectId];
      const originalData = projects.find(p => p.id === projectId);
      
      if (originalData && (
        editedData.name !== originalData.name ||
        editedData.backgroundColor !== (originalData.backgroundColor || '') ||
        editedData.textColor !== (originalData.textColor || '') ||
        editedData.patternId !== (originalData.patternId || '')
      )) {
        hasExistingChanges = true;
        break;
      }
    }

    setHasChanges(hasNewProjects || hasDeletedProjects || hasExistingChanges);
  }, [isOpen, localNewProjects, deletedProjectIds, editingProjects, projects]);

  if (!isOpen) return null;

  // Функция генерации случайных цветов с контрастом (расширенная палитра)
  const generateRandomColors = () => {
    // Полный спектр цветов 0-360°
    const hue = Math.floor(Math.random() * 360);
    // Насыщенность 50-95% (была 60-90%)
    const saturation = 50 + Math.floor(Math.random() * 45);
    // Яркость 35-70% (была 45-65%)
    const lightness = 35 + Math.floor(Math.random() * 35);
    
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    const backgroundColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    // Адаптивный порог для более точного контраста
    const textColor = lightness > 52 ? '#000000' : '#ffffff';
    
    return { backgroundColor, textColor };
  };

  // Функция генерации случайного паттерна (включая пустой с равным шансом)
  const generateRandomPattern = () => {
    // Создаём массив из всех паттернов + пустой вариант
    const patternOptions = ['', ...eventPatterns.map(p => p.id)];
    const randomIndex = Math.floor(Math.random() * patternOptions.length);
    return patternOptions[randomIndex];
  };

  const handleAddNewProject = () => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setLocalNewProjects(prev => [...prev, {
      tempId,
      name: '',
      backgroundColor: '',
      textColor: '',
      patternId: ''
    }]);
  };

  const handleNewProjectChange = (tempId: string, field: string, value: string) => {
    setLocalNewProjects(prev => prev.map(p =>
      p.tempId === tempId ? { ...p, [field]: value } : p
    ));
  };

  const handleNewProjectColorGen = (tempId: string) => {
    if (!colorGenConfirmed) {
      const confirmed = window.confirm(
        '🎨 Автоматическая генерация цветов и паттерна\n\n' +
        'Будут заменены текущие цвета фона, текста и паттерн на случайные.\n\n' +
        'Продолжить?'
      );
      if (!confirmed) return;
      setColorGenConfirmed(true);
    }
    
    const { backgroundColor, textColor } = generateRandomColors();
    const patternId = generateRandomPattern();
    setLocalNewProjects(prev => prev.map(p =>
      p.tempId === tempId ? { ...p, backgroundColor, textColor, patternId } : p
    ));
  };

  const handleDeleteNewProject = (tempId: string) => {
    setLocalNewProjects(prev => prev.filter(p => p.tempId !== tempId));
  };

  const handleEditingColorPreviewClick = (projectId: string) => {
    if (!editColorGenConfirmed) {
      const confirmed = window.confirm(
        '🎨 Автоматическая генерация цветов и паттерна\n\n' +
        'Будут заменены текущие цвета фона, текста и паттерн на случайные.\n\n' +
        'Продолжить?'
      );
      if (!confirmed) return;
      setEditColorGenConfirmed(true);
    }
    
    const { backgroundColor, textColor } = generateRandomColors();
    const patternId = generateRandomPattern();
    setEditingProjects(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        backgroundColor,
        textColor,
        patternId
      }
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Step 1: Delete projects
      if (deletedProjectIds.length > 0) {
        console.log(`🗑️ Удаление ${deletedProjectIds.length} проектов...`);
        await Promise.all(
          deletedProjectIds.map(id => onDeleteProject(id))
        );
        console.log(`✅ ${deletedProjectIds.length} проектов удалено`);
      }

      // Step 2: Create new projects (only those with valid names)
      const validNewProjects = localNewProjects.filter(p => p.name.trim());
      if (validNewProjects.length > 0) {
        await Promise.all(
          validNewProjects.map(p => 
            onCreateProject({
              name: p.name,
              backgroundColor: p.backgroundColor?.trim() ? p.backgroundColor : '#aaaaaa',
              textColor: p.textColor?.trim() ? p.textColor : '#ffffff',
              patternId: p.patternId || undefined
            })
          )
        );
      }

      // Step 3: Update existing projects
      const updatePromises: Promise<void>[] = [];
      
      for (const projectId in editingProjects) {
        // Skip if project is marked for deletion
        if (deletedProjectIds.includes(projectId)) continue;

        const editedData = editingProjects[projectId];
        const originalData = projects.find(p => p.id === projectId);
        
        if (originalData && (
          editedData.name !== originalData.name ||
          editedData.backgroundColor !== (originalData.backgroundColor || '') ||
          editedData.textColor !== (originalData.textColor || '') ||
          editedData.patternId !== (originalData.patternId || '')
        )) {
          const changes = [];
          if (editedData.name !== originalData.name) changes.push('name');
          if (editedData.backgroundColor !== (originalData.backgroundColor || '')) changes.push('backgroundColor');
          if (editedData.textColor !== (originalData.textColor || '')) changes.push('textColor');
          if (editedData.patternId !== (originalData.patternId || '')) {
            changes.push(`patternId (${originalData.patternId || 'none'} → ${editedData.patternId || 'none'})`);
          }
          
          console.log(`📝 Проект "${originalData.name}" изменен:`, changes.join(', '));
          
          const dataToSave = {
            ...editedData,
            backgroundColor: editedData.backgroundColor?.trim() ? editedData.backgroundColor : '#aaaaaa',
            textColor: editedData.textColor?.trim() ? editedData.textColor : '#ffffff'
          };
          updatePromises.push(onUpdateProject(projectId, dataToSave));
        }
      }
      
      if (updatePromises.length > 0) {
        console.log(`💾 Сохранение ${updatePromises.length} изменений параллельно...`);
        await Promise.all(updatePromises);
        console.log(`✅ Все ${updatePromises.length} изменений сохранены`);
      } else {
        console.log('ℹ️ Нет изменений для сохранения');
      }
      
      setHasChanges(false);
      setLocalNewProjects([]);
      setDeletedProjectIds([]);
      onClose();
      if (onResetHistory) onResetHistory();
    } catch (error) {
      console.error('❌ Ошибка при сохранении изменений:', error);
      alert('Ошибка при сохранении изменений');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // ✅ Подсчитываем количество событий которые будут удалены
    const affectedEventsCount = events.filter(e => e.projectId === projectId).length;

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить проект "${project.name}"?\n\n` +
      `⚠️ ВНИМАНИЕ: ${affectedEventsCount} событий этого проекта также будут удалены!\n\n` +
      `Удаление будет выполнено после нажатия "Сохранить".`
    );
    if (!confirmed) return;

    // Mark for deletion (remove from local state and add to deletion list)
    setDeletedProjectIds(prev => [...prev, projectId]);
    setEditingProjects(prev => {
      const newState = { ...prev };
      delete newState[projectId];
      return newState;
    });
  };

  const handleChange = (projectId: string, field: string, value: string) => {
    console.log(`🔄 Изменение проекта ${projectId}: ${field} = "${value}"`);
    setEditingProjects(prev => {
      const updated = {
        ...prev,
        [projectId]: {
          ...prev[projectId],
          [field]: value
        }
      };
      console.log(`📊 Обновлённое состояние проекта ${projectId}:`, updated[projectId]);
      return updated;
    });
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?');
      if (!confirmed) return;
    }
    onClose();
  };

  // Filter out deleted projects
  const visibleProjects = projects.filter(p => !deletedProjectIds.includes(p.id));

  return (
    <div 
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50"
      onClick={handleCancel}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <ManagementModalHeader
          title="Управление проектами"
          onAdd={handleAddNewProject}
          addButtonLabel="Добавить проект"
          onClose={handleCancel}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {/* New projects */}
            {localNewProjects.map(newProject => (
              <div key={newProject.tempId} className="gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-[2fr_1.5fr_1fr_auto_1fr_auto] gap-3 items-center">
                  <div>
                    
                    <input
                      type="text"
                      value={newProject.name}
                      onChange={e => handleNewProjectChange(newProject.tempId, 'name', e.target.value)}
                      className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Название проекта"
                      autoFocus
                    />
                  </div>
                  <div>
                    
                    <select
                      value={newProject.patternId}
                      onChange={e => handleNewProjectChange(newProject.tempId, 'patternId', e.target.value)}
                      className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Без паттерна</option>
                      {eventPatterns.map((pattern) => (
                        <option key={pattern.id} value={pattern.id}>
                          {pattern.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    
                    <input
                      type="text"
                      value={newProject.backgroundColor}
                      onChange={e => handleNewProjectChange(newProject.tempId, 'backgroundColor', e.target.value)}
                      className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="#3498db"
                    />
                  </div>
                  <div className="">
                    <div 
                      className="w-16 h-8 rounded border border-gray-300 flex-shrink-0 flex items-center justify-center"
                      style={(() => {
                        const style: React.CSSProperties = {
                          backgroundColor: newProject.backgroundColor?.trim() 
                            ? newProject.backgroundColor 
                            : '#e5e5e5',
                          cursor: 'pointer'
                        };
                        
                        // Parse pattern if exists (same logic as SchedulerEvent)
                        if (newProject.patternId) {
                          const projectPattern = eventPatterns.find(p => p.id === newProject.patternId);
                          if (projectPattern && projectPattern.pattern) {
                            const pattern = projectPattern.pattern
                              .replace(/\n/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim();
                            
                            if (pattern) {
                              const parts = pattern.split(';').map(p => p.trim()).filter(p => p);
                              
                              if (parts.length > 0) {
                                const firstPart = parts[0];
                                
                                if (!firstPart.includes(':') || firstPart.startsWith('linear-gradient') || firstPart.startsWith('radial-gradient') || firstPart.startsWith('repeating-')) {
                                  style.backgroundImage = firstPart;
                                  
                                  for (let i = 1; i < parts.length; i++) {
                                    const part = parts[i];
                                    const colonIndex = part.indexOf(':');
                                    if (colonIndex > 0) {
                                      const propName = part.substring(0, colonIndex).trim();
                                      const propValue = part.substring(colonIndex + 1).trim();
                                      const camelProp = propName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                                      (style as any)[camelProp] = propValue;
                                    }
                                  }
                                  
                                  const gradientCount = (firstPart.match(/gradient\(/g) || []).length;
                                  if (gradientCount >= 2 && !style.backgroundSize) {
                                    style.backgroundSize = '12px 12px';
                                    if (!style.backgroundPosition) {
                                      style.backgroundPosition = '0 0, 6px 6px';
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                        
                        return style;
                      })()}
                      onClick={() => handleNewProjectColorGen(newProject.tempId)}
                      title="Клик для генерации случайных цветов и паттерна"
                    >
                      <span style={{ 
                        color: newProject.backgroundColor?.trim() ? (newProject.textColor || '#fff') : '#999', 
                        fontSize: '14px', 
                        fontWeight: 'bold' 
                      }}>
                        {newProject.backgroundColor?.trim() ? 'A' : '?'}
                      </span>
                    </div>
                  </div>
                  <div>
                    
                    <input
                      type="text"
                      value={newProject.textColor}
                      onChange={e => handleNewProjectChange(newProject.tempId, 'textColor', e.target.value)}
                      className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="#ffffff"
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleDeleteNewProject(newProject.tempId)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить строку"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
            {/* Existing projects */}
            {visibleProjects.map(project => {
              const projectData = editingProjects[project.id];
              if (!projectData) return null;

              return (
                <div key={project.id} className="">
                  <div className="grid grid-cols-[2fr_1.5fr_1fr_auto_1fr_auto] gap-3 items-center whitespace-nowrap">
                    <div className="min-w-0">
                      <input
                        type="text"
                        value={projectData.name}
                        onChange={e => handleChange(project.id, 'name', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Название проекта"
                      />
                    </div>
                    <div className="min-w-0">
                      <select
                        value={projectData.patternId || ''}
                        onChange={e => handleChange(project.id, 'patternId', e.target.value)}
                        className={`w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${!projectData.patternId ? 'text-gray-400' : ''}`}
                      >
                        <option value="" className="text-gray-400">Без паттерна</option>
                        {eventPatterns.map((pattern) => (
                          <option key={pattern.id} value={pattern.id} className="text-black">
                            {pattern.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <input
                        type="text"
                        value={projectData.backgroundColor || ''}
                        onChange={e => handleChange(project.id, 'backgroundColor', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="#3498db"
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <div 
                        className="w-16 h-8 rounded border border-gray-300 flex-shrink-0 flex items-center justify-center"
                        style={(() => {
                          const style: React.CSSProperties = {
                            backgroundColor: projectData.backgroundColor?.trim() 
                              ? projectData.backgroundColor 
                              : '#e5e5e5',
                            cursor: 'pointer'
                          };
                          
                          // Parse pattern if exists (same logic as SchedulerEvent)
                          if (projectData.patternId) {
                            const projectPattern = eventPatterns.find(p => p.id === projectData.patternId);
                            if (projectPattern && projectPattern.pattern) {
                              const pattern = projectPattern.pattern
                                .replace(/\n/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim();
                              
                              if (pattern) {
                                const parts = pattern.split(';').map(p => p.trim()).filter(p => p);
                                
                                if (parts.length > 0) {
                                  const firstPart = parts[0];
                                  
                                  if (!firstPart.includes(':') || firstPart.startsWith('linear-gradient') || firstPart.startsWith('radial-gradient') || firstPart.startsWith('repeating-')) {
                                    style.backgroundImage = firstPart;
                                    
                                    for (let i = 1; i < parts.length; i++) {
                                      const part = parts[i];
                                      const colonIndex = part.indexOf(':');
                                      if (colonIndex > 0) {
                                        const propName = part.substring(0, colonIndex).trim();
                                        const propValue = part.substring(colonIndex + 1).trim();
                                        const camelProp = propName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                                        (style as any)[camelProp] = propValue;
                                      }
                                    }
                                    
                                    const gradientCount = (firstPart.match(/gradient\(/g) || []).length;
                                    if (gradientCount >= 2 && !style.backgroundSize) {
                                      style.backgroundSize = '12px 12px';
                                      if (!style.backgroundPosition) {
                                        style.backgroundPosition = '0 0, 6px 6px';
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                          
                          return style;
                        })()}
                        onClick={() => handleEditingColorPreviewClick(project.id)}
                        title="Клик для автогенерации цветов и паттерна"
                      >
                        <span style={{ 
                          color: projectData.backgroundColor?.trim() ? (projectData.textColor || '#fff') : '#999', 
                          fontSize: '14px', 
                          fontWeight: 'bold' 
                        }}>
                          {projectData.backgroundColor?.trim() ? 'A' : '?'}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <input
                        type="text"
                        value={projectData.textColor || ''}
                        onChange={e => handleChange(project.id, 'textColor', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="#ffffff"
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить проект"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleProjects.length === 0 && localNewProjects.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>Нет проектов</p>
                <p className="text-sm mt-2">Нажмите "Добавить проект" для создания</p>
              </div>
            )}
          </div></div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span className="flex items-center gap-2 text-orange-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Есть несохраненные изменения
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              disabled={isSaving}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!hasChanges || isSaving}
              className={`px-6 py-2 rounded-lg transition-colors ${
                hasChanges && !isSaving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}