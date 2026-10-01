import { useEffect, useId, useRef, type ReactNode } from "react";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    callback = useRef(onClose),
    id = useId();
  callback.current = onClose;
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const close = () => callback.current();
    dialog.addEventListener("close", close);
    return () => {
      dialog.removeEventListener("close", close);
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={"lab-modal" + (wide ? " wide" : "")}
      aria-labelledby={id}
      onClick={(e) => {
        if (e.target === e.currentTarget) callback.current();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id={id}>{title}</h2>
          <button
            className="close-button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
