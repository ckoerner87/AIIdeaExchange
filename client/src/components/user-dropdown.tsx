import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, MessageCircle, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserDropdownProps {
  user: {
    id: string | number;
    username?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  onLogout: () => void;
}

export function UserDropdown({ user, onLogout }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user.username || user.firstName || user.email?.split('@')[0] || 'User';

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2"
      >
        {displayName}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999]">
          <div className="py-1">
            {/* User Info */}
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{displayName}</p>
              {user.email && (
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              )}
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/dashboard';
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                <User className="w-4 h-4 mr-3" />
                My Dashboard
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/notifications';
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                <Bell className="w-4 h-4 mr-3" />
                Notification Preferences
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  // TODO: Open settings
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                <Settings className="w-4 h-4 mr-3" />
                Account Settings
              </button>

              <div className="border-t border-gray-100 my-1"></div>

              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}