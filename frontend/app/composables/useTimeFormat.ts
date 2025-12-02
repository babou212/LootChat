/**
 * Composable for formatting relative time from timestamps.
 * Handles timezone-aware date formatting for consistent display across all users.
 */
export function useTimeFormat() {
  /**
   * Format a timestamp relative to now.
   * Handles both Date objects and ISO strings, ensuring proper UTC comparison.
   *
   * @param date - Date object or ISO string timestamp
   * @returns Human-readable relative time string
   */
  const formatRelativeTime = (date: Date | string): string => {
    // Ensure we have a proper Date object
    const messageDate = date instanceof Date ? date : new Date(date)

    // If the date is invalid, return a fallback
    if (isNaN(messageDate.getTime())) {
      return 'Unknown time'
    }

    const now = new Date()
    const diff = now.getTime() - messageDate.getTime()

    // Handle future dates (clock skew)
    if (diff < 0) {
      return 'Just now'
    }

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`

    // For older messages, show the date in user's local timezone
    return messageDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  /**
   * Format a date as a full timestamp (e.g., "Dec 2, 2025 at 3:45 PM")
   *
   * @param date - Date object or ISO string timestamp
   * @returns Full formatted date and time string
   */
  const formatFullTime = (date: Date | string): string => {
    const messageDate = date instanceof Date ? date : new Date(date)

    if (isNaN(messageDate.getTime())) {
      return 'Unknown time'
    }

    return messageDate.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  /**
   * Format time only (e.g., "3:45 PM")
   *
   * @param date - Date object or ISO string timestamp
   * @returns Time string in user's locale
   */
  const formatTimeOnly = (date: Date | string): string => {
    const messageDate = date instanceof Date ? date : new Date(date)

    if (isNaN(messageDate.getTime())) {
      return ''
    }

    return messageDate.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return {
    formatRelativeTime,
    formatFullTime,
    formatTimeOnly
  }
}
