import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import type { NotificationPayload, NotificationResponse } from '@lms/shared';
import { listNotifications, markNotificationRead } from '../../api/notifications';
import { Button } from '../../components/Button';
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

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  function handleMarkRead(id: string) {
    markReadMutation.mutate(id);
  }

  return (
    <div className="notifications-shell">
      <Button
        aria-label="Notifications"
        className="notification-button"
        icon={<Bell size={18} aria-hidden="true" />}
        iconOnly
        onClick={() => setIsOpen((current) => !current)}
        variant="ghost"
      />
      {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
      {notificationsQuery.isError && (
        <span className="notification-error" role="alert">
          {getErrorMessage(notificationsQuery.error)}
        </span>
      )}
      {isOpen && (
        <NotificationsDrawer
          isLoading={notificationsQuery.isLoading}
          notifications={notifications}
          onClose={() => setIsOpen(false)}
          onMarkRead={handleMarkRead}
        />
      )}
    </div>
  );
}
