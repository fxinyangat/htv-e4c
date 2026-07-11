import { ReactNode } from 'react'

export default function DarkBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0c0a12] overflow-hidden">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-ht-orange/20 rounded-full blur-[120px]" />
      <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] bg-ht-blue/40 rounded-full blur-[120px]" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
