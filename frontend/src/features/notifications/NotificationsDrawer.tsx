import { X } from 'lucide-react';
import type { NotificationResponse } from '@lms/shared';
import { Button } from '../../components/Button';

type NotificationsDrawerProps = {
  isLoading: boolean;
  notifications: NotificationResponse[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
};

export function NotificationsDrawer({
  isLoading,
  notifications,
  onClose,
  onMarkRead,
}: NotificationsDrawerProps) {
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <aside
      aria-labelledby="notifications-drawer-title"
      className="notifications-drawer"
      role="dialog"
    >
      <div className="drawer-header">
        <div>
          <h2 id="notifications-drawer-title">Notifications</h2>
          <p>{notifications.length} total</p>
        </div>
        <Button
          aria-label="Close notifications"
          icon={<X size={18} aria-hidden="true" />}
          iconOnly
          onClick={onClose}
          variant="ghost"
        />
      </div>
      <div className="drawer-body">
        {isLoading && (
          <div className="drawer-loading" role="status" aria-label="Loading notifications" />
        )}
        {!isLoading && sortedNotifications.length === 0 && (
          <div className="drawer-empty">No notifications</div>
        )}
        {!isLoading && sortedNotifications.length > 0 && (
          <div className="notification-list">
            {sortedNotifications.map((notification) => (
              <article
                className={`notification-row ${notification.readAt ? '' : 'is-unread'}`}
                data-testid="notification-row"
                key={notification.id}
              >
                <div className="notification-copy">
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                </div>
                {notification.readAt ? (
                  <span className="notification-read-state" aria-hidden="true" />
                ) : (
                  <button
                    aria-label={`Mark ${notification.title} read`}
                    className="notification-read-state"
                    onClick={() => onMarkRead(notification.id)}
                    type="button"
                  >
                    Unread
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
