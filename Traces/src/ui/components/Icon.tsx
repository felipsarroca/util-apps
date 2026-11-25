// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SVGProps } from 'react';

export type IconName =
  | 'traces'
  | 'refresh'
  | 'clock'
  | 'layers'
  | 'file-text'
  | 'scissors'
  | 'users'
  | 'settings'
  | 'help'
  | 'download'
  | 'printer'
  | 'check-circle'
  | 'alert-triangle'
  | 'chevron-down'
  | 'chevron-right'
  | 'play'
  | 'pause'
  | 'copy'
  | 'eye'
  | 'upload'
  | 'beaker'
  | 'x';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, className = '', ...rest }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: `ic ${className}`.trim(),
    ...rest,
  };

  switch (name) {
    case 'traces':
      return (
        <svg {...common}>
          <path d="M4 18 L9 13.5 L13 15 L17.5 7.5 L20.5 6" />
          <circle cx="17.5" cy="7.5" r="2.3" fill="currentColor" />
          <path d="M4 6h8" opacity="0.55" />
          <path d="M4 10h5" opacity="0.55" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...common}>
          <polygon points="12 3 2 8 12 13 22 8 12 3" />
          <polyline points="2 13 12 18 22 13" />
          <polyline points="2 17.5 12 22.5 22 17.5" />
        </svg>
      );
    case 'file-text':
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13.5" y2="17" />
        </svg>
      );
    case 'scissors':
      return (
        <svg {...common}>
          <rect x="8" y="4" width="12" height="16" rx="2" />
          <path d="M16 4V2.5a1.5 1.5 0 0 0-1.5-1.5h-9A1.5 1.5 0 0 0 4 2.5v13A1.5 1.5 0 0 0 5.5 17H8" />
          <line x1="11.5" y1="9.5" x2="16.5" y2="9.5" />
          <line x1="11.5" y1="13.5" x2="16.5" y2="13.5" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="9" cy="6" r="2" fill="#fff" />
          <circle cx="15" cy="12" r="2" fill="#fff" />
          <circle cx="10" cy="18" r="2" fill="#fff" />
        </svg>
      );
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M9.4 9a2.7 2.7 0 0 1 5.1 1c0 1.8-2.5 2.3-2.5 4" />
          <circle cx="12" cy="17.3" r="0.8" fill="currentColor" />
        </svg>
      );
    case 'download':
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case 'printer':
      return (
        <svg {...common}>
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...common}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'alert-triangle':
      return (
        <svg {...common}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...common}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...common}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    case 'play':
      return (
        <svg {...common}>
          <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common}>
          <rect x="6" y="4" width="4" height="16" fill="currentColor" />
          <rect x="14" y="4" width="4" height="16" fill="currentColor" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common}>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case 'beaker':
      return (
        <svg {...common}>
          <path d="M9 3h6" />
          <path d="M10 3v5.4L4.8 18.2A2 2 0 0 0 6.6 21h10.8a2 2 0 0 0 1.8-2.8L14 8.4V3" />
          <path d="M7.5 14h9" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
  }
}
