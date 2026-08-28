import { useMemo, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessagePayload } from '@lms/shared';
import { Button } from '../../components/Button';

type ChatPanelProps = {
  messages: ChatMessagePayload[];
  onSend: (content: string) => void;
};

const maxMessageLength = 1000;

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [content, setContent] = useState('');
  const trimmed = content.trim();
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [messages],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) {
      return;
    }

    onSend(trimmed);
    setContent('');
  }

  return (
    <section className="panel chat-panel" aria-labelledby="chat-panel-title">
      <div className="panel-header">
        <div>
          <h3 className="panel-title" id="chat-panel-title">
            Chat
          </h3>
          <p className="panel-subtitle">{messages.length} messages</p>
        </div>
      </div>
      <div className="chat-body">
        {sortedMessages.length === 0 ? (
          <div className="chat-empty">No messages</div>
        ) : (
          <div className="chat-list" role="log" aria-live="polite">
            {sortedMessages.map((message) => (
              <article className="chat-message" key={message.id}>
                <div className="chat-message-meta">
                  <strong>{message.name}</strong>
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                </div>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
        )}
      </div>
      <form className="chat-composer" onSubmit={handleSubmit}>
        <label className="chat-input-label" htmlFor="chat-message">
          Chat message
        </label>
        <textarea
          aria-label="Chat message"
          className="chat-input"
          id="chat-message"
          maxLength={maxMessageLength}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          value={content}
        />
        <div className="chat-composer-actions">
          <span>{maxMessageLength - content.length}</span>
          <Button
            aria-label="Send message"
            disabled={!trimmed}
            icon={<Send size={16} aria-hidden="true" />}
            type="submit"
          >
            Send
          </Button>
        </div>
      </form>
    </section>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
