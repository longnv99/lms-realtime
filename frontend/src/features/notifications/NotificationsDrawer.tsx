import type { NotificationResponse } from '@lms/shared';
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';

type NotificationsDrawerProps = {
  isLoading: boolean;
  notifications: NotificationResponse[];
  onMarkRead: (id: string) => void;
};

export function NotificationsDrawer({
  isLoading,
  notifications,
  onMarkRead,
}: NotificationsDrawerProps) {
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <SheetContent
      aria-labelledby="notifications-drawer-title"
      className="notifications-drawer"
      side="right"
    >
      <SheetHeader className="drawer-header">
        <div>
          <SheetTitle id="notifications-drawer-title">Notifications</SheetTitle>
          <SheetDescription>{notifications.length} total</SheetDescription>
        </div>
      </SheetHeader>
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
    </SheetContent>
  );
}
