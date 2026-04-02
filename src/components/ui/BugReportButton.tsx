/**
 * Floating "Report a Bug" button
 * Минимальная форма: описание + скриншот/видео → отправка в error_logs
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MessageSquareWarning, X, ImagePlus, Video, Trash2, Send, Loader2 } from 'lucide-react';
import { publicAnonKey } from '../../utils/supabase/info';
import { getAutoActions } from '../../utils/errorTracking';
import type { UserAction } from '../../utils/errorTracking';

const EDGE_FUNCTION_URL = 'https://zhukuvbdjyneoloarlqy.supabase.co/functions/v1';
const MAX_FILE_SIZE_MB = 30;
const MAX_IMAGE_SIDE = 1400;
const MAX_VIDEO_HEIGHT = 1200;
const JPEG_QUALITY = 0.75;
const VIDEO_BITRATE = 1_500_000; // 1.5 Mbps

/** Сжимает изображение: макс 1400px по стороне, JPEG quality 0.75 */
function compressImage(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) {
        const ratio = Math.min(MAX_IMAGE_SIDE / width, MAX_IMAGE_SIDE / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      console.log(`📸 Screenshot: ${Math.round(base64.length / 1024)}KB → ${Math.round(compressed.length / 1024)}KB (${width}x${height})`);
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}

/** Сжимает видео: макс 1200px по высоте, перекодирует в webm */
function compressVideo(
  file: File,
  onProgress: (pct: number) => void
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      let { videoWidth: w, videoHeight: h } = video;
      if (h > MAX_VIDEO_HEIGHT) {
        const ratio = MAX_VIDEO_HEIGHT / h;
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      // Ensure even dimensions (required by some codecs)
      w = w % 2 === 0 ? w : w + 1;
      h = h % 2 === 0 ? h : h + 1;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITRATE,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        URL.revokeObjectURL(url);
        const blob = new Blob(chunks, { type: 'video/webm' });
        console.log(`🎬 Video: ${Math.round(file.size / 1024)}KB → ${Math.round(blob.size / 1024)}KB (${w}x${h})`);
        resolve({ blob, width: w, height: h });
      };
      recorder.onerror = () => { URL.revokeObjectURL(url); reject(new Error('MediaRecorder error')); };

      recorder.start(100);
      video.currentTime = 0;

      const duration = video.duration;

      const drawFrame = () => {
        if (video.paused || video.ended) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
        requestAnimationFrame(drawFrame);
      };

      video.onplay = drawFrame;
      video.play().catch(reject);
    };

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load video')); };
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

interface BugReportButtonProps {
  className?: string;
}

export function BugReportButton({ className }: BugReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  // Image
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  // Video
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [videoCompressing, setVideoCompressing] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Cleanup video URL on unmount
  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); };
  }, [videoUrl]);

  const clearVideo = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoBlob(null);
    setVideoUrl(null);
    setVideoName('');
  }, [videoUrl]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`Файл слишком большой (макс. ${MAX_FILE_SIZE_MB} МБ)`);
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Поддерживаются только изображения');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      compressImage(reader.result as string).then(compressed => {
        setScreenshot(compressed);
        setScreenshotName(file.name);
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleVideoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`Файл слишком большой (макс. ${MAX_FILE_SIZE_MB} МБ)`);
      return;
    }
    if (!file.type.startsWith('video/')) {
      alert('Поддерживаются только видео');
      return;
    }
    if (videoInputRef.current) videoInputRef.current.value = '';

    setVideoCompressing(true);
    setVideoProgress(0);
    setVideoName(file.name);

    try {
      const { blob } = await compressVideo(file, setVideoProgress);
      const objUrl = URL.createObjectURL(blob);
      setVideoBlob(blob);
      setVideoUrl(objUrl);
      setVideoProgress(100);
    } catch (err) {
      console.error('❌ Video compression failed:', err);
      alert('Не удалось сжать видео. Попробуйте другой файл.');
      setVideoName('');
    } finally {
      setVideoCompressing(false);
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          compressImage(reader.result as string).then(compressed => {
            setScreenshot(compressed);
            setScreenshotName('Вставлено из буфера');
          });
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processDroppedVideo = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`Файл слишком большой (макс. ${MAX_FILE_SIZE_MB} МБ)`);
      return;
    }
    setVideoCompressing(true);
    setVideoProgress(0);
    setVideoName(file.name);
    try {
      const { blob } = await compressVideo(file, setVideoProgress);
      const objUrl = URL.createObjectURL(blob);
      setVideoBlob(blob);
      setVideoUrl(objUrl);
      setVideoProgress(100);
    } catch (err) {
      console.error('❌ Video compression failed:', err);
      alert('Не удалось сжать видео. Попробуйте другой файл.');
      setVideoName('');
    } finally {
      setVideoCompressing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        compressImage(reader.result as string).then(compressed => {
          setScreenshot(compressed);
          setScreenshotName(file.name);
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      processDroppedVideo(file);
    }
  }, [processDroppedVideo]);

  const handleSend = async () => {
    if (!description.trim() && !screenshot && !videoBlob) return;

    setIsSending(true);
    try {
      const recentActions: UserAction[] = getAutoActions(30);
      const sessionId = localStorage.getItem('planaro_anon_session_id')
        || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      const payload: any = {
        session_id: sessionId,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        error_message: `[User Report] ${description.trim().substring(0, 200) || 'Без описания'}`,
        error_stack: null,
        route: window.location.pathname,
        workspace_id: window.location.pathname.match(/\/workspace\/(\d+)/)?.[1] || null,
        actions: recentActions,
        app_version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        report_type: 'manual',
        description: description.trim() || null,
      };

      if (screenshot) {
        payload.screenshot_base64 = screenshot;
      }

      if (videoBlob) {
        payload.video_base64 = await blobToBase64(videoBlob);
      }

      const response = await fetch(`${EDGE_FUNCTION_URL}/make-server-73d66528/log-error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      console.log('📨 Bug report sent successfully');
      setSent(true);

      setTimeout(() => {
        setIsOpen(false);
        setSent(false);
        setDescription('');
        setScreenshot(null);
        setScreenshotName('');
        clearVideo();
      }, 1500);
    } catch (err) {
      console.error('❌ Failed to send bug report:', err);
      alert('Не удалось отправить. Попробуйте ещё раз.');
    } finally {
      setIsSending(false);
    }
  };

  const hasAttachment = !!screenshot || !!videoBlob;
  const hasContent = !!description.trim() || hasAttachment;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => { setIsOpen(true); setSent(false); }}
        className={`fixed bottom-5 right-5 z-[9998] flex items-center gap-2 px-3.5 py-2.5 bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all group ${className || ''}`}
        style={{ border: '0.8px solid rgba(0,0,0,0.08)' }}
        title="Сообщить об ошибке"
      >
        <MessageSquareWarning className="w-4 h-4 text-[#868789] group-hover:text-[#0062FF] transition-colors" />
        <span className="text-[12px] font-medium text-[#555] group-hover:text-[#333] transition-colors hidden sm:inline">
          Сообщить об ошибке
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-end justify-center sm:justify-end p-0 sm:p-5">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            className="relative bg-white w-full sm:w-[380px] sm:rounded-[16px] rounded-t-[16px] flex flex-col shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden sm:mb-0"
            style={{ animation: 'bugReportSlideUp 0.2s ease-out', maxHeight: '85vh' }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drop overlay — covers entire panel */}
            {isDragging && (
              <div className="absolute z-20 bg-[#0062FF]/5 border-2 border-dashed border-[#0062FF]/40 rounded-[10px] flex items-center justify-center pointer-events-none" style={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <div className="flex flex-col items-center gap-1">
                  <ImagePlus className="w-6 h-6 text-[#0062FF]/60" />
                  <p className="text-[12px] text-[#0062FF]/70">Отпустите файл</p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#FFF3E0] flex items-center justify-center">
                  <MessageSquareWarning className="w-4 h-4 text-[#F57C00]" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1a1a1a] leading-tight">Сообщить об ошибке</h3>
                  <p className="text-[11px] text-[#999] leading-tight mt-0.5">Опишите проблему — это поможет нам её найти</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-[8px] hover:bg-[#f6f6f6] transition-colors"
              >
                <X className="w-4 h-4 text-[#999]" />
              </button>
            </div>

            {/* Success state */}
            {sent ? (
              <div className="flex flex-col items-center justify-center py-10 px-5">
                <div className="w-14 h-14 rounded-full bg-[#E8F5E9] flex items-center justify-center mb-3">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#43A047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-[#333]">Отправлено!</p>
                <p className="text-[12px] text-[#999] mt-0.5">Спасибо, мы разберёмся</p>
              </div>
            ) : (
              <>
                {/* Body */}
                <div
                  className="px-5 pb-3 flex-1 overflow-y-auto relative"
                >
                  {/* Description */}
                  <textarea
                    ref={textareaRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Опишите что произошло... (Ctrl+V или перетащите скриншот)"
                    className="w-full h-[120px] p-3 text-[13px] bg-[#f6f6f6] rounded-[10px] border-none outline-none resize-none placeholder:text-[#999] text-[#333] focus:ring-2 focus:ring-[#0062FF]/20 transition-shadow mt-1"
                  />

                  {/* Attach buttons + previews */}
                  <div className="mt-3 flex gap-2">
                    {/* Screenshot column */}
                    <div className="flex-1 flex flex-col gap-2">
                      {!screenshot ? (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] text-[#868789] hover:text-[#333] bg-[#f6f6f6] hover:bg-[#efefef] rounded-[10px] transition-colors"
                        >
                          <ImagePlus className="w-3.5 h-3.5" />
                          Скриншот
                        </button>
                      ) : (
                        <div className="relative h-[140px]">
                          <img
                            src={screenshot}
                            alt="Screenshot"
                            className="w-full h-full object-cover bg-[#f6f6f6] rounded-[10px]"
                          />
                          <button
                            onClick={() => { setScreenshot(null); setScreenshotName(''); }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-[6px] bg-white/90 hover:bg-red-50 shadow-sm transition-colors"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                          <span className="absolute bottom-1.5 left-1.5 text-[9px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded-[4px]">
                            {screenshotName} · {Math.round((screenshot.length - screenshot.indexOf(',') - 1) * 3 / 4 / 1024)} КБ
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Video column */}
                    <div className="flex-1 flex flex-col gap-2">
                      {!videoBlob && !videoCompressing ? (
                        <button
                          onClick={() => videoInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] text-[#868789] hover:text-[#333] bg-[#f6f6f6] hover:bg-[#efefef] rounded-[10px] transition-colors"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Видео
                        </button>
                      ) : videoCompressing ? (
                        <div className="h-[140px] bg-[#f6f6f6] rounded-[10px] p-3 flex flex-col items-center justify-center gap-1.5">
                          <Loader2 className="w-5 h-5 animate-spin text-[#0062FF]" />
                          <p className="text-[11px] text-[#666]">Сжатие... {videoProgress}%</p>
                          <div className="w-full h-1 bg-[#e0e0e0] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0062FF] rounded-full transition-all duration-200"
                              style={{ width: `${videoProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : videoUrl ? (
                        <div className="relative h-[140px]">
                          <video
                            src={videoUrl}
                            controls
                            className="w-full h-full object-cover bg-black rounded-[10px]"
                          />
                          <button
                            onClick={clearVideo}
                            className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-[6px] bg-white/90 hover:bg-red-50 shadow-sm transition-colors"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                          <span className="absolute bottom-1.5 left-1.5 text-[9px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded-[4px]">
                            {videoName} · {videoBlob ? formatSize(videoBlob.size) : ''}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoChange}
                    className="hidden"
                  />

                  {/* Info hint */}
                  <p className="mt-3 text-[10px] text-[#bbb] leading-relaxed">
                    Вместе с описанием мы автоматически отправим контекст: маршрут, последние действия и информацию о браузере. Личные данные не передаются.
                  </p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="h-9 px-4 rounded-[10px] text-[13px] font-medium text-[#555] hover:bg-[#f6f6f6] transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isSending || !hasContent || videoCompressing}
                    className="h-9 px-4 rounded-[10px] text-[13px] font-medium text-white bg-[#0062FF] hover:bg-[#0052D9] disabled:bg-[#d6d6d6] disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Отправить
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          <style>{`
            @keyframes bugReportSlideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}