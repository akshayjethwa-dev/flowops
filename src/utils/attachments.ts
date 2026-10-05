// src/utils/attachments.ts

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, deleteDoc, query, where, onSnapshot, doc, serverTimestamp } from 'firebase/firestore';
import { db, storage, auth } from '../firebase';
import { Attachment } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { logActivityEvent } from './activityLogger';

// Global memory cache for in-session sandbox files (handles large files without localStorage limit crashes)
if (typeof window !== 'undefined') {
  (window as any).__sandboxFiles = (window as any).__sandboxFiles || {};
}

/**
 * Converts a File object to base64 string (for small files)
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Uploads an attachment to Firebase Storage (or localStorage base64/ObjectURL in Sandbox Mode)
 * and records the metadata in Firestore (or localStorage).
 */
export const uploadAttachment = async (
  file: File,
  entityType: 'rfq' | 'quotation' | 'job' | 'dispatch',
  entityId: string,
  tenantId: string,
  userProfile: { uid: string; name?: string; email?: string } | null,
  onProgress?: (pct: number) => void
): Promise<Attachment> => {
  const isSandboxMode = localStorage.getItem('isSandboxMode') === 'true' || !db || !storage;
  const attachmentId = `attach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const storagePath = `tenants/${tenantId}/${entityType}/${entityId}/${attachmentId}_${file.name}`;

  const defaultActor = {
    userId: userProfile?.uid || auth.currentUser?.uid || 'unknown_user',
    displayName: userProfile?.name || auth.currentUser?.email || 'Factory Operator',
    email: userProfile?.email || auth.currentUser?.email || ''
  };

  if (isSandboxMode) {
    onProgress?.(30);
    // Determine download URL for sandbox
    let downloadUrl = '';
    
    // If file is reasonably small (< 1.5MB), store as base64 so it persists reload
    if (file.size < 1.5 * 1024 * 1024) {
      try {
        downloadUrl = await fileToBase64(file);
      } catch (err) {
        console.warn('Failed to convert sandbox file to base64, using Object URL instead', err);
        downloadUrl = URL.createObjectURL(file);
      }
    } else {
      downloadUrl = URL.createObjectURL(file);
    }
    
    onProgress?.(70);

    // Save actual File object reference in session memory for full-fidelity downloading/previews
    if (typeof window !== 'undefined') {
      (window as any).__sandboxFiles[attachmentId] = file;
    }

    const newAttachment: Attachment = {
      id: attachmentId,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      size: file.size,
      uploadedBy: defaultActor,
      uploadedAt: new Date().toISOString(),
      tenantId,
      entityType,
      entityId,
      storagePath,
      downloadUrl,
      isLocalSimulated: true
    };

    // Store metadata list in localStorage
    try {
      const cached = localStorage.getItem(`flowops_attachments_${tenantId}`) || '[]';
      const parsed = JSON.parse(cached);
      localStorage.setItem(`flowops_attachments_${tenantId}`, JSON.stringify([newAttachment, ...parsed]));
    } catch (err) {
      console.error('Failed to cache attachment metadata in sandbox localStorage', err);
    }

    onProgress?.(100);

    // Dynamic central activity logs logging
    logActivityEvent({
      tenantId,
      actionType: 'create',
      entityType: 'rfq', // log as an rfq/system style trace event
      entityId,
      actor: defaultActor,
      description: `Uploaded attachment "${file.name}" for ${entityType.toUpperCase()} #${entityId}.`,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        entityType,
        entityId
      },
      isSandboxMode: true
    });

    return newAttachment;
  } else {
    // Real Firebase Storage upload
    return new Promise((resolve, reject) => {
      const fileRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.(Math.round(progress));
        },
        (error) => {
          console.error('Firebase Storage upload failed:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Record meta document inside Firestore collection
            const metaColPath = `tenants/${tenantId}/attachments`;
            const docData = {
              id: attachmentId,
              fileName: file.name,
              fileType: file.type || 'application/octet-stream',
              size: file.size,
              uploadedBy: defaultActor,
              uploadedAt: new Date().toISOString(),
              tenantId,
              entityType,
              entityId,
              storagePath,
              downloadUrl
            };

            await addDoc(collection(db, metaColPath), docData);

            // Log activity audit
            logActivityEvent({
              tenantId,
              actionType: 'create',
              entityType: 'rfq',
              entityId,
              actor: defaultActor,
              description: `Uploaded drawing/document file "${file.name}" to cloud storage for ${entityType.toUpperCase()} #${entityId}.`,
              metadata: {
                fileName: file.name,
                fileSize: file.size,
                entityType,
                entityId,
                storagePath
              },
              isSandboxMode: false
            });

            resolve(docData as Attachment);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }
};

/**
 * Deletes an attachment from Storage and metadata from Firestore (or localStorage).
 */
export const deleteAttachment = async (
  attachment: Attachment,
  isSandboxMode: boolean
): Promise<void> => {
  const { tenantId, id, fileName, storagePath, entityType, entityId } = attachment;
  const currentActor = {
    userId: auth.currentUser?.uid || 'unknown_user',
    displayName: auth.currentUser?.email || 'Factory Operator'
  };

  if (isSandboxMode || !db || !storage) {
    try {
      // Remove from localStorage
      const cached = localStorage.getItem(`flowops_attachments_${tenantId}`) || '[]';
      let parsed = JSON.parse(cached) as Attachment[];
      parsed = parsed.filter(a => a.id !== id);
      localStorage.setItem(`flowops_attachments_${tenantId}`, JSON.stringify(parsed));

      // Remove from session cache if existing
      if (typeof window !== 'undefined' && (window as any).__sandboxFiles) {
        delete (window as any).__sandboxFiles[id];
      }

      // Log deleted event
      logActivityEvent({
        tenantId,
        actionType: 'deactivate',
        entityType: 'rfq',
        entityId,
        actor: currentActor,
        description: `Permanently removed drawing/document "${fileName}" from ${entityType.toUpperCase()} #${entityId}.`,
        metadata: {
          fileName,
          attachmentId: id,
          entityType,
          entityId
        },
        isSandboxMode: true
      });
    } catch (err) {
      console.error('Failed to delete attachment from sandbox localStorage', err);
    }
  } else {
    // 1. Delete Firestore Metadata
    const metaColPath = `tenants/${tenantId}/attachments`;
    try {
      const q = query(collection(db, metaColPath), where('id', '==', id));
      const qSnap = await getDocs(q);
      for (const docSnap of qSnap.docs) {
        await deleteDoc(doc(db, metaColPath, docSnap.id));
      }
    } catch (err) {
      console.error('Failed to remove attachment document in Firestore:', err);
      handleFirestoreError(err, OperationType.DELETE, metaColPath);
    }

    // 2. Delete actual object in Storage
    if (storagePath) {
      try {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn('Storage path deletion was neglected or failed, object may already be empty:', err);
      }
    }

    // Log deleted event in production
    logActivityEvent({
      tenantId,
      actionType: 'deactivate',
      entityType: 'rfq',
      entityId,
      actor: currentActor,
      description: `Permanently removed file spec "${fileName}" from ${entityType.toUpperCase()} #${entityId}.`,
      metadata: {
        fileName,
        attachmentId: id,
        entityType,
        entityId
      },
      isSandboxMode: false
    });
  }
};

/**
 * Sets up a realtime onSnapshot stream subscription for attachments of a specific entity.
 */
export const onSnapshotAttachments = (
  entityType: 'rfq' | 'quotation' | 'job' | 'dispatch',
  entityId: string,
  tenantId: string,
  isSandboxMode: boolean,
  callback: (attachments: Attachment[]) => void
): (() => void) => {
  if (isSandboxMode || !db) {
    const fetchLocal = () => {
      try {
        const cached = localStorage.getItem(`flowops_attachments_${tenantId}`) || '[]';
        const parsed = JSON.parse(cached) as Attachment[];
        const filtered = parsed.filter(a => a.entityType === entityType && a.entityId === entityId);
        callback(filtered);
      } catch (err) {
        console.error('Error in sandbox attachments fetch:', err);
        callback([]);
      }
    };

    fetchLocal();
    const interval = setInterval(fetchLocal, 1500); // Polling update interval
    return () => clearInterval(interval);
  } else {
    const metaColPath = `tenants/${tenantId}/attachments`;
    const colRef = collection(db, metaColPath);
    const q = query(colRef, where('entityType', '==', entityType), where('entityId', '==', entityId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Attachment[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Attachment);
        });
        // Sort by uploadedAt descending
        list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        callback(list);
      },
      (err) => {
        console.error('Failed to stream Firestore attachments list:', err);
        handleFirestoreError(err, OperationType.LIST, metaColPath);
      }
    );

    return unsubscribe;
  }
};
