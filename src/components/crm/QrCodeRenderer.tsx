import { QRCodeSVG } from 'qrcode.react';

interface QrCodeRendererProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Componente que renderiza QR Code de duas formas:
 * 1. Se for uma imagem base64 (data:image) -> renderiza como <img>
 * 2. Se for um código/string -> gera QR Code via biblioteca
 */
export function QrCodeRenderer({ value, size = 256, className = '' }: QrCodeRendererProps) {
  // Verifica se é uma imagem base64 (começa com data:image ou contém padrão base64 de imagem)
  const isBase64Image = 
    value.startsWith('data:image') || 
    // Alguns retornos podem ser base64 puro sem prefixo data:image
    (value.length > 500 && /^[A-Za-z0-9+/=]+$/.test(value.substring(0, 100)));

  if (isBase64Image) {
    // Se for base64 puro sem prefixo, adicionar o prefixo
    const imgSrc = value.startsWith('data:') 
      ? value 
      : `data:image/png;base64,${value}`;
    
    return (
      <img 
        src={imgSrc} 
        alt="QR Code" 
        width={size}
        height={size}
        className={className}
        style={{ imageRendering: 'pixelated' }}
      />
    );
  }

  // Se for um código/string, gerar QR Code via biblioteca
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      includeMargin={false}
      className={className}
    />
  );
}
