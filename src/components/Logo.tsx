import React from 'react';

interface LogoProps {
    size?: number;
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 28, className }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
            <rect
                x="16"
                y="3"
                width="15"
                height="15"
                rx="5"
                transform="rotate(45 16 3)"
                fill="#8B795E"
                fillOpacity="0.4"
            />
            <rect
                x="16"
                y="10"
                width="15"
                height="15"
                rx="6"
                transform="rotate(45 16 10)"
                fill="#6B8068"
                fillOpacity="0.9"
            />
        </svg>
    );
};

export default Logo;
