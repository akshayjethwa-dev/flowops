// src/components/AttachmentsList.tsx

import React, { useState, useEffect } from 'react';
import { 
  File, 
  FileText, 
  Image, 
  FileArchive, 
  Trash2, 
  Download, 
  Eye, 
  Calendar, 
  User, 
  ShieldAlert,
  Loader2,
  X
} from 'lucide-react';
import { onSnapshotAttachments, deleteAttachment } from '../utils/attachments';
import { Attachment } from '../types';

interface AttachmentsListProps {
  entityType: 'rfq' | 'quotation' | 'job' | 'dispatch';
  entityId: string;
  tenantId: string;
  userProfile: { uid: string; name?: string; email?: string } | null;
  userRole?: string;
  compact?: boolean;
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const AttachmentsList: React.FC<AttachmentsListProps> = ({
  entityType,
  entityId,
  tenantId,
  userProfile,
  userRole,
  compact = false
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<Attachment | null>(null);

  const isSandboxMode = localStorage.getItem('isSandboxMode') === 'true';

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshotAttachments(
      entityType,
      entityId,
      tenantId,
      isSandboxMode,
      (fetched) => {
        setAttachments(fetched);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [entityType, entityId, tenantId, isSandboxMode]);

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.startsWith('image/')) {
      return <Image className="h-5 w-5 text-sky-500" />;
    }
    if (type.includes('pdf')) {
      return <FileText className="h-5 w-5 text-rose-500" />;
    }
    if (type.includes('zip') || type.includes('tar') || type.includes('rar') || type.includes('gz')) {
      return <FileArchive className="h-5 w-5 text-amber-500" />;
    }
    return <File className="h-5 w-5 text-slate-500" />;
  };

  const handleDownload = (att: Attachment) => {
    // Elegant system browser download anchor trigger
    try {
      const link = document.createElement('a');
      link.href = att.downloadUrl;
      link.setAttribute('download', att.fileName);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      // Setting referrer policy specifically for secure iframe downloads
      link.referrerPolicy = 'no-referrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failure:', err);
      // Fallback for secure browser rules inside iframes
      window.open(att.downloadUrl, '_blank', 'noreferrer');
    }
  };

  const handleDelete = async (att: Attachment) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete "${att.fileName}"? This operation cannot be undone.`);
    if (!confirmDelete) return;

    setDeletingId(att.id);
    try {
      await deleteAttachment(att, isSandboxMode);
    } catch (err) {
      console.error('Failed to delete attachment spec:', err);
      alert('Delete privilege violated or storage bucket is unreachable.');
    } finally {
      setDeletingId(null);
    }
  };

  const isAdmin = userRole === 'admin' || userRole === 'management';
  const isOwner = (att: Attachment) => att.uploadedBy.userId === userProfile?.uid;

  if (loading) {
    return (
      <div className="flex items-center space-x-2 py-4 justify-center text-xs text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
        <span>Loading secure documents ledger...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans select-none">
      {attachments.length > 0 ? (
        <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-xl overflow-hidden bg-white">
          {attachments.map((att) => {
            const allowedToDelete = isAdmin || isOwner(att);
            const isImg = att.fileType.toLowerCase().startsWith('image/');
            const isPdf = att.fileType.toLowerCase().includes('pdf');

            return (
              <div 
                key={att.id} 
                className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/40 transition-colors select-text ${
                  deletingId === att.id ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* File Metadata Details */}
                <div className="flex items-start space-x-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {getFileIcon(att.fileType)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate" title={att.fileName}>
                      {att.fileName}
                    </p>
                    
                    {/* Timestamp / Operator */}
                    {!compact ? (
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[10px] font-mono text-slate-400">
                        <span className="font-semibold text-slate-600 bg-slate-100/60 px-1.5 py-0.5 rounded flex items-center space-x-1">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{att.uploadedBy.displayName}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-slate-350" />
                          <span>{new Date(att.uploadedAt).toLocaleDateString()} at {new Date(att.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        <span>•</span>
                        <span className="font-bold">{formatFileSize(att.size)}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {formatFileSize(att.size)} • {att.uploadedBy.displayName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Operations Actions List */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  {(isImg || isPdf) && (
                    <button
                      onClick={() => setActivePreview(att)}
                      className="p-1.5 rounded-lg border border-slate-150 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50/20 cursor-pointer transition-all"
                      title="Preview spec sheet"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDownload(att)}
                    className="p-1.5 rounded-lg border border-slate-150 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/20 cursor-pointer transition-all"
                    title="Download document file"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>

                  {allowedToDelete && (
                    <button
                      onClick={() => handleDelete(att)}
                      disabled={deletingId === att.id}
                      className="p-1.5 rounded-lg border border-slate-150 text-slate-405 hover:text-rose-600 hover:bg-rose-50/30 cursor-pointer transition-all disabled:opacity-50"
                      title="Permanently remove"
                    >
                      {deletingId === att.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
          No files or technical component drawing specs attached currently.
        </div>
      )}

      {/* EXPANDABLE INLINE PREVIEW LIGHTBOX */}
      {activePreview && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col h-[80vh] border border-slate-200 animate-slide-up">
            
            {/* Preview Banner Header */}
            <div className="p-4 border-b border-slate-150 bg-slate-50 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9px] font-bold font-mono tracking-wider uppercase text-indigo-600 block">Technical Specification Viewer</span>
                <span className="text-xs font-bold text-slate-900 truncate block mt-0.5" title={activePreview.fileName}>
                  {activePreview.fileName}
                </span>
              </div>
              <button 
                onClick={() => setActivePreview(null)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Preview Viewport Canvas */}
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
              {activePreview.fileType.toLowerCase().startsWith('image/') ? (
                <img 
                  src={activePreview.downloadUrl} 
                  alt={activePreview.fileName} 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : activePreview.fileType.toLowerCase().includes('pdf') ? (
                <iframe 
                  src={activePreview.downloadUrl} 
                  title={activePreview.fileName} 
                  className="w-full h-full border-0 rounded-lg bg-white shadow-xs"
                />
              ) : (
                <div className="text-center space-y-2">
                  <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Renderer unsupported. Touch the download action or view original documents directly.</p>
                </div>
              )}
            </div>

            {/* Preview Controller Footer */}
            <div className="p-3 border-t border-slate-150 bg-white flex items-center justify-between text-[11px] font-mono text-slate-450">
              <span>Size: {formatFileSize(activePreview.size)} Type: {activePreview.fileType}</span>
              <button
                onClick={() => {
                  handleDownload(activePreview);
                  setActivePreview(null);
                }}
                className="bg-slate-900 text-white hover:bg-slate-805 text-xs font-bold font-sans px-3 py-1.5 rounded flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" />
                <span>Open File Original</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
