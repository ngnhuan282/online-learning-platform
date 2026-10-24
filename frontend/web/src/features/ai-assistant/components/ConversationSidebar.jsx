import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Add from '@mui/icons-material/Add';
import ChatBubbleOutlined from '@mui/icons-material/ChatBubbleOutlined';
import Close from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import Refresh from '@mui/icons-material/Refresh';
import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import AppLoading from '../../../shared/components/AppLoading';
import { getAiErrorMessage, groupConversations } from '../utils/aiState';

export default function ConversationSidebar({
  conversations,
  selectedId,
  sending,
  historyPage,
  historyLast,
  historyBusy,
  historyError,
  onSelect,
  onRetry,
  onMore,
  onClose,
}) {
  const groups = groupConversations(conversations);

  return (
    <aside className="ai-assistant-history" aria-label="Lịch sử hội thoại">
      <div className="ai-assistant-history-top">
        <div className="ai-assistant-history-heading">
          <div>
            <HistoryOutlined fontSize="small" aria-hidden="true" />
            <h2>Hội thoại</h2>
          </div>
          {onClose && (
            <Tooltip title="Đóng danh sách hội thoại">
              <IconButton aria-label="Đóng danh sách hội thoại" onClick={onClose} size="small">
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </div>
        <Button
          className="ai-assistant-new-conversation"
          variant="contained"
          disableElevation
          fullWidth
          startIcon={<Add />}
          aria-label="Hội thoại mới"
          disabled={sending}
          onClick={() => onSelect(null)}
        >
          Hội thoại mới
        </Button>
      </div>
      <div className="ai-assistant-history-scroll">
        {historyError && (
          <Alert
            severity="error"
            action={
              <IconButton aria-label="Tải lại hội thoại" onClick={onRetry}>
                <Refresh fontSize="small" />
              </IconButton>
            }
          >
            {getAiErrorMessage(historyError)}
          </Alert>
        )}
        {historyPage < 0 && !historyError && <AppLoading label="Đang tải hội thoại..." />}
        {historyPage >= 0 && !conversations.length && (
          <div className="ai-assistant-history-empty">
            <ChatBubbleOutlined aria-hidden="true" />
            <p>Chưa có hội thoại</p>
          </div>
        )}
        <nav className="ai-assistant-conversation-list" aria-label="Các hội thoại">
          {groups.map(group => (
            <section className="ai-assistant-conversation-group" key={group.label}>
              <h3>{group.label}</h3>
              {group.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  disabled={sending}
                  className={String(item.id) === selectedId ? 'is-active' : ''}
                  aria-current={String(item.id) === selectedId ? 'page' : undefined}
                  title={item.title}
                  onClick={() => onSelect(item.id)}
                >
                  <ChatBubbleOutlined className="ai-assistant-conversation-icon" aria-hidden="true" />
                  <span className="ai-assistant-conversation-info">
                    <strong>{item.title}</strong>
                    <span className="ai-assistant-conversation-meta">
                      {item.contextTitle ? (
                        <span className="ai-assistant-conversation-context" title={item.contextTitle}>
                          <SchoolOutlined aria-hidden="true" />
                          <span>{item.contextTitle}</span>
                        </span>
                      ) : (
                        <span>Học tập tự do</span>
                      )}
                      <time dateTime={item.updatedAt}>
                        {new Date(item.updatedAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </time>
                    </span>
                  </span>
                </button>
              ))}
            </section>
          ))}
        </nav>
        {!historyLast && (
          <Button
            className="ai-assistant-history-more"
            fullWidth
            endIcon={<ExpandMore />}
            disabled={historyBusy || sending}
            onClick={onMore}
          >
            Xem thêm
          </Button>
        )}
      </div>
    </aside>
  );
}
