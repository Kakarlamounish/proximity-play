import * as React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

export const ResponsiveDialogContext = React.createContext<{ isDesktop: boolean }>({ isDesktop: true })

export function ResponsiveDialog({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (isDesktop) {
    return (
      <ResponsiveDialogContext.Provider value={{ isDesktop }}>
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      </ResponsiveDialogContext.Provider>
    )
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isDesktop }}>
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    </ResponsiveDialogContext.Provider>
  )
}

export function ResponsiveDialogTrigger({ children, asChild, ...props }: React.ComponentProps<typeof DialogTrigger>) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)
  if (isDesktop) return <DialogTrigger asChild={asChild} {...props}>{children}</DialogTrigger>
  return <DrawerTrigger asChild={asChild} {...props}>{children}</DrawerTrigger>
}

export function ResponsiveDialogContent({ children, className, ...props }: any) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)
  if (isDesktop) return <DialogContent className={className} {...props}>{children}</DialogContent>
  return <DrawerContent className={className} {...props}>{children}</DrawerContent>
}

export function ResponsiveDialogHeader({ children, className, ...props }: React.ComponentProps<typeof DialogHeader>) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)
  if (isDesktop) return <DialogHeader className={className} {...props}>{children}</DialogHeader>
  return <DrawerHeader className={className} {...props}>{children}</DrawerHeader>
}

export function ResponsiveDialogTitle({ children, className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)
  if (isDesktop) return <DialogTitle className={className} {...props}>{children}</DialogTitle>
  return <DrawerTitle className={className} {...props}>{children}</DrawerTitle>
}

export function ResponsiveDialogDescription({ children, className, ...props }: React.ComponentProps<typeof DialogDescription>) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)
  if (isDesktop) return <DialogDescription className={className} {...props}>{children}</DialogDescription>
  return <DrawerDescription className={className} {...props}>{children}</DrawerDescription>
}
