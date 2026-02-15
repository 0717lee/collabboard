import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CircularSliderProps {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    size?: number;
    color?: string;
    trackColor?: string;
    thickness?: number;
    className?: string;
}

export const CircularSlider: React.FC<CircularSliderProps> = ({
    value,
    min,
    max,
    onChange,
    size = 40,
    color = '#10B981',
    trackColor = 'rgba(0,0,0,0.06)',
    thickness = 3,
    className
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Geometry
    const center = size / 2;
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;

    // Value <-> Angle (0 degrees at top)
    // Map value min->max to angle 0->360
    const valueToAngle = (val: number) => {
        const clamped = Math.min(max, Math.max(min, val));
        const percentage = (clamped - min) / (max - min);
        return percentage * 360;
    };

    const angle = valueToAngle(value);
    const strokeDashoffset = circumference - (angle / 360) * circumference;

    // Interaction logic
    const handleInteraction = useCallback((clientX: number, clientY: number) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const dx = clientX - (rect.left + rect.width / 2);
        const dy = clientY - (rect.top + rect.height / 2);

        // Calculate angle (-180 to 180)
        // atan2(y, x) gives angle from positive x axis (right)
        // We want 0 at top (-90 degrees in standard math)
        let theta = Math.atan2(dy, dx) * (180 / Math.PI); 
        
        // Convert standard angle to 0-at-top clockwise
        // Standard: Right=0, Down=90, Left=180/-180, Up=-90
        // Target: Top=0, Right=90, Down=180, Left=270
        theta += 90; 
        if (theta < 0) theta += 360;

        // Angle -> Value
        const newValue = min + (theta / 360) * (max - min);
        const constrainedValue = Math.min(max, Math.max(min, newValue));
        
        onChange(Math.round(constrainedValue));
    }, [min, max, onChange]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        handleInteraction(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                e.preventDefault();
                handleInteraction(e.clientX, e.clientY);
            }
        };
        const handleTouchMove = (e: TouchEvent) => {
            if (isDragging) {
                e.preventDefault();
                handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
            }
        };
        const handleUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging, handleInteraction]);

    // Knob position
    // Convert angle (0 at top, clockwise) back to standard radian (0 at right, clockwise)
    // 0 deg (top) -> -90 deg standard
    const knobAngleRad = (angle - 90) * (Math.PI / 180);
    const knobX = center + radius * Math.cos(knobAngleRad);
    const knobY = center + radius * Math.sin(knobAngleRad);

    return (
        <div className={className} style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg
                ref={svgRef}
                width={size}
                height={size}
                style={{ cursor: 'pointer', overflow: 'visible' }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                {/* Track background */}
                <circle 
                    cx={center} 
                    cy={center} 
                    r={radius} 
                    fill="none" 
                    stroke={trackColor} 
                    strokeWidth={thickness} 
                />
                
                {/* Progress arc */}
                {/* Rotate -90 to start from top */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={thickness}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{ transition: isDragging ? 'none' : 'stroke-dashoffset 0.1s ease-out' }}
                />

                {/* Drag Handle */}
                <circle
                    cx={knobX}
                    cy={knobY}
                    r={thickness + 2}
                    fill="#fff"
                    stroke={color}
                    strokeWidth={2}
                    style={{ 
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
                        transition: isDragging ? 'none' : 'cx 0.1s, cy 0.1s',
                        cursor: 'grab'
                    }}
                />
            </svg>
            
            {/* Center value display (optional, can be overlay or inside) */}
            <div style={{
                position: 'absolute',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                pointerEvents: 'none',
                userSelect: 'none'
            }}>
                {Math.round(value)}
            </div>
        </div>
    );
};
