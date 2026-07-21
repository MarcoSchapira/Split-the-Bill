import * as Toast from '@radix-ui/react-toast'
import { useCallback, useMemo, useState, type PropsWithChildren } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { ToastContext, type ToastVariant } from './toastContext'
import styles from './ToastProvider.module.css'

type ToastMessage = {
  id: number;
  message: string;
  variant: ToastVariant;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toast ? (
          <Toast.Root
            className={`${styles.toast} ${styles[toast.variant]}`}
            duration={4200}
            key={toast.id}
            onOpenChange={(open) => {
              if (!open) setToast(null)
            }}
            open
          >
            {toast.variant === 'error' ? <CircleAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
            <Toast.Description className={styles.message}>{toast.message}</Toast.Description>
            <Toast.Close aria-label="Dismiss notification" className="bc-icon-button">
              <X aria-hidden="true" size={18} />
            </Toast.Close>
          </Toast.Root>
        ) : null}
        <Toast.Viewport className={styles.viewport} />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}
