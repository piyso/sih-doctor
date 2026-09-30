import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface RealQrCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  fgColor?: string;
  bgColor?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  includeBorder?: boolean;
}

/**
 * RealQrCode - High-Fidelity Scannable Real-World Optical QR Generator
 * Renders authentic, high-density SVG QR codes readable by any smartphone camera,
 * Google Lens, ABHA scanner, or medical barcode reader.
 */
export const RealQrCode: React.FC<RealQrCodeProps> = ({
  value,
  size = 140,
  level = 'M',
  fgColor = '#0f172a',
  bgColor = '#ffffff',
  className = '',
  style = {},
  title,
  includeBorder = false
}) => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) {
      setSvgMarkup('');
      return;
    }

    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: level,
      margin: 1,
      color: {
        dark: fgColor,
        light: bgColor
      },
      width: size
    })
      .then((svg) => {
        if (active) {
          setSvgMarkup(svg);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          console.warn('RealQrCode generation error:', err);
          setError('Failed to generate QR');
        }
      });

    return () => {
      active = false;
    };
  }, [value, size, level, fgColor, bgColor]);

  if (error || !value) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/40 rounded-lg text-[10px] text-muted-foreground font-mono ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        <span>{error || 'No Data'}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-block overflow-hidden transition-all duration-200 ${
        includeBorder ? 'p-1.5 bg-white rounded-xl shadow-xs border border-border/80' : ''
      } ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
      title={title || `Scan QR: ${value.substring(0, 40)}...`}
    >
      <div
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    </div>
  );
};
