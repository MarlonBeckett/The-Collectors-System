'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/lib/supabase/client';
import { Photo } from '@/types/database';
import Image from 'next/image';
import { CloudArrowUpIcon, XMarkIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';

interface PhotoUploaderProps {
  motorcycleId: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

export function PhotoUploader({ motorcycleId }: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const supabase = createClient();

  // Load existing photos
  useEffect(() => {
    const loadPhotos = async () => {
      const { data } = await supabase
        .from('photos')
        .select('*')
        .eq('motorcycle_id', motorcycleId)
        .order('display_order', { ascending: true });

      if (data) {
        setPhotos(data);
        // Load signed URLs
        const urls: Record<string, string> = {};
        for (const photo of data) {
          const { data: urlData } = await supabase.storage
            .from('motorcycle-photos')
            .createSignedUrl(photo.storage_path, 3600);
          if (urlData?.signedUrl) {
            urls[photo.id] = urlData.signedUrl;
          }
        }
        setImageUrls(urls);
      }
    };

    loadPhotos();
  }, [motorcycleId, supabase]);

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${motorcycleId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('motorcycle-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Create photo record
    const maxOrder = photos.length > 0
      ? Math.max(...photos.map(p => p.display_order))
      : -1;

    const { data: photoData, error: dbError } = await supabase
      .from('photos')
      .insert({
        motorcycle_id: motorcycleId,
        storage_path: fileName,
        display_order: maxOrder + 1,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file
      await supabase.storage.from('motorcycle-photos').remove([fileName]);
      throw dbError;
    }

    // Get signed URL for the new photo
    const { data: urlData } = await supabase.storage
      .from('motorcycle-photos')
      .createSignedUrl(fileName, 3600);

    return { photo: photoData, signedUrl: urlData?.signedUrl };
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newUploading = acceptedFiles.map(file => ({
      file,
      progress: 0,
    }));
    setUploading(prev => [...prev, ...newUploading]);

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      try {
        // Update progress to show we're uploading
        setUploading(prev =>
          prev.map(u =>
            u.file === file ? { ...u, progress: 50 } : u
          )
        );

        const result = await uploadFile(file);

        if (result) {
          setPhotos(prev => [...prev, result.photo]);
          if (result.signedUrl) {
            setImageUrls(prev => ({
              ...prev,
              [result.photo.id]: result.signedUrl!,
            }));
          }
        }

        // Remove from uploading list
        setUploading(prev => prev.filter(u => u.file !== file));
      } catch (error) {
        setUploading(prev =>
          prev.map(u =>
            u.file === file
              ? { ...u, progress: 0, error: error instanceof Error ? error.message : 'Upload failed' }
              : u
          )
        );
      }
    }
  }, [motorcycleId, photos]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const deletePhoto = async (photo: Photo) => {
    // Delete from storage
    await supabase.storage
      .from('motorcycle-photos')
      .remove([photo.storage_path]);

    // Delete from database
    await supabase
      .from('photos')
      .delete()
      .eq('id', photo.id);

    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    setImageUrls(prev => {
      const newUrls = { ...prev };
      delete newUrls[photo.id];
      return newUrls;
    });
  };

  const movePhoto = async (fromIndex: number, toIndex: number) => {
    const newPhotos = [...photos];
    const [moved] = newPhotos.splice(fromIndex, 1);
    newPhotos.splice(toIndex, 0, moved);

    // Update display_order for all affected photos
    const updates = newPhotos.map((photo, index) => ({
      id: photo.id,
      display_order: index,
    }));

    setPhotos(newPhotos.map((p, i) => ({ ...p, display_order: i })));

    // Update in database
    for (const update of updates) {
      await supabase
        .from('photos')
        .update({ display_order: update.display_order })
        .eq('id', update.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary'
        }`}
      >
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">
          {isDragActive
            ? 'Drop photos here...'
            : 'Drag photos here or tap to select'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          JPG, PNG, WebP, HEIC (max 10MB)
        </p>
      </div>

      {/* Uploading Files */}
      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((item, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-2 border ${
                item.error ? 'border-destructive bg-destructive/10' : 'border-border'
              }`}
            >
              <div className="w-10 h-10 bg-muted animate-pulse" />
              <div className="flex-1">
                <p className="text-sm truncate">{item.file.name}</p>
                {item.error ? (
                  <p className="text-xs text-destructive">{item.error}</p>
                ) : (
                  <div className="w-full bg-muted h-1 mt-1">
                    <div
                      className="bg-primary h-1 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Existing Photos */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => setIsReordering(!isReordering)}
              className={`flex items-center gap-1 text-sm px-2 py-1 ${
                isReordering ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              <ArrowsUpDownIcon className="w-4 h-4" />
              {isReordering ? 'Done' : 'Reorder'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative aspect-square bg-muted group"
              >
                {imageUrls[photo.id] ? (
                  <Image
                    src={imageUrls[photo.id]}
                    alt={`Photo ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 33vw, 200px"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full animate-pulse" />
                )}

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => deletePhoto(photo)}
                  className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete photo"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>

                {/* Reorder Buttons */}
                {isReordering && (
                  <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => movePhoto(index, index - 1)}
                        className="flex-1 py-1 bg-background/80 text-xs"
                      >
                        ←
                      </button>
                    )}
                    {index < photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() => movePhoto(index, index + 1)}
                        className="flex-1 py-1 bg-background/80 text-xs"
                      >
                        →
                      </button>
                    )}
                  </div>
                )}

                {/* Order Number */}
                <div className="absolute top-1 left-1 w-5 h-5 bg-background/80 flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
