import { useCallback, useState, useEffect } from 'react';
import { mediaApi } from '../api/mediaApi';
import MediaUploader from './MediaUploader';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';

function formatBytes(bytes) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function LessonResourcesModal({ lesson, onClose }) {
  return <LessonResources key={lesson?.id} lesson={lesson} onClose={onClose} />;
}

function LessonResources({ lesson, onClose }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [resourceType, setResourceType] = useState('PDF');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadResources = useCallback(
    (isActive = () => true) =>
      mediaApi
        .listResources(lesson.id)
        .then(res => {
          if (!isActive()) return;
          const data = res?.data?.data ?? res?.data ?? res ?? [];
          setResources(Array.isArray(data) ? data : []);
        })
        .catch(err => {
          if (isActive())
            setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách tài liệu.');
        })
        .finally(() => {
          if (isActive()) setLoading(false);
        }),
    [lesson.id],
  );

  const refreshResources = () => {
    setLoading(true);
    setError('');
    return loadResources();
  };

  useEffect(() => {
    let active = true;
    if (lesson?.id) {
      loadResources(() => active);
    }
    return () => {
      active = false;
    };
  }, [lesson?.id, loadResources]);

  const handleAddResource = async e => {
    e.preventDefault();
    if (!title.trim() || !uploadedFile || submitting) return;

    setSubmitting(true);
    try {
      await mediaApi.addResource(lesson.id, {
        title: title.trim(),
        resourceType,
        fileName: uploadedFile.fileName,
        fileSize: uploadedFile.fileSize,
        contentType: uploadedFile.contentType,
        objectKey: uploadedFile.objectKey,
        downloadUrl: uploadedFile.url,
      });

      setTitle('');
      setUploadedFile(null);
      setAdding(false);
      await refreshResources();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Lỗi khi lưu tài liệu đính kèm.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResource = async resourceId => {
    if (!window.confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
    try {
      await mediaApi.deleteResource(resourceId);
      await refreshResources();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Lỗi khi xóa tài liệu.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="course-card"
        style={{
          width: '100%',
          maxWidth: 600,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Tài liệu đính kèm</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              Bài học: <strong>{lesson.title}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* List of existing resources */}
        <div style={{ marginBottom: 20 }}>
          {loading ? (
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', padding: 20 }}>
              Đang tải danh sách tài liệu...
            </p>
          ) : resources.length === 0 ? (
            <p
              style={{
                fontSize: 14,
                color: '#94a3b8',
                textAlign: 'center',
                padding: 16,
                background: '#f8fafc',
                borderRadius: 8,
              }}
            >
              Chưa có tài liệu đính kèm nào.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {resources.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <span style={{ fontSize: 20 }}>
                      {item.resourceType === 'PDF' ? '📕' : item.resourceType === 'VIDEO' ? '🎬' : '📄'}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {item.fileName} • {formatBytes(item.fileSize)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {item.downloadUrl && (
                      <a
                        href={resolveMediaUrl(item.downloadUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="button button-soft"
                        style={{ padding: '4px 10px', fontSize: 12, textDecoration: 'none' }}
                      >
                        Tải về
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteResource(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: '4px 6px',
                      }}
                      title="Xóa tài liệu"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Resource Section */}
        {!adding ? (
          <button
            type="button"
            className="button button-soft"
            onClick={() => setAdding(true)}
            style={{ width: '100%', fontSize: 14 }}
          >
            + Tải lên tài liệu mới
          </button>
        ) : (
          <form
            onSubmit={handleAddResource}
            style={{
              padding: 16,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 15 }}>Đính kèm tài liệu mới</h4>
              <button
                type="button"
                onClick={() => setAdding(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Hủy bỏ
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                Tên hiển thị tài liệu <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="VD: Slide bài giảng (PDF), Mã nguồn mẫu"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                Loại tài nguyên
              </label>
              <select
                value={resourceType}
                onChange={e => setResourceType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              >
                <option value="PDF">PDF Tài liệu</option>
                <option value="DOCUMENT">Tài liệu văn bản (Word, Excel)</option>
                <option value="SOURCE_CODE">Mã nguồn (ZIP, RAR)</option>
                <option value="IMAGE">Hình ảnh minh họa</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            <MediaUploader
              folder="documents"
              accept=".pdf,.doc,.docx,.zip,.rar,.txt,.png,.jpg"
              label="Chọn tệp đính kèm"
              maxSizeMB={30}
              onUploadSuccess={fileInfo => setUploadedFile(fileInfo)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="button button-soft"
                onClick={() => setAdding(false)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={!title.trim() || !uploadedFile || submitting}
              >
                {submitting ? 'Đang lưu...' : 'Lưu tài liệu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
