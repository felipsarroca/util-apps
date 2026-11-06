import type { ReactNode } from 'react'

export function Icon({
  children,
  size = 20,
}: {
  children: ReactNode
  size?: number
}) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  )
}

export const UploadIcon = () => (
  <Icon size={28}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
  </Icon>
)

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3 5 6v5c0 4.8 2.9 8.1 7 10 4.1-1.9 7-5.2 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
)

export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M5 19h14" />
  </Icon>
)

export const ChartIcon = () => (
  <Icon>
    <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
  </Icon>
)

export const FileIcon = () => (
  <Icon>
    <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v5h5M8 13h8M8 17h6" />
  </Icon>
)

export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <path d="M12 7.5h.01" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Icon>
)

export const CropIcon = () => (
  <Icon>
    <path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h14a2 2 0 0 1 2 2v12" />
  </Icon>
)

export const RenameIcon = () => (
  <Icon>
    <path d="M4 7h10M4 12h8M4 17h6" />
    <path d="m16 15 4-4 2 2-4 4-3 1 1-3Z" />
  </Icon>
)

export const UserShieldIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19c.7-3.3 2.5-5 5.5-5 1.2 0 2.2.3 3 .8" />
    <path d="m17 13 4 1.7v2.8c0 2-1.4 3.5-4 4.5-2.6-1-4-2.5-4-4v-2.8L17 13Z" />
  </Icon>
)
