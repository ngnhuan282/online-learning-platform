import { useState, useRef, useEffect } from 'react';
import { mediaApi } from '../api/mediaApi';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function MediaUploader({
  folder = 'media',
  accept = 'image/*',
  label = 'Tải tệp lên',
  currentUrl = '',
  maxSizeMB = 50,
  onUploadSuccess,
  onUploadError,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const isImage = accept.includes('image') || (previewUrl && previewUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i));
  const isVideo = accept.includes('video') || (previewUrl && previewUrl.match(/\.(mp4|webm|mov)$/i));

  // Sync preview khi currentUrl thay đổi từ bên ngoài (vd: edit khóa học khác)
  useEffect(() => {
    if (!uploading) {
      setPreviewUrl(currentUrl || '');
    }
  }, [currentUrl]);

  const handleFile = async file => {
    if (!file) return;

    // Validate size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      const err = `Dung lượng tệp vượt quá giới hạn cho phép (${maxSizeMB} MB).`;
      setErrorMsg(err);
      if (onUploadError) onUploadError(err);
      return;
    }

    setErrorMsg('');
    setUploading(true);
    setProgress(0);
    setUploadedBytes(0);
    setTotalBytes(file.size);

    try {
      const res = await mediaApi.upload(file, folder, ({ percent, loaded, total }) => {
        setProgress(percent);
        setUploadedBytes(loaded);
        setTotalBytes(total);
      });

      // axiosClient interceptor đã trả về response.data, nên res = { code, message, data: {...} }
      const payload = res?.data ?? res;
      const mediaPath = payload?.objectKey
        ? `/api/v1/media/download/${payload.objectKey}`
        : payload?.url || '';
      const fileUrl = resolveMediaUrl(mediaPath);
      setPreviewUrl(fileUrl);
      setUploadedFile(payload);

      if (onUploadSuccess) {
        onUploadSuccess({ ...payload, url: mediaPath });
      }
    } catch (err) {
      const msg =
        err?.status === 413 || err?.response?.status === 413
          ? `Tệp vượt quá giới hạn tải lên (${maxSizeMB} MB).`
          : err?.response?.data?.message || err?.message || 'Tải tệp thất bại, vui lòng thử lại.';
      setErrorMsg(msg);
      if (onUploadError) onUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const handleReset = () => {
    setPreviewUrl('');
    setUploadedFile(null);
    setProgress(0);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onUploadSuccess) {
      onUploadSuccess({ objectKey: '', url: '', fileName: '', fileSize: 0, contentType: '' });
    }
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {label && (
        <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>
          {label} (Tối đa {maxSizeMB} MB)
        </span>
      )}

      {/* Dropzone container */}
      <div
        onDragOver={e => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
          borderRadius: 12,
          padding: '20px 16px',
          textAlign: 'center',
          background: dragOver ? '#eff6ff' : '#f8fafc',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
        onClick={() => {
          if (!uploading && fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          disabled={uploading}
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {uploading ? (
          <div style={{ display: 'grid', gap: 8, padding: '10px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>
              Đang tải lên... {progress}%
            </div>
            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: 8,
                backgroundColor: '#e2e8f0',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#2563eb',
                  borderRadius: 4,
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 28 }}>
              {accept.includes('video') ? '🎬' : accept.includes('image') ? '🖼️' : '📁'}
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#2563eb' }}>
              Nhấn để chọn tệp hoặc kéo thả vào đây
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Hỗ trợ: {accept.replace(/\*/g, 'tất cả')}
            </span>
          </div>
        )}
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div
          style={{
            fontSize: 13,
            color: '#dc2626',
            background: '#fef2f2',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #fecaca',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Preview Section */}
      {previewUrl && !uploading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: 10,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            {isImage ? (
              <img
                src={resolveMediaUrl(previewUrl)}
                alt="Preview"
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
              />
            ) : isVideo ? (
              <span style={{ fontSize: 24 }}>🎬</span>
            ) : (
              <span style={{ fontSize: 24 }}>📄</span>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  maxWidth: 260,
                }}
              >
                {uploadedFile?.fileName || 'Tệp đã tải lên'}
              </div>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>
                ✓ Đã tải lên máy chủ
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{
              background: 'none',
              border: 'none',
              color: '#dc2626',
              fontSize: 13,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Gỡ bỏ
          </button>
        </div>
      )}
    </div>
  );
}
