"use client";

import { useState, type InputHTMLAttributes } from "react";

export default function PasswordInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-12`} />
      <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-400">
        {visible ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.3 3.3M6.2 6.2C3.9 7.7 2.7 10 2.5 12c.5 1.4 2.2 4.3 6 6.1 1.1.5 2.3.8 3.5.8 1.1 0 2.2-.2 3.1-.6" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12S5.8 5 12 5s9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
      </button>
    </div>
  );
}
