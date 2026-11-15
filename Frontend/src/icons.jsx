// Inline SVG icons (no external icon font is needed).
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const Svg = ({ size = 18, children, ...rest }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base} {...rest}>{children}</svg>
);

export const EditIcon = (p) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
export const PlusIcon = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const ChatIcon = (p) => <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></Svg>;
export const TrashIcon = (p) => <Svg {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Svg>;
export const SendIcon = (p) => <Svg {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></Svg>;
export const MenuIcon = (p) => <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
export const CloseIcon = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const ChevronIcon = (p) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const CopyIcon = (p) => <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
export const CheckIcon = (p) => <Svg {...p}><path d="m5 12 5 5L20 7" /></Svg>;
export const ThumbUpIcon = (p) => <Svg {...p}><path d="M7 10v11H4V10Z" /><path d="M7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7" /></Svg>;
export const ThumbDownIcon = (p) => <Svg {...p}><path d="M17 14V3h3v11Z" /><path d="M17 14l-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.9 3H17" /></Svg>;
export const UserIcon = (p) => <Svg {...p} fill="currentColor" stroke="none"><circle cx="12" cy="8" r="4.2" /><path d="M4 20.5c0-4.2 3.6-6.8 8-6.8s8 2.6 8 6.8Z" /></Svg>;
export const CodeIcon = (p) => <Svg {...p}><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></Svg>;
export const CapIcon = (p) => <Svg {...p}><path d="M2 8.5 12 4l10 4.5L12 13Z" /><path d="M6 10.3V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.7" /></Svg>;
export const BulbIcon = (p) => <Svg {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /></Svg>;
export const DocIcon = (p) => <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></Svg>;
export const ChartIcon = (p) => <Svg {...p} strokeWidth={2.6}><path d="M5 20v-6M12 20V9M19 20V4" /></Svg>;
