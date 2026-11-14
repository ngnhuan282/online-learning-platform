import { useEffect, useRef, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function preserveDollarAmounts() {
  return (tree, file) => {
    function walk(parent) {
      parent.children?.forEach((node, index) => {
        const next = parent.children[index + 1];
        // Paired prices such as "$5 or $10" must remain literal text.
        if (node.type === 'inlineMath' && /^\s*\d/.test(node.value) && /^\d/.test(next?.value ?? '')) {
          parent.children[index] = {
            type: 'text',
            value: String(file.value).slice(node.position.start.offset, node.position.end.offset),
          };
        } else {
          walk(node);
        }
      });
    }
    walk(tree);
  };
}

function MarkdownLink({ href, children }) {
  if (href?.startsWith('#')) return <a href={href}>{children}</a>;
  let safeHref;
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      safeHref = url.href;
    }
  } catch {
    // Relative and unsafe links remain readable without becoming navigation targets.
  }
  return safeHref ? (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}

const markdownComponents = {
  a: MarkdownLink,
  img: ({ alt }) => <span>{alt || '[Hình ảnh]'}</span>,
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  table: ({ children }) => (
    <div className="ai-assistant-table" role="region" aria-label="Bảng trong câu trả lời" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
};
const markdownPlugins = [remarkGfm, remarkMath, preserveDollarAmounts];
const rehypePlugins = [[rehypeKatex, { trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20 }]];

export default function AiMessage({ message }) {
  const isUser = message.sender === 'USER';
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const timer = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      if (!alive.current) return;
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      if (alive.current) setCopyError(true);
    }
  }

  return (
    <article className={`ai-assistant-message ${isUser ? 'from-user' : 'from-ai'}`}>
      <div className="ai-assistant-message-avatar" aria-hidden="true">
        {isUser ? <PersonOutlined fontSize="small" /> : <AutoAwesomeOutlined fontSize="small" />}
      </div>
      <div className="ai-assistant-message-main">
        <div className="ai-assistant-message-label">
          <span>{isUser ? 'Bạn' : 'Trợ lý AI'}</span>
          <time dateTime={message.createdAt}>
            {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
        {isUser ? (
          <p className="ai-assistant-user-text">{message.content}</p>
        ) : (
          <div className="ai-assistant-markdown">
            <Markdown
              remarkPlugins={markdownPlugins}
              rehypePlugins={rehypePlugins}
              components={markdownComponents}
            >
              {message.content}
            </Markdown>
          </div>
        )}
        {!isUser && message.truncated && (
          <Alert severity="warning" className="ai-assistant-truncated">
            Câu trả lời đã chạm giới hạn độ dài và chưa đầy đủ. Bạn có thể nhắn “Tiếp tục phần còn lại” hoặc
            chia câu hỏi thành từng ý nhỏ.
          </Alert>
        )}
        {!isUser && (
          <div className="ai-assistant-message-actions">
            <Tooltip title={copied ? 'Đã sao chép' : 'Sao chép câu trả lời'}>
              <IconButton aria-label="Sao chép câu trả lời" size="small" onClick={copy}>
                {copied ? <CheckOutlined fontSize="small" /> : <ContentCopyOutlined fontSize="small" />}
              </IconButton>
            </Tooltip>
            {copied && <span role="status">Đã sao chép</span>}
          </div>
        )}
      </div>
      <Snackbar
        open={copyError}
        autoHideDuration={4000}
        onClose={() => setCopyError(false)}
        message="Không thể sao chép. Bạn có thể chọn và sao chép nội dung trực tiếp."
      />
    </article>
  );
}
