import { ReactNode } from "react"

interface Props {
    children: ReactNode;
    accentColor?: string; // e.g. '#ff4e50' for recordings, '#6366f1' for scripts
    playing?: boolean;
    onClick?: () => void;
}

export function BaseCard({ children, accentColor = "var(--color-primary)", playing, onClick }: Props) {
    return (
        <div 
            onClick={onClick}
            className={`
                bg-surface border border-surface-lighter p-0 mb-4 relative transition-all duration-200 ease-in-out
                hover:border-text-main hover:shadow-2xl hover:-translate-y-1 active:translate-y-0
                flex flex-col h-full overflow-hidden group select-none cursor-pointer will-change-transform
                ${playing ? 'border-primary shadow-2xl shadow-primary/20 bg-primary/5' : 'shadow-xl shadow-black/5'}
            `}
        >
            {/* Elegant Accent Strip */}
            <div className="h-1 w-full bg-surface-lighter flex">
                <div 
                    className="h-full transition-all duration-300" 
                    style={{ 
                        width: playing ? '100%' : '20%', 
                        backgroundColor: accentColor,
                        boxShadow: playing ? `0 0 15px ${accentColor}` : 'none'
                    }} 
                />
            </div>

            <div className="p-6 flex-1 flex flex-col">
                {children}
            </div>

            {/* Subtle Status Indicator */}
            {playing && (
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Executing</span>
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                    <span className="absolute -right-0 top-0 w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                </div>
            )}
        </div>
    )
}
