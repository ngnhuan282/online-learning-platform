import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import ErrorState from '../../../shared/components/ErrorState';
import { t } from '../../../shared/i18n/locale';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import { toeicApi } from '../api/toeicApi';
import useLearningResource from '../hooks/useLearningResource';
import { resolveToeicMediaUrl } from '../utils/toeicMedia';

const EMPTY = { assets: { content: [], totalPages: 0 }, cloudEnabled: false };
const imageTypes = 'image/jpeg,image/png,image/webp';

export default function ToeicMediaDialog({ kind, attachedUrls, onPick, onClose }) {
  const [page, setPage] = useState(0);
  const [file, setFile] = useState(null);
  const [replacement, setReplacement] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const input = useRef(null);
  const active = useRef(true);
  const pending = useRef(false);
  const load = useCallback(options => toeicApi.mediaList(kind, page, options), [kind, page]);
  const { data, loading, error: listError, reload } = useLearningResource(load, EMPTY);
  const { content, totalPages } = data.assets;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  function clearFile() {
    setFile(null);
    if (input.current) input.current.value = '';
  }

  async function mutate(operation, apply) {
    if (pending.current) return;
    const session = getSessionVersion();
    const isCurrent = () => active.current && session === getSessionVersion();
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const response = await operation();
      if (isCurrent()) apply(response?.data);
    } catch (failure) {
      if (isCurrent()) setError(failure);
    } finally {
      pending.current = false;
      if (isCurrent()) setBusy(false);
    }
  }

  function upload() {
    if (!file) return;
    return mutate(
      () =>
        replacement
          ? toeicApi.replaceMedia(replacement.id, replacement.version, file)
          : toeicApi.uploadMedia(file, kind),
      asset => {
        clearFile();
        if (!replacement && onPick) {
          onPick(asset.url);
          return;
        }
        setReplacement(null);
        setPreview(null);
        setNotice(t('Đã lưu tệp TOEIC.'));
        if (!replacement && page > 0) setPage(0);
        else reload();
      },
    );
  }

  function deleteAsset() {
    const asset = confirm;
    setConfirm(null);
    return mutate(
      () => toeicApi.deleteMedia(asset.id, asset.version),
      () => {
        if (preview?.id === asset.id) setPreview(null);
        if (replacement?.id === asset.id) {
          setReplacement(null);
          clearFile();
        }
        setNotice(t('Đã xóa tệp TOEIC.'));
        if (page && content.length === 1) setPage(page - 1);
        else reload();
      },
    );
  }

  const fileKind = replacement?.kind ?? kind;
  const accept =
    fileKind === 'AUDIO'
      ? '.mp3,audio/mpeg'
      : fileKind === 'IMAGE'
        ? imageTypes
        : `.mp3,audio/mpeg,${imageTypes}`;
  return (
    <>
      <Dialog
        open
        onClose={busy ? undefined : onClose}
        maxWidth="md"
        fullWidth
        aria-labelledby="toeic-media-title"
      >
        <DialogTitle id="toeic-media-title">{t('Kho ảnh và audio TOEIC')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {error && <ErrorState error={error} title="Không thể cập nhật tệp" />}
            {notice && <Alert severity="success">{notice}</Alert>}
            {!loading && !listError && (
              <Typography variant="body2" color="text.secondary">
                {t(
                  data.cloudEnabled
                    ? 'Tệp tải lên được lưu trên máy chủ và S3.'
                    : 'Tệp tải lên được lưu trên máy chủ local.',
                )}
              </Typography>
            )}
            {replacement && (
              <Typography>{t('Thay tệp {name}', { name: replacement.originalName })}</Typography>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
              <input
                ref={input}
                type="file"
                accept={accept}
                disabled={busy}
                onChange={event => setFile(event.target.files?.[0] ?? null)}
                aria-label={t('Chọn tệp tải lên')}
              />
              <Button
                type="button"
                variant="contained"
                disabled={!file || busy || loading || Boolean(listError)}
                onClick={upload}
              >
                {t(
                  busy
                    ? 'Đang xử lý…'
                    : replacement
                      ? 'Lưu tệp thay thế'
                      : onPick
                        ? 'Tải lên và chọn'
                        : 'Tải lên',
                )}
              </Button>
              {replacement && (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setReplacement(null);
                    clearFile();
                  }}
                >
                  {t('Hủy thay tệp')}
                </Button>
              )}
            </Stack>
            <Divider />
            {loading ? (
              <p role="status">{t('Đang tải kho tệp…')}</p>
            ) : listError ? (
              <ErrorState error={listError} onRetry={reload} />
            ) : (
              <Stack divider={<Divider />} spacing={1}>
                {content.length === 0 && <p>{t('Chưa có tệp trong kho TOEIC.')}</p>}
                {content.map(asset => {
                  const attached = attachedUrls.has(asset.url);
                  return (
                    <Box key={asset.id} sx={{ py: 1 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ alignItems: { sm: 'center' } }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                          <Typography fontWeight={600}>{asset.originalName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t(asset.kind === 'AUDIO' ? 'Audio' : 'Hình ảnh')} ·{' '}
                            {asset.cloudCopy ? 'Local + S3' : 'Local'}
                            {attached && ` · ${t('Đang gắn trong bộ đề này')}`}
                          </Typography>
                        </Box>
                        <Stack direction="row" sx={{ flexWrap: 'wrap' }}>
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setPreview(preview?.id === asset.id ? null : asset);
                              setPreviewError(false);
                            }}
                          >
                            {t(preview?.id === asset.id ? 'Đóng xem trước' : 'Xem trước')}
                          </Button>
                          {onPick && (
                            <Button type="button" disabled={busy} onClick={() => onPick(asset.url)}>
                              {t('Dùng tệp này')}
                            </Button>
                          )}
                          <Button
                            type="button"
                            disabled={busy || attached}
                            onClick={() => {
                              setReplacement(asset);
                              clearFile();
                              input.current?.focus();
                            }}
                          >
                            {t('Thay tệp')}
                          </Button>
                          <Button
                            type="button"
                            color="error"
                            disabled={busy || attached}
                            onClick={() => setConfirm(asset)}
                          >
                            {t('Xóa')}
                          </Button>
                        </Stack>
                      </Stack>
                      {preview?.id === asset.id && (
                        <Box sx={{ pt: 1 }}>
                          {previewError ? (
                            <Alert severity="info">{t('Tệp hiện chưa có hoặc không tải được.')}</Alert>
                          ) : asset.kind === 'AUDIO' ? (
                            <audio
                              src={resolveToeicMediaUrl(asset.url)}
                              controls
                              preload="metadata"
                              onError={() => setPreviewError(true)}
                              aria-label={asset.originalName}
                            />
                          ) : (
                            <Box
                              component="img"
                              src={resolveToeicMediaUrl(asset.url)}
                              alt={asset.originalName}
                              onError={() => setPreviewError(true)}
                              sx={{ maxWidth: '100%', maxHeight: 300 }}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
            {totalPages > 1 && (
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Button type="button" disabled={busy || page === 0} onClick={() => setPage(page - 1)}>
                  {t('Trang trước')}
                </Button>
                <span>
                  {page + 1} / {totalPages}
                </span>
                <Button
                  type="button"
                  disabled={busy || page + 1 >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('Trang tiếp theo')}
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" disabled={busy} onClick={onClose}>
            {t('Đóng')}
          </Button>
        </DialogActions>
      </Dialog>
      {confirm && (
        <ConfirmDialog
          open
          destructive
          title="Xóa tệp TOEIC?"
          description={confirm.originalName}
          confirmLabel={t('Xóa')}
          onClose={() => setConfirm(null)}
          onConfirm={deleteAsset}
        />
      )}
    </>
  );
}
