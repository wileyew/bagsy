interface BagsyLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function BagsyLogo({ size = "md", showText = true, className = "" }: BagsyLogoProps) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10", 
    lg: "h-14"
  };

  const textSizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl"
  };

  const tmSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo using actual PNG image */}
      <img 
        src="/bagsy-logo.png" 
        alt="Bagsy Logo" 
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
      {showText && (
        <div className="flex items-start gap-0.5">
          <span className={`font-bold tracking-tight ${textSizeClasses[size]}`}>
            Bagsy
          </span>
          <sup className={`${tmSizeClasses[size]} font-normal text-muted-foreground`}>
            ™
          </sup>
        </div>
      )}
    </div>
  );
}