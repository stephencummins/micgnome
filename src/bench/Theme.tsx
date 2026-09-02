import { useState } from 'react'

/**
 * Light or dark, remembered per browser. With nothing stored the page follows
 * the system, which is what most people want and what the CSS already does;
 * the toggle exists for the other people, and for checking the dark palette
 * without changing the whole machine.
 */
type Theme = 'light' | 'dark'
const KEY = 'micgnome:theme'

export function storedTheme(): Theme | undefined {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'dark' || t === 'light' ? t : undefined
  } catch {
    return undefined
  }
}

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Stamp the choice on the root before anything renders, so there is no flash. */
export function applyStoredTheme() {
  const t = storedTheme()
  if (t) document.documentElement.dataset.theme = t
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme())
  const next: Theme = theme === 'dark' ? 'light' : 'dark'

  function flip() {
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // private window, or storage blocked — the page still switches
    }
    setTheme(next)
  }

  return (
    <button type="button" onClick={flip} className="underline hover:text-orange" aria-label={`switch to ${next} mode`}
      title={`switch to ${next} mode`}>
      {next}
    </button>
  )
}
