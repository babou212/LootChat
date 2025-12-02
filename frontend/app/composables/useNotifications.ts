/**
 * Composable for managing browser notifications.
 * Handles permission requests and displaying notifications.
 */
export const useNotifications = () => {
  const isSupported = computed(() => 'Notification' in window)
  const permission = ref<NotificationPermission>('default')

  // Initialize permission state
  const initPermission = () => {
    if (isSupported.value) {
      permission.value = Notification.permission
    }
  }

  /**
   * Request notification permission from the user.
   * @returns Promise<boolean> - true if permission granted
   */
  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported.value) {
      console.warn('Browser notifications not supported')
      return false
    }

    if (permission.value === 'granted') {
      return true
    }

    if (permission.value === 'denied') {
      console.warn('Notification permission was denied')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      permission.value = result
      return result === 'granted'
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return false
    }
  }

  /**
   * Show a browser notification.
   * @param title - Notification title
   * @param options - Notification options
   * @returns The Notification instance or null if failed
   */
  const showNotification = (
    title: string,
    options?: NotificationOptions & { onClick?: () => void }
  ): Notification | null => {
    console.log('[Notifications] showNotification called:', { title, options })
    console.log('[Notifications] isSupported:', isSupported.value)
    console.log('[Notifications] permission:', permission.value)
    
    if (!isSupported.value) {
      console.warn('[Notifications] Browser notifications not supported')
      return null
    }

    if (permission.value !== 'granted') {
      console.warn('[Notifications] Notification permission not granted')
      return null
    }

    try {
      console.log('[Notifications] Creating new Notification...')
      const notification = new Notification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options
      })
      console.log('[Notifications] Notification created successfully:', notification)

      if (options?.onClick) {
        notification.onclick = () => {
          options.onClick!()
          notification.close()
          window.focus()
        }
      }

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000)

      return notification
    } catch (error) {
      console.error('[Notifications] Failed to show notification:', error)
      return null
    }
  }

  /**
   * Show a mention notification.
   * @param senderUsername - Username of the person who mentioned
   * @param channelName - Channel where the mention occurred
   * @param messagePreview - Preview of the message content
   * @param onClick - Callback when notification is clicked
   */
  const showMentionNotification = (
    senderUsername: string,
    channelName: string | null,
    messagePreview: string,
    onClick?: () => void
  ) => {
    const title = channelName
      ? `${senderUsername} mentioned you in #${channelName}`
      : `${senderUsername} mentioned you`

    return showNotification(title, {
      body: messagePreview,
      tag: `mention-${Date.now()}`, // Unique tag to allow multiple notifications
      onClick
    })
  }

  // Initialize on mount
  onMounted(() => {
    initPermission()
  })

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    showMentionNotification
  }
}
