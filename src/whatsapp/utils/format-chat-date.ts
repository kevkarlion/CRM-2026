/**
 * Date formatting utilities for chat display.
 * Formats dates as "Hoy", "Ayer", or "DD/MM/YYYY" with time.
 */

import type { ChatMessage } from '../types/chat';

/**
 * Formats a date for chat display.
 * - Today: "Hoy HH:mm"
 * - Yesterday: "Ayer HH:mm"
 * - Other: "DD/MM/YYYY"
 */
export function formatChatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
  if (messageDate.getTime() === today.getTime()) {
    return `Hoy ${formatTime(d)}`;
  }
  
  if (messageDate.getTime() === yesterday.getTime()) {
    return `Ayer ${formatTime(d)}`;
  }
  
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formats time as HH:mm
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Groups messages by date for chat display.
 * Returns a Map with date keys and message arrays.
 */
export function groupMessagesByDate(messages: ChatMessage[]): Map<string, ChatMessage[]> {
  const groups = new Map<string, ChatMessage[]>();
  
  // Sort messages by date ascending (oldest first)
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  
  for (const message of sortedMessages) {
    const dateKey = formatChatDate(message.createdAt);
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    
    groups.get(dateKey)!.push(message);
  }
  
  return groups;
}

/**
 * Gets the date key for a single message.
 * Useful for determining when to insert a date separator.
 */
export function getMessageDateKey(message: ChatMessage): string {
  return formatChatDate(message.createdAt);
}