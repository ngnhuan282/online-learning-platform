import { useContext } from 'react';
import { NotificationsContext } from '../context/NotificationsContext';

export default function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('NotificationsProvider is required.');
  return context;
}
