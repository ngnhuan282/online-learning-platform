import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Chip, IconButton, TextField, Tooltip } from '@mui/material';
import { ArrowBack, AutoAwesomeOutlined, DeleteOutlined, Refresh, SendOutlined } from '@mui/icons-material';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import { ROUTES } from '../../../shared/constants/routes';
import { aiApi } from '../api/aiApi';
import { getAiErrorMessage, readCapabilities } from '../utils/aiState';
import '../styles/ai-assistant.css';

export default function AiAssistantPage() {
  const [state, setState] = useState({ loading: true, capabilities: null, error: null });
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    aiApi
      .getCapabilities({ signal: controller.signal })
      .then(response => {
        if (!controller.signal.aborted) {
          setState({ loading: false, capabilities: readCapabilities(response.data), error: null });
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ loading: false, capabilities: null, error });
      });
    return () => controller.abort();
  }, [retry]);

  function refresh() {
    setState({ loading: true, capabilities: null, error: null });
    setRetry(value => value + 1);
  }

  const maxLength = state.capabilities?.maxMessageLength ?? 4000;
  const error = state.error ? new Error(getAiErrorMessage(state.error)) : null;

  return (
    <section className="ai-assistant-page">
      <div className="container">
        <div className="ai-assistant-heading">
          <div>
            <span className="eyebrow">KHÔNG GIAN HỌC TẬP</span>
            <h1>Trợ lý học tập AI</h1>
          </div>
          <Button component={Link} to={ROUTES.COURSES} variant="outlined" startIcon={<ArrowBack />}>
            Khóa học
          </Button>
        </div>

        <div className="ai-assistant-workspace">
          <aside className="ai-assistant-history" aria-label="Lịch sử hội thoại">
            <h2>Hội thoại</h2>
            <p className="ai-assistant-muted">Lịch sử hội thoại chưa khả dụng.</p>
          </aside>
          <div className="ai-assistant-chat">
            <div className="ai-assistant-toolbar">
              <h2>Cuộc trò chuyện mới</h2>
              <div className="ai-assistant-tools">
                <Chip
                  label={state.loading ? 'Đang kết nối' : error ? 'Mất kết nối' : 'Chưa sẵn sàng'}
                  size="small"
                />
                <Tooltip title="Kiểm tra kết nối">
                  <span>
                    <IconButton aria-label="Kiểm tra kết nối" disabled={state.loading} onClick={refresh}>
                      <Refresh fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            </div>

            <div className="ai-assistant-messages" role="log" aria-label="Nội dung hội thoại">
              {state.loading ? (
                <AppLoading label="Đang kết nối trợ lý AI..." />
              ) : error ? (
                <ErrorState error={error} title="Không thể kết nối trợ lý AI" onRetry={refresh} />
              ) : (
                <div className="ai-assistant-empty">
                  <AutoAwesomeOutlined className="ai-assistant-symbol" />
                  <h2>Chưa có tin nhắn</h2>
                  <Alert severity="info">Trợ lý AI chưa sẵn sàng. Vui lòng quay lại sau.</Alert>
                </div>
              )}
            </div>

            <div className="ai-assistant-composer">
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                label="Câu hỏi của bạn"
                placeholder="Nhập câu hỏi về bài học..."
                value={draft}
                onChange={event => setDraft(event.target.value)}
                slotProps={{ htmlInput: { maxLength } }}
              />
              <div className="ai-assistant-composer-actions">
                <span className="ai-assistant-muted">
                  {draft.length}/{maxLength}
                </span>
                <div className="ai-assistant-tools">
                  <Tooltip title="Xóa bản nháp">
                    <span>
                      <IconButton aria-label="Xóa bản nháp" disabled={!draft} onClick={() => setDraft('')}>
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Trợ lý AI chưa sẵn sàng">
                    <span>
                      <IconButton aria-label="Gửi câu hỏi" disabled>
                        <SendOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
