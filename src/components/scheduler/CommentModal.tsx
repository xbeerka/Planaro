import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Trash2 } from "lucide-react";

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  initialText?: string;
  isCreating: boolean;
  authorName?: string;
  authorAvatarUrl?: string;
  dateStr?: string;
}

export function CommentModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  initialText = "", 
  isCreating, 
  authorName,
  authorAvatarUrl,
  dateStr 
}: CommentModalProps) {
  const [text, setText] = useState(initialText);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setText(initialText);
  }, [initialText, isOpen]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      await onSave(text);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsSaving(true);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] [&>button:last-child]:hidden">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "Добавить комментарий" : "Комментарий"}
          </DialogTitle>
        </DialogHeader>

        {!isCreating && onDelete && (
          <Button 
            variant="ghost" 
            size="icon"
            className="absolute right-8 top-8 h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
            onClick={handleDelete} 
            disabled={isSaving}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        
        {!isCreating && (
          <div className="flex items-center gap-3 mb-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={authorAvatarUrl} />
              <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <div className="font-medium text-gray-900">{authorName}</div>
              <div className="text-gray-500 text-xs">{dateStr}</div>
            </div>
          </div>
        )}

        <Textarea 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="Введите комментарий..."
          className="min-h-[120px] resize-none"
        />

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !text.trim()}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
