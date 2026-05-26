import type { PropsWithChildren } from 'react'

type ModalProps = PropsWithChildren<{
  title: string;
  onClose: () => void;
}>

export function Modal({ children, onClose, title }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={title}
        aria-modal="true"
        className="modal-card"
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
