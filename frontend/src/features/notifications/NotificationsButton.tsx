import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import type { NotificationPayload, NotificationResponse } from '@lms/shared';
import { listNotifications, markNotificationRead } from '../../api/notifications';
import { Button } from '../../components/ui/button';
import { Sheet, SheetTrigger } from '../../components/ui/sheet';
import { getErrorMessage } from '../../lib/errors';
import { createNamespaceSocket } from '../../lib/realtime';
import { useAuthStore } from '../auth/auth.store';
import { NotificationsDrawer } from './NotificationsDrawer';

export function NotificationsButton() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const notificationsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryKey: ['notifications'],
    queryFn: listNotifications,
  });
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (updated) => {
      setNotifications((current) =>
        current.map((notification) => (notification.id === updated.id ? updated : notification)),
      );
    },
  });

  useEffect(() => {
    if (notificationsQuery.data) {
      setNotifications(notificationsQuery.data);
    }
  }, [notificationsQuery.data]);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    const nextSocket = createNamespaceSocket('/notifications', accessToken);
    const handleNewNotification = (payload: NotificationPayload) => {
      setNotifications((current) => [
        {
          ...payload,
          readAt: null,
        },
        ...current.filter((notification) => notification.id !== payload.id),
      ]);
    };

    nextSocket.on('notification:new', handleNewNotification);

    return () => {
      nextSocket.off('notification:new', handleNewNotification);
      nextSocket.disconnect();
    };
  }, [accessToken]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  function handleMarkRead(id: string) {
    markReadMutation.mutate(id);
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <div className="notifications-shell">
        <SheetTrigger asChild>
          <Button
            aria-label="Notifications"
            className="notification-button"
            size="icon"
            variant="ghost"
          >
            <Bell size={18} aria-hidden="true" />
          </Button>
        </SheetTrigger>
        {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
        {notificationsQuery.isError && (
          <span className="notification-error" role="alert">
            {getErrorMessage(notificationsQuery.error)}
          </span>
        )}
      </div>
      {isOpen ? (
        <NotificationsDrawer
          isLoading={notificationsQuery.isLoading}
          notifications={notifications}
          onMarkRead={handleMarkRead}
        />
      ) : null}
    </Sheet>
  );
}
