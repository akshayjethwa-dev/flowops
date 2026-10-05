// src/components/NotificationBell.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  AlertTriangle, 
  Package, 
  Truck, 
  FileText, 
  CheckCircle,
  Check
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { AppNotification, NotificationType } from '../types';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimeAgo = (dateInput: any) => {
    if (!dateInput) return '';
    try {
      const now = new Date();
      const date = new Date(dateInput);
      const diffMs = now.getTime() - date.getTime();
      
      if (isNaN(diffMs)) return '';
      
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const getNotificationConfig = (type: NotificationType) => {
    switch (type) {
      case 'payment_overdue':
        return {
          icon: AlertTriangle,
          iconClass: 'text-rose-600 bg-rose-50 border border-rose-100',
        };
      case 'low_stock':
        return {
          icon: Package,
          iconClass: 'text-amber-600 bg-amber-50 border border-amber-100',
        };
      case 'order_delayed':
        return {
          icon: AlertTriangle,
          iconClass: 'text-orange-600 bg-orange-50 border border-orange-100',
        };
      case 'new_rfq':
        return {
          icon: FileText,
          iconClass: 'text-blue-600 bg-blue-50 border border-blue-100',
        };
      case 'dispatch_sent':
        return {
          icon: Truck,
          iconClass: 'text-emerald-600 bg-emerald-50 border border-emerald-100',
        };
      case 'stage_changed':
        return {
          icon: CheckCircle,
          iconClass: 'text-indigo-600 bg-indigo-50 border border-indigo-100',
        };
      case 'reminder_sent':
      default:
        return {
          icon: Bell,
          iconClass: 'text-cyan-600 bg-cyan-50 border border-cyan-100',
        };
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    setOpen(false);
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    navigate(notif.link);
  };

  // Limit dropdown to latest 20 notifications
  const displayedNotifications = notifications.slice(0, 20);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Icon */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors relative cursor-pointer focus:outline-hidden"
        id="notification-bell-trigger-btn"
        aria-label="View In-App Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span 
            className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-sm"
            id="notification-unread-badge"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Expanded Droplist Panel */}
      {open && (
        <div 
          className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 animate-fade-in flex flex-col"
          id="notification-dropdown-panel"
        >
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-lg shrink-0">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Alert Notification Hub</h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'No unread updates'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] text-sky-600 hover:text-sky-700 font-semibold flex items-center space-x-1 hover:underline cursor-pointer bg-transparent border-0"
                id="marker-all-as-read-btn"
              >
                <Check className="h-3 w-3 shrink-0" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List Wrapper (max 20 items scrollable) */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center" id="notifications-empty-state">
                <span className="text-2xl mb-2 block">🎉</span>
                <p className="text-xs font-medium text-slate-500">You're all caught up!</p>
                <p className="text-[10px] text-slate-400 mt-0.5">We will let you know when action is required.</p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const { icon: IconComponent, iconClass } = getNotificationConfig(notif.type);
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 flex items-start gap-3 transition-colors duration-150 cursor-pointer hover:bg-slate-50 ${
                      !notif.read ? 'bg-sky-50/30 font-medium' : ''
                    }`}
                    id={`notification-row-${notif.id}`}
                  >
                    {/* Visual Config Icon badge */}
                    <div className={`p-1.5 rounded-md shrink-0 ${iconClass}`}>
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>

                    {/* Text block summary */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-slate-800 truncate">
                          {notif.title}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono shrink-0 whitespace-nowrap">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed break-words">
                        {notif.message}
                      </p>
                    </div>

                    {/* Blue read dot */}
                    {!notif.read && (
                      <span className="w-1.5 h-1.5 bg-sky-600 rounded-full shrink-0 self-center" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
