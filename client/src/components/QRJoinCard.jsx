import { QRCodeSVG } from 'qrcode.react';

export default function QRJoinCard({ pin, origin = typeof window !== 'undefined' ? window.location.origin : '' }) {
  const joinUrl = `${origin}/join?pin=${pin}`;

  return (
    <div className="bg-surface border border-border rounded-[var(--radius-md,8px)] p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 sm:gap-8 shadow-[var(--shadow-card)] transition-colors">
      {/* High-Contrast QR Code on white tile with proper quiet zone in both light & dark modes */}
      <div className="p-4 bg-white rounded-[var(--radius-sm,4px)] shadow-xs shrink-0 border border-gray-200">
        <QRCodeSVG
          value={joinUrl}
          size={160}
          level="M"
          fgColor="#000000"
          bgColor="#FFFFFF"
          includeMargin={false}
        />
      </div>

      <div className="flex flex-col text-center md:text-left">
        <span className="text-xs uppercase font-semibold tracking-wider text-accent mb-1">
          Join with your device
        </span>
        <div className="text-sm text-text-muted mb-3">
          Scan the QR code or go to{' '}
          <strong className="text-text underline font-semibold">
            {origin.replace(/^https?:\/\//, '')}/join
          </strong>
        </div>
        <div className="text-xs text-text-muted mb-1 font-medium">Room PIN:</div>
        <div className="text-5xl sm:text-6xl font-bold tracking-widest text-text font-mono bg-bg-subtle px-6 py-2.5 rounded-[var(--radius-sm,4px)] border border-border inline-block self-center md:self-start">
          {pin}
        </div>
      </div>
    </div>
  );
}
