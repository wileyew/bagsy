interface BagsyLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function BagsyLogo({ size = "md", showText = true, className = "" }: BagsyLogoProps) {
  const sizeClasses = {
    sm: "h-6 w-16",
    md: "h-8 w-20", 
    lg: "h-12 w-24"
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
          viewBox="0 0 80 40" 
          className="w-full h-full"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Blue roof-like graphic element above "gsy" */}
          <path d="M10 15 L40 5 L70 15 L70 30 L10 30 Z" fill="#007AFF"/>
          
          {/* Chimney on the left side of the roof */}
          <rect x="12" y="8" width="4" height="7" fill="#007AFF"/>
          
          {/* Right side wave/swoosh extending from roof */}
          <path d="M70 15 Q75 12 78 18 Q81 24 75 27 L70 30 Z" fill="#007AFF"/>
          
          {/* bagsy text in lowercase */}
          <text x="40" y="38" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="#000000">bagsy</text>
        </svg>
      </div>
    </div>
  );
}
