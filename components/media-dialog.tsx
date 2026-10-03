'use client';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { Dialog, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
export function MediaDialog({ children, title, description, open, setOpen, trigger }: { children: React.ReactNode; title: string; description: string; open: boolean; setOpen: (open:boolean) => void; trigger: React.ReactElement }) {
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={trigger} /><DialogPrimitive.Portal><DialogPrimitive.Backdrop className="mm-backdrop" /><div className="mm-viewport"><DialogPrimitive.Popup className="mm-dialog"><header><div><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></div><DialogPrimitive.Close className="mm-close" aria-label={`关闭${title}`}><X /></DialogPrimitive.Close></header>{open && children}</DialogPrimitive.Popup></div></DialogPrimitive.Portal></Dialog>;
}
