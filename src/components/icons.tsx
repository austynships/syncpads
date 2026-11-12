/** Small line icons (24px grid, 1.75px stroke). They inherit text color. */
type IconProps = { size?: number; className?: string };

function Icon({ size = 16, className = "", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const IconPlus = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const IconX = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const IconCheck = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7" /></Icon>;
export const IconArrowRight = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const IconArrowLeft = (p: IconProps) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;

export const IconPencil = (p: IconProps) => (
  <Icon {...p}><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5 4 20z" /><path d="M13.5 7l3 3" /></Icon>
);
export const IconGrip = (p: IconProps) => (
  <Icon {...p}>
    {[6, 12, 18].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="currentColor" stroke="none" />))}
  </Icon>
);
export const IconList = (p: IconProps) => (
  <Icon {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth={2.5} /></Icon>
);
export const IconGrid = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Icon>
);
export const IconSliders = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></Icon>
);
export const IconTrash = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></Icon>
);
export const IconNote = (p: IconProps) => (
  <Icon {...p}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 8.5h6M9 12h6M9 15.5h3.5" /></Icon>
);
export const IconLink = (p: IconProps) => (
  <Icon {...p}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></Icon>
);
export const IconMail = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" /></Icon>
);
export const IconAlert = (p: IconProps) => (
  <Icon {...p}><path d="M12 3.5l9 16H3l9-16z" /><path d="M12 10v4M12 17h.01" /></Icon>
);
export const IconLayers = (p: IconProps) => (
  <Icon {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Icon>
);
export const IconSync = (p: IconProps) => (
  <Icon {...p}><path d="M4 12a8 8 0 0114-5.3L20 9M20 12a8 8 0 01-14 5.3L4 15" /><path d="M20 4v5h-5M4 20v-5h5" /></Icon>
);
export const IconImport = (p: IconProps) => (
  <Icon {...p}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></Icon>
);
export const IconPalette = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3a9 9 0 100 18c1.1 0 1.5-.8 1.5-1.6 0-1.4-1.2-1.9-1.2-3.1 0-1 .8-1.8 1.8-1.8H17a4 4 0 004-4c0-4.1-4-7.5-9-7.5z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconShield = (p: IconProps) => (
  <Icon {...p}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6L12 3z" /><path d="M9 12l2 2 4-4" /></Icon>
);
export const IconUpload = (p: IconProps) => (
  <Icon {...p}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></Icon>
);
export const IconLogOut = (p: IconProps) => (
  <Icon {...p}><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10" /></Icon>
);
export const IconUser = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></Icon>
);
export const IconSun = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Icon>
);
export const IconMoon = (p: IconProps) => <Icon {...p}><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></Icon>;
export const IconMonitor = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon>
);
export const IconInbox = (p: IconProps) => (
  <Icon {...p}><path d="M4 13l2.5-7.5A2 2 0 018.4 4h7.2a2 2 0 011.9 1.5L20 13" /><path d="M4 13v5a2 2 0 002 2h12a2 2 0 002-2v-5h-4.5l-1.5 2.5h-4L8.5 13H4z" /></Icon>
);
export const IconBot = (p: IconProps) => (
  <Icon {...p}><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M9 13.5h.01M15 13.5h.01M9.5 17h5" /><circle cx="12" cy="3.5" r="1" fill="currentColor" stroke="none" /></Icon>
);
export const IconCopy = (p: IconProps) => (
  <Icon {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></Icon>
);
export const IconUndo = (p: IconProps) => <Icon {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></Icon>;
export const IconEyeOff = (p: IconProps) => (
  <Icon {...p}><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 8.5 4.5 9.5 6-.4.6-1.3 1.9-2.6 3.1M6.5 7.6C4.6 8.9 3.2 10.7 2.5 12c1 1.5 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></Icon>
);
