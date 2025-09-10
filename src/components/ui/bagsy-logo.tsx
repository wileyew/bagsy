interface BagsyLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function BagsyLogo({ size = "md", showText = true, className = "" }: BagsyLogoProps) {
  const sizeClasses = {
    sm: "h-8 w-24",
    md: "h-10 w-32", 
    lg: "h-14 w-40"
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo with roof-like graphic and text */}
      <div className={`${sizeClasses[size]} relative`}>
        <svg 
          viewBox="0 0 160 60" 
          className="w-full h-full"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Blue rounded square background */}
          <rect x="0" y="10" width="50" height="50" rx="12" fill="#007AFF"/>
          
          
          {/* White house icon */}
          <g transform="translate(25, 35)">
            {/* House silhouette */}
            <path d="M-10 -8 L0 -16 L10 -8 L10 8 L-10 8 Z" fill="white"/>
            {/* House base */}
            <rect x="-8" y="0" width="16" height="8" fill="white"/>
            {/* Small black checkmark inside house */}
            <path d="M-3 0 L0 3 L6 -3" stroke="#000000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
          
          
          {/* Bagsy text */}
          <text x="65" y="45" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#333333">Bagsy</text>
        </svg>
      </div>
    </div>
  );
}
