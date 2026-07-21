import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { PropsWithChildren } from 'react'

type ModalProps = PropsWithChildren<{
  title: string;
  onClose: () => void;
  size?: 'default' | 'wide';
}>

export function Modal({ children, onClose, size = 'default', title }: ModalProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className={size === 'wide' ? 'modal-card modal-card--wide' : 'modal-card'}>
          <div className="modal-header">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label="Close" className="icon-button" type="button">
              <X aria-hidden="true" size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
