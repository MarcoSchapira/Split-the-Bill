import type { PropsWithChildren } from 'react'

type ModalProps = PropsWithChildren<{
  title: string;
  onClose: () => void;
  size?: 'default' | 'wide';
}>

export function Modal({ children, onClose, size = 'default', title }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={title}
        aria-modal="true"
        className={size === 'wide' ? 'modal-card modal-card--wide' : 'modal-card'}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            x
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
