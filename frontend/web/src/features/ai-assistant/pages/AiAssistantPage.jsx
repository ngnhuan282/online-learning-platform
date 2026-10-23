import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import ArrowBack from '@mui/icons-material/ArrowBack';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import ChatBubbleOutlined from '@mui/icons-material/ChatBubbleOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import Refresh from '@mui/icons-material/Refresh';
import QuizOutlined from '@mui/icons-material/QuizOutlined';
import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import SpellcheckOutlined from '@mui/icons-material/SpellcheckOutlined';
import TranslateOutlined from '@mui/icons-material/TranslateOutlined';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import { ROUTES } from '../../../shared/constants/routes';
import useAuth from '../../auth/hooks/useAuth';
import { aiApi } from '../api/aiApi';
import AiMessage from '../components/AiMessage';
import ConversationSidebar from '../components/ConversationSidebar';
import { getAiErrorMessage, mergeMessages, readCapabilities, readContext } from '../utils/aiState';
import '../styles/ai-assistant.css';

function ChatWorkspace() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('conversationId');
  const [capabilities, setCapabilities] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [historyPage, setHistoryPage] = useState(-1);
  const [historyLast, setHistoryLast] = useState(true);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagePage, setMessagePage] = useState(0);
  const [messageLast, setMessageLast] = useState(true);
  const [messageBusy, setMessageBusy] = useState(Boolean(selectedId));
  const [messageError, setMessageError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const mobile = useMediaQuery('(max-width: 800px)');
  const alive = useRef(true);
  const pending = useRef(false);
  const revision = useRef(0);
  const log = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    aiApi
      .getCapabilities({ signal: controller.signal })
      .then(response => {
        if (!controller.signal.aborted) {
          setCapabilities(readCapabilities(response.data));
          setConnectionError(null);
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) setConnectionError(error);
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    aiApi
      .getConversations({}, { signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        setConversations(response.data.content);
        setHistoryPage(0);
        setHistoryLast(response.data.last);
        setHistoryError(null);
      })
      .catch(error => {
        if (!controller.signal.aborted) setHistoryError(error);
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    const version = ++revision.current;
    if (!selectedId) {
      return () => controller.abort();
    }
    Promise.all([
      aiApi.getConversation(selectedId, { signal: controller.signal }),
      aiApi.getMessages(selectedId, {}, { signal: controller.signal }),
    ])
      .then(([metadata, history]) => {
        if (controller.signal.aborted || version !== revision.current) return;
        setConversation(metadata.data);
        setMessages(mergeMessages([], history.data.content));
        setMessagePage(0);
        setMessageLast(history.data.last);
        setMessageError(null);
      })
      .catch(error => {
        if (!controller.signal.aborted) setMessageError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMessageBusy(false);
      });
    return () => controller.abort();
  }, [selectedId, retry]);

  useEffect(() => {
    if (messagePage === 0) log.current?.scrollTo?.({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, messagePage]);

  async function moreConversations() {
    if (historyBusy || pending.current) return;
    setHistoryBusy(true);
    try {
      const response = await aiApi.getConversations({ page: historyPage + 1 });
      if (!alive.current) return;
      setConversations(current => [
        ...new Map([...current, ...response.data.content].map(item => [item.id, item])).values(),
      ]);
      setHistoryPage(response.data.page);
      setHistoryLast(response.data.last);
      setHistoryError(null);
    } catch (error) {
      if (alive.current) setHistoryError(error);
    } finally {
      if (alive.current) setHistoryBusy(false);
    }
  }

  async function olderMessages() {
    if (messageBusy || pending.current) return;
    setMessageBusy(true);
    const version = revision.current;
    try {
      const response = await aiApi.getMessages(selectedId, { page: messagePage + 1 });
      if (!alive.current || version !== revision.current) return;
      setMessages(current => mergeMessages(current, response.data.content));
      setMessagePage(response.data.page);
      setMessageLast(response.data.last);
    } catch (error) {
      if (alive.current && version === revision.current) setMessageError(error);
    } finally {
      if (alive.current && version === revision.current) setMessageBusy(false);
    }
  }

  function selectConversation(id) {
    if (pending.current) return;
    setHistoryOpen(false);
    setDraft('');
    setFailed(null);
    if (!id) {
      setConversation(null);
      setMessages([]);
      setMessageError(null);
      setMessageLast(true);
    }
    setParams(id ? { conversationId: String(id) } : {});
  }

  async function send(previous) {
    const content = previous?.content ?? draft.trim();
    if (
      pending.current ||
      !content ||
      !capabilities?.available ||
      content.length > capabilities.maxMessageLength
    )
      return;
    pending.current = true;
    setSending(true);
    setMessageError(null);
    const attempt = {
      ...(previous ??
        (failed?.content === content
          ? failed
          : {
              content,
              requestId: crypto.randomUUID(),
              conversationId: selectedId ?? conversation?.id,
            })),
    };
    try {
      if (!attempt.conversationId) {
        const created = await aiApi.createConversation(readContext(params));
        attempt.conversationId = created.data.id;
        if (!alive.current) return;
        setConversation(created.data);
        setConversations(current => [created.data, ...current.filter(item => item.id !== created.data.id)]);
      }
      const response = await aiApi.sendMessage(attempt.conversationId, content, attempt.requestId);
      if (!alive.current) return;
      revision.current++;
      setMessages(current => mergeMessages(current, response.data));
      setDraft('');
      setFailed(null);
      setMessagePage(0);
      setParams({ conversationId: String(attempt.conversationId) }, { replace: true });
      setRetry(value => value + 1);
    } catch (error) {
      if (!alive.current) return;
      setFailed({ ...attempt, error });
    } finally {
      pending.current = false;
      if (alive.current) {
        setSending(false);
        input.current?.focus();
      }
    }
  }

  const maxLength = capabilities?.maxMessageLength ?? 4000;
  const blocked =
    sending || messageBusy || Boolean(messageError) || !capabilities?.available || Boolean(connectionError);
  const contextTitle = conversation?.contextTitle;
  const hasLessonContext = Boolean(conversation?.lessonId || (!selectedId && params.get('lessonId')));
  const latestError = failed?.error;
  const status = connectionError
    ? 'Mất kết nối'
    : !capabilities
      ? 'Đang kết nối'
      : capabilities.available
        ? 'Sẵn sàng'
        : 'Chưa cấu hình AI';
  const sidebar = (
    <ConversationSidebar
      conversations={conversations}
      selectedId={selectedId}
      sending={sending}
      historyPage={historyPage}
      historyLast={historyLast}
      historyBusy={historyBusy}
      historyError={historyError}
      onSelect={selectConversation}
      onRetry={() => setRetry(value => value + 1)}
      onMore={moreConversations}
      onClose={mobile ? () => setHistoryOpen(false) : undefined}
    />
  );

  function choosePrompt(content) {
    setDraft(content);
    setFailed(null);
    input.current?.focus();
  }

  return (
    <section className="ai-assistant-page">
      <div className="container">
        <div className="ai-assistant-heading">
          <div>
            <span className="ai-assistant-heading-icon" aria-hidden="true">
              <AutoAwesomeOutlined />
            </span>
            <h1>Trợ lý học tập AI</h1>
          </div>
          <Button component={Link} to={ROUTES.COURSES} variant="outlined" startIcon={<ArrowBack />}>
            Khóa học
          </Button>
        </div>
        <div className="ai-assistant-workspace">
          {mobile ? (
            <Drawer
              open={historyOpen}
              onClose={() => setHistoryOpen(false)}
              slotProps={{ paper: { className: 'ai-assistant-history-drawer' } }}
            >
              {sidebar}
            </Drawer>
          ) : (
            sidebar
          )}
          <div className="ai-assistant-chat">
            <div className="ai-assistant-toolbar">
              <div className="ai-assistant-conversation-heading">
                {mobile && (
                  <Tooltip title="Danh sách hội thoại">
                    <IconButton
                      aria-label="Mở danh sách hội thoại"
                      aria-expanded={historyOpen}
                      onClick={() => setHistoryOpen(true)}
                    >
                      <ChatBubbleOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <div>
                  <h2 title={conversation?.title}>{conversation?.title || 'Cuộc trò chuyện mới'}</h2>
                  <p className="ai-assistant-context">
                    {contextTitle ? <SchoolOutlined /> : <AutoAwesomeOutlined />}
                    <span>{contextTitle || 'Trợ lý học tiếng Anh'}</span>
                  </p>
                </div>
              </div>
              <div className="ai-assistant-tools">
                <Chip
                  label={status}
                  size="small"
                  color={capabilities?.available && !connectionError ? 'success' : 'default'}
                  variant="outlined"
                />
                <Tooltip title="Làm mới">
                  <span>
                    <IconButton
                      aria-label="Làm mới"
                      disabled={sending || messageBusy}
                      onClick={() => setRetry(value => value + 1)}
                    >
                      <Refresh fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            </div>
            {params.get('courseId') && !selectedId && (
              <Alert severity="info">
                Ngữ cảnh: khóa học #{params.get('courseId')}
                {params.get('lessonId') ? ` / bài học #${params.get('lessonId')}` : ''}
              </Alert>
            )}
            {(connectionError || (capabilities && !capabilities.available)) && (
              <Alert severity="warning">
                {connectionError
                  ? getAiErrorMessage(connectionError)
                  : 'Trợ lý AI chưa được cấu hình. Lịch sử hội thoại vẫn có thể xem lại.'}
              </Alert>
            )}
            <div
              className="ai-assistant-messages"
              role="log"
              aria-label="Nội dung hội thoại"
              aria-live="polite"
              ref={log}
            >
              {!messageLast && (
                <Button disabled={messageBusy || sending} onClick={olderMessages}>
                  Tin nhắn trước
                </Button>
              )}
              {messageBusy && <AppLoading label="Đang tải tin nhắn..." />}
              {messageError && (
                <ErrorState
                  error={new Error(getAiErrorMessage(messageError))}
                  title="Không thể tải hội thoại"
                  onRetry={() => setRetry(value => value + 1)}
                />
              )}
              {!messageBusy && !messageError && !messages.length && !sending && (
                <div className="ai-assistant-empty">
                  <span className="ai-assistant-empty-icon" aria-hidden="true">
                    <AutoAwesomeOutlined />
                  </span>
                  <h2>Bạn muốn học gì hôm nay?</h2>
                  <div className="ai-assistant-prompts">
                    {hasLessonContext && (
                      <>
                        <Button
                          variant="outlined"
                          startIcon={<MenuBookOutlined />}
                          disabled={blocked}
                          onClick={() =>
                            choosePrompt(
                              'Tóm tắt nội dung bài học đang chọn bằng tiếng Việt, nêu các ý chính và ví dụ. Nếu chưa có nội dung bài học, hãy cho mình biết.',
                            )
                          }
                        >
                          Tóm tắt bài học
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<QuizOutlined />}
                          disabled={blocked}
                          onClick={() =>
                            choosePrompt(
                              'Tạo 5 câu hỏi trắc nghiệm để luyện tập nội dung bài học đang chọn, kèm đáp án và giải thích. Nếu chưa có nội dung bài học, hãy cho mình biết.',
                            )
                          }
                        >
                          Câu hỏi luyện tập
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<MenuBookOutlined />}
                      disabled={blocked}
                      onClick={() =>
                        choosePrompt('Giải thích thì hiện tại hoàn thành bằng tiếng Việt, kèm 3 ví dụ.')
                      }
                    >
                      Ôn ngữ pháp
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<TranslateOutlined />}
                      disabled={blocked}
                      onClick={() => choosePrompt('Cho mình 5 từ vựng tiếng Anh về công việc, kèm ví dụ.')}
                    >
                      Luyện từ vựng
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SpellcheckOutlined />}
                      disabled={blocked}
                      onClick={() => choosePrompt('Giúp mình sửa ngữ pháp và giải thích câu sau: ')}
                    >
                      Sửa câu tiếng Anh
                    </Button>
                  </div>
                </div>
              )}
              {messages.map(message => (
                <AiMessage key={message.id} message={message} />
              ))}
              {sending && (
                <div className="ai-assistant-pending" role="status">
                  <CircularProgress size={16} />
                  Đang trả lời...
                </div>
              )}
            </div>
            <form
              className="ai-assistant-composer"
              onSubmit={event => {
                event.preventDefault();
                if (!blocked) send();
              }}
            >
              {latestError && (
                <Alert
                  severity="error"
                  action={
                    <Button disabled={sending || !capabilities?.available} onClick={() => send(failed)}>
                      Thử lại
                    </Button>
                  }
                >
                  {getAiErrorMessage(latestError)}
                </Alert>
              )}
              <TextField
                className="ai-assistant-input"
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
                label="Câu hỏi của bạn"
                placeholder="Nhập câu hỏi về bài học..."
                value={draft}
                inputRef={input}
                disabled={sending}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (
                    event.key !== 'Enter' ||
                    event.shiftKey ||
                    event.nativeEvent.isComposing ||
                    event.nativeEvent.keyCode === 229
                  )
                    return;
                  event.preventDefault();
                  if (!blocked && !event.repeat) send();
                }}
                slotProps={{ htmlInput: { maxLength } }}
              />
              <div className="ai-assistant-composer-actions">
                <span className="ai-assistant-muted">
                  {draft.length}/{maxLength}
                </span>
                <div className="ai-assistant-tools">
                  <Tooltip title="Xóa bản nháp">
                    <span>
                      <IconButton
                        aria-label="Xóa bản nháp"
                        disabled={!draft || sending}
                        onClick={() => {
                          setDraft('');
                          setFailed(null);
                        }}
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Gửi câu hỏi">
                    <span>
                      <IconButton
                        className="ai-assistant-send"
                        type="submit"
                        aria-label="Gửi câu hỏi"
                        color="primary"
                        disabled={blocked || !draft.trim()}
                      >
                        <SendOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AiAssistantPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  return <ChatWorkspace key={`${user?.id ?? 'anonymous'}:${params.toString()}`} />;
}
