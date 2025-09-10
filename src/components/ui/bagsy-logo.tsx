import { MapPin } from "lucide-react";

interface BagsyLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function BagsyLogo({ size = "md", showText = true, className = "" }: BagsyLogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Blue square with location pin icon */}
      <div className={`${sizeClasses[size]} bg-[#007AFF] rounded-lg flex items-center justify-center`}>
        <MapPin className="h-3/5 w-3/5 text-white" />
      </div>
      
      {/* Bagsy text */}
      {showText && (
        <span className={`font-bold text-black ${textSizeClasses[size]}`}>
          Bagsy
        </span>
      )}
    </div>
  );
}
