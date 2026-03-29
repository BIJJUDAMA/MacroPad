import React, { useState } from 'react';

interface TooltipProps {
    children: React.ReactNode;
    name: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
}

export function Tooltip({ 
    children, 
    name, 
    description, 
    position = 'bottom',
    align = 'center' 
}: TooltipProps) {
    const [visible, setVisible] = useState(false);

    const getPosClasses = () => {
        const base = {
            top: 'bottom-full mb-3',
            bottom: 'top-full mt-3',
            left: 'right-full top-1/2 -translate-y-1/2 mr-3',
            right: 'left-full top-1/2 -translate-y-1/2 ml-3',
        };

        if (position === 'left' || position === 'right') return base[position];

        // For top/bottom, handle alignment
        const alignment = {
            start: 'left-0',
            center: 'left-1/2 -translate-x-1/2',
            end: 'right-0',
        };

        return `${base[position]} ${alignment[align]}`;
    };

    const getArrowClasses = () => {
        const base = {
            top: '-bottom-1 border-r border-b rotate-45',
            bottom: '-top-1 border-l border-t rotate-45',
            left: '-right-1 top-1/2 -translate-y-1/2 border-r border-t rotate-45',
            right: '-left-1 top-1/2 -translate-y-1/2 border-l border-b rotate-45',
        };

        if (position === 'left' || position === 'right') return base[position];

        const alignment = {
            start: 'left-4',
            center: 'left-1/2 -translate-x-1/2',
            end: 'right-4',
        };

        return `${base[position]} ${alignment[align]}`;
    };

    return (
        <div 
            className="relative font-sans"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && (
                <div className={`absolute ${getPosClasses()} z-[1000] w-52 p-4 bg-surface border border-surface-lighter rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in duration-200 pointer-events-none`}>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                             <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">{name}</p>
                        </div>
                        <p className="text-[11px] font-medium text-text-main leading-relaxed">{description}</p>
                    </div>
                    {/* Arrow */}
                    <div className={`absolute w-2.5 h-2.5 bg-surface border-surface-lighter ${getArrowClasses()}`} />
                </div>
            )}
        </div>
    );
}
