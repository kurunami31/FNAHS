import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/*
 * Styled dropdown that matches the app's rounded-rectangle form fields.
 * Native <option> popups cannot be styled, so this replaces them everywhere.
 * options: [{ value, label }] or grouped [{ label, options: [{ value, label }] }]
 */

function flatten(options) {
  return (options || []).flatMap((g) => (g.options ? g.options.map((o) => ({ ...o, group: g.label })) : [g]))
}

export default function Select({ value, onChange, options = [], placeholder = 'Select…', className = '', disabled, ariaLabel, compact }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const rootRef = useRef(null)

  const flat = flatten(options)
  const grouped = (options || []).some((o) => o.options)
  const current = flat.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHi((h) => Math.min(h + 1, flat.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHi((h) => Math.max(h - 1, 0))
      }
      if (e.key === 'Enter' && flat[hi]) {
        onChange(flat[hi].value)
        setOpen(false)
      }
      if (e.key === 'Tab') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, flat, hi, onChange])

  useEffect(() => {
    if (open) setHi(Math.max(0, flat.findIndex((o) => o.value === value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const OptionBtn = ({ o, onPick }) => (
    <button
      type="button"
      role="option"
      aria-selected={o.value === value}
      className={`sel-opt${o.value === value ? ' sel-opt--on' : ''}${o.value === flat[hi]?.value ? ' sel-opt--hi' : ''}`}
      onMouseEnter={() => setHi(flat.indexOf(o))}
      onClick={() => {
        onPick(o.value)
        setOpen(false)
      }}
    >
      <span>{o.label}</span>
      {o.value === value && <Check size={14} />}
    </button>
  )

  return (
    <div className={`sel${className ? ` ${className}` : ''}${compact ? ' sel--compact' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`sel-trigger${open ? ' sel-trigger--open' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={current ? '' : 'sel-placeholder'}>{current ? current.label : placeholder}</span>
        <ChevronDown size={16} className="sel-caret" />
      </button>
      {open && (
        <div className="sel-pop" role="listbox">
          {grouped ? (
            options.map((g) => (
              <div key={g.label} className="sel-group">
                <div className="sel-group-label">{g.label}</div>
                {g.options.map((o) => (
                  <OptionBtn key={o.value} o={o} onPick={onChange} />
                ))}
              </div>
            ))
          ) : (
            flat.map((o) => <OptionBtn key={o.value} o={o} onPick={onChange} />)
          )}
        </div>
      )}
    </div>
  )
}
