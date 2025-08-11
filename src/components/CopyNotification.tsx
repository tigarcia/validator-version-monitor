import { useEffect } from 'react';

interface CopyNotificationProps {
  message: string;
  isVisible: boolean;
  onHide: () => void;
  isError?: boolean;
}

export default function CopyNotification({ message, isVisible, onHide, isError = false }: CopyNotificationProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onHide();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
      isError ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
    }`}>
      {message}
    </div>
  );
}
