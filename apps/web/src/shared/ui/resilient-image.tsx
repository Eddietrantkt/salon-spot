import { useEffect, useState, type ImgHTMLAttributes, type JSX } from 'react';

interface ResilientImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc: string;
}

export function ResilientImage({ src, fallbackSrc, onError, ...props }: ResilientImageProps): JSX.Element {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);

  useEffect(() => { setCurrentSrc(src || fallbackSrc); }, [src, fallbackSrc]);

  return <img
    {...props}
    src={currentSrc}
    onError={(event) => {
      onError?.(event);
      if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
    }}
  />;
}
