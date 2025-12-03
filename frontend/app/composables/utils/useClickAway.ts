import { onMounted, onUnmounted, unref, type Ref, watch } from 'vue'

export interface UseClickAwayOptions {
  active?: boolean | Ref<boolean>
  /**
   * Event to listen on document. Defaults to 'mousedown'.
   */
  event?: keyof DocumentEventMap
  /**
   * Elements that should not trigger away when clicked
   */
  ignore?: Array<HTMLElement | null | Ref<HTMLElement | null>>
}

export function useClickAway(
  target: Ref<HTMLElement | null> | HTMLElement | null,
  handler: (event: Event) => void,
  options: UseClickAwayOptions = {}
) {
  const eventName = options.event || 'mousedown'

  const isActive = () => {
    const val = options.active
    return typeof val === 'boolean' ? val : !!unref(val)
  }

  const getEls = () => {
    const t = unref(target)
    const ignores = (options.ignore || []).map(i => unref(i))
    return { t, ignores }
  }

  const onDocEvent = (e: Event) => {
    if (!isActive()) return
    const { t, ignores } = getEls()
    const el = e.target as Node | null
    if (!el) return

    if (t && t.contains(el)) return
    if (ignores.some(ig => ig && ig.contains && ig.contains(el))) return

    handler(e)
  }

  onMounted(() => {
    document.addEventListener(eventName, onDocEvent)
  })

  onUnmounted(() => {
    document.removeEventListener(eventName, onDocEvent)
  })

  // Re-bind if eventName option changes dynamically (unlikely), or active ref toggles
  if (options.active && typeof options.active !== 'boolean') {
    watch(options.active, () => { /* noop - reactive dependency for onDocEvent */ })
  }

  return {
    stop: () => document.removeEventListener(eventName, onDocEvent)
  }
}
