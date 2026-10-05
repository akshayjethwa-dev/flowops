// src/components/FileUploader.tsx

import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, RefreshCw } from 'lucide-react';
import { uploadAttachment } from '../utils/attachments';
import { Attachment } from '../types';

interface FileUploaderProps {
  entityType: 'rfq' | 'quotation' | 'job' | 'dispatch';
  entityId: string;
  tenantId: string;
  userProfile: { uid: string; name?: string; email?: string } | null;
  onUploadSuccess?: (attachment: Attachment) => void;
  onUploadError?: (error: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  entityType,
  entityId,
  tenantId,
  userProfile,
  onUploadSuccess,
  onUploadError
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    // Standard business logic limits - e.g. Max 15MB file sizes
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_SIZE) {
      const sizeErr = `File ${file.name} is too large. Business limits allow up to 15MB drawings/specifications.`;
      setErrorMsg(sizeErr);
      onUploadError?.(sizeErr);
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setErrorMsg(null);

    try {
      const attachment = await uploadAttachment(
        file,
        entityType,
        entityId,
        tenantId,
        userProfile,
        (progress) => {
          setUploadProgress(progress);
        }
      );
      
      setUploadProgress(null);
      setLoading(false);
      onUploadSuccess?.(attachment);
    } catch (err: any) {
      console.error('Attachment upload failed:', err);
      const friendlyErr = err?.message || 'Upload aborted by storage provider rules or offline state.';
      setErrorMsg(friendlyErr);
      onUploadError?.(friendlyErr);
      setUploadProgress(null);
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3 font-sans select-none">
      <div
        id={`drop-zone-${entityId}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={handleButtonClick}
        className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer text-center ${
          isDragActive 
            ? 'border-indigo-500 bg-indigo-50/10 scale-[0.99] shadow-inner' 
            : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
        } ${loading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          disabled={loading}
        />

        {loading ? (
          <div className="space-y-4 w-full max-w-xs flex flex-col items-center">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
            <div className="space-y-1.5 w-full">
              <span className="text-xs font-bold text-slate-700 block">Uploading & verifying file integrity...</span>
              {uploadProgress !== null && (
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-650 h-1.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              <span className="text-[10px] font-mono text-slate-400 block">{uploadProgress}% uploaded</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <UploadCloud className="h-5.5 w-5.5 text-indigo-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Drag spec sheets, drawings, or PDFs here
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                or click to browse local folders (Max size: 15MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-xs flex items-start space-x-2 animate-fade-in select-text">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div className="leading-normal">
            <span className="font-bold">Technical Guard Alert:</span> {errorMsg}
          </div>
        </div>
      )}
    </div>
  );
};
