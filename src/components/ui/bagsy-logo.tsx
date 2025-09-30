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

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo using actual PNG image */}
      <img 
        src="/bagsy-logo.png" 
        alt="Bagsy Logo" 
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
    </div>
  );
}