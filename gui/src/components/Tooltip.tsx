import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    children: React.ReactNode;
    name: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
}

export function Tooltip({ 
    children, 
    name, 
    description, 
    position = 'top',
    className = ""
}: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [actualPosition, setActualPosition] = useState(position);
    const [nudge, setNudge] = useState({ x: 0, y: 0 });

    const updateCoords = () => {
        if (!triggerRef.current) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        
        const tooltipWidth = 224; // w-56
        const tooltipHeight = 100; // estimated max height (dynamic but let's assume)
        const padding = 12;
        
        let targetTop = 0;
        let targetLeft = 0;
        let currentPos = position;
        let shiftX = 0;
        let shiftY = 0;

        // 1. Initial Flip Logic (same as before but more robust)
        if (position === 'right' && rect.right + tooltipWidth + padding > window.innerWidth) {
            currentPos = 'left';
        } else if (position === 'left' && rect.left - tooltipWidth - padding < 0) {
            currentPos = 'right';
        }

        if (position === 'top' && rect.top - tooltipHeight - padding < 0) {
            currentPos = 'bottom';
        } else if (position === 'bottom' && rect.bottom + tooltipHeight + padding > window.innerHeight) {
            currentPos = 'top';
        }

        setActualPosition(currentPos);

        // 2. Base Coordinates
        if (currentPos === 'top') {
            targetTop = rect.top + scrollY - 8;
            targetLeft = rect.left + scrollX + rect.width / 2;
        } else if (currentPos === 'bottom') {
            targetTop = rect.bottom + scrollY + 8;
            targetLeft = rect.left + scrollX + rect.width / 2;
        } else if (currentPos === 'left') {
            targetTop = rect.top + scrollY + rect.height / 2;
            targetLeft = rect.left + scrollX - 8;
        } else if (currentPos === 'right') {
            targetTop = rect.top + scrollY + rect.height / 2;
            targetLeft = rect.left + scrollX + rect.width + 8;
        }

        // 3. Smart Nudge (keeps within viewport)
        if (currentPos === 'top' || currentPos === 'bottom') {
            const leftEdge = rect.left + rect.width / 2 - tooltipWidth / 2;
            const rightEdge = rect.left + rect.width / 2 + tooltipWidth / 2;
            
            if (leftEdge < padding) {
                shiftX = padding - leftEdge;
            } else if (rightEdge > window.innerWidth - padding) {
                shiftX = (window.innerWidth - padding) - rightEdge;
            }
        } else {
            // Horizontal nudging for Side tooltips
            const topEdge = rect.top + rect.height / 2 - tooltipHeight / 2;
            const bottomEdge = rect.top + rect.height / 2 + tooltipHeight / 2;

            if (topEdge < padding) {
                shiftY = padding - topEdge;
            } else if (bottomEdge > window.innerHeight - padding) {
                shiftY = (window.innerHeight - padding) - bottomEdge;
            }
        }

        setCoords({ top: targetTop + shiftY, left: targetLeft + shiftX });
        setNudge({ x: shiftX, y: shiftY });
    };

    const handleMouseEnter = () => {
        updateCoords();
        setVisible(true);
    };

    const handleMouseLeave = () => {
        setVisible(false);
    };

    useEffect(() => {
        if (visible) {
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
            const interval = setInterval(updateCoords, 300);
            return () => {
                window.removeEventListener('scroll', updateCoords, true);
                window.removeEventListener('resize', updateCoords);
                clearInterval(interval);
            };
        }
    }, [visible]);

    const getTranslate = () => {
        if (actualPosition === 'top') return 'translate(-50%, -100%)';
        if (actualPosition === 'bottom') return 'translate(-50%, 0)';
        if (actualPosition === 'left') return 'translate(-100%, -50%)';
        if (actualPosition === 'right') return 'translate(0, -50%)';
        return 'none';
    };

    const getArrowStyles = (): React.CSSProperties => {
        const base: React.CSSProperties = { position: 'absolute', width: 8, height: 8, backgroundColor: 'white' };
        
        switch (actualPosition) {
            case 'top':
                return { ...base, bottom: -4, left: `calc(50% - ${nudge.x}px)`, transform: 'translateX(-50%) rotate(45deg)', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' };
            case 'bottom':
                return { ...base, top: -4, left: `calc(50% - ${nudge.x}px)`, transform: 'translateX(-50%) rotate(45deg)', borderLeft: '1px solid #E5E7EB', borderTop: '1px solid #E5E7EB' };
            case 'left':
                return { ...base, right: -4, top: `calc(50% - ${nudge.y}px)`, transform: 'translateY(-50%) rotate(45deg)', borderRight: '1px solid #E5E7EB', borderTop: '1px solid #E5E7EB' };
            case 'right':
                return { ...base, left: -4, top: `calc(50% - ${nudge.y}px)`, transform: 'translateY(-50%) rotate(45deg)', borderLeft: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' };
            default:
                return base;
        }
    };

    return (
        <div 
            ref={triggerRef}
            className={`inline-block cursor-help will-change-transform ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {visible && createPortal(
                <div 
                    className="absolute z-[9999] w-56 p-4 bg-white border border-surface-lighter rounded-2xl shadow-2xl shadow-black/20 animate-in fade-in zoom-in-95 duration-200 pointer-events-none"
                    style={{ 
                        top: coords.top, 
                        left: coords.left, 
                        transform: getTranslate()
                    }}
                >
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                             <p className="text-[11px] font-bold text-text-main uppercase tracking-[0.15em]">{name}</p>
                        </div>
                        <p className="text-[10px] font-medium text-tertiary leading-relaxed">{description}</p>
                    </div>
                    {/* Arrow */}
                    <div style={getArrowStyles()} />
                </div>,
                document.body
            )}
        </div>
    );
}
