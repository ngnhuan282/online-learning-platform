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
import Skeleton from '@mui/material/Skeleton';
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
            <span
              className="ai-assistant-history-count"
              aria-label={`${conversations.length} hội thoại đã tải`}
            >
              {conversations.length}
            </span>
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
        {historyPage < 0 && !historyError && (
          <div className="workspace-skeleton" role="status" aria-label="Đang tải hội thoại">
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </div>
        )}
        {historyPage >= 0 && !conversations.length && (
          <div className="ai-assistant-history-empty">
            <ChatBubbleOutlined aria-hidden="true" />
            <p>Chưa có hội thoại</p>
            <small>Các cuộc trò chuyện của bạn sẽ được lưu tại đây.</small>
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
      <div className="ai-assistant-history-footer">
        <span className="ai-assistant-footer-dot" aria-hidden="true" />
        <p>
          Không gian học tập riêng<small>Chỉ bạn xem được lịch sử của mình.</small>
        </p>
      </div>
    </aside>
  );
}
