"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface TimelineEvent {
  year: string;
  title: string;
  event: string;
  description: string;
}

export default function TimelinePage() {
  const { storyId } = useParams();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!storyId) return;

    async function fetchTimeline() {
      try {
        const res = await fetch(`/api/timeline/${storyId}`);
        if (!res.ok) throw new Error("Failed");

        const data = await res.json();
        setEvents(data);
      } catch (err) {
        setError("Failed to fetch timeline.");
      }
    }

    fetchTimeline();
  }, [storyId]);

  if (error) {
    return (
      <div className="text-center text-red-600 pt-20">
        {error}
      </div>
    );
  }

  return (
    
    <div className="min-h-screen py-20 px-6 bg-gradient-to-br from-[#FFFDF8] via-[#FFF9F0] to-[#FFFDF8] relative overflow-hidden">
        
      
      {/* Animated Background Blobs */}
      <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-gradient-to-br from-[#C9A75A]/10 to-[#E6D8B7]/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-20 right-10 w-[600px] h-[600px] bg-gradient-to-br from-[#A67C3A]/8 to-[#876728]/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-[#E6D8B7]/12 to-[#C9A75A]/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }}></div>
      
      {/* Vintage Map Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c49a6c' fill-opacity='1'%3E%3Cpath d='M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10zm10 8c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm40 40c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(201, 167, 90, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(201, 167, 90, 0.2) 1px, transparent 1px)',
        backgroundSize: '100px 100px'
      }}></div>
      
      <div className="max-w-6xl mx-auto relative z-10">
    

        {/* Modern Header with Subtle Animation */}
        <div className="text-center mb-20">
          <div className="inline-block animate-fade-in">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-[#C9A75A] via-[#A67C3A] to-[#876728] bg-clip-text text-transparent">
              Life Timeline
            </h1>
            <div className="flex items-center justify-center gap-3 mt-5">
              <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-[#C9A75A] to-transparent"></div>
              <div className="w-2 h-2 rounded-full bg-[#C9A75A] animate-pulse"></div>
              <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-[#C9A75A] to-transparent"></div>
            </div>
          </div>
        </div>

        {/* Timeline Container */}
        <div className="relative mx-auto max-w-5xl">

          {/* Enhanced Center Line with Gradient */}
          <div className="absolute left-1/2 top-0 w-[2px] h-full bg-gradient-to-b from-[#C9A75A]/40 via-[#E6D8B7] to-[#C9A75A]/40 -translate-x-1/2"></div>

          {events.map((evt, idx) => {
            const leftSide = idx % 2 === 0;

            return (
              <div 
                key={idx} 
                className="relative mb-24 md:flex md:items-center opacity-0 animate-slide-up"
                style={{ animationDelay: `${idx * 150}ms`, animationFillMode: 'forwards' }}
              >

                {/* YEAR BADGE - Centered on opposite side */}
                <div
                  className={`
                    hidden md:flex absolute top-1/2 -translate-y-1/2
                    ${leftSide ? "left-[calc(50%+2.5rem)]" : "right-[calc(50%+2.5rem)]"}
                  `}
                >
                  <div className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C9A75A] to-[#876728] rounded-full blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                    <div className="relative px-6 py-2.5 bg-gradient-to-br from-[#C9A75A] to-[#876728] text-white font-bold text-xl rounded-full shadow-lg border-[3px] border-[#FFFDF8] hover:scale-105 transition-transform duration-300">
                      {evt.year}
                    </div>
                  </div>
                </div>

                {/* Enhanced DOT with Subtle Glow */}
                <div className="hidden md:block absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10">
                  <div className="relative">
                    <div className="absolute inset-0 w-3.5 h-3.5 bg-[#C9A75A] rounded-full blur-sm opacity-60"></div>
                    <div className="relative w-3.5 h-3.5 bg-[#C9A75A] border-[4px] border-[#FFFDF8] rounded-full shadow-md"></div>
                  </div>
                </div>

                {/* TEXT CARD - Modern Glassmorphism Style */}
                <div
                  className={`
                    md:w-[44%]
                    ${leftSide ? "md:pr-2" : "md:ml-auto md:pl-2"}
                    ${leftSide ? "md:text-right" : "md:text-left"}
                  `}
                >
                  <div className="group relative bg-white/80 backdrop-blur-sm border border-[#F2E5C7]/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 overflow-hidden">
                    
                    {/* Gradient Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C9A75A]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    {/* Content */}
                    <div className="relative p-7">
                      {/* Decorative Top Line */}
                      <div className={`h-1 w-16 bg-gradient-to-r from-[#C9A75A] to-[#E6D8B7] rounded-full mb-5 ${leftSide ? 'ml-auto' : ''}`}></div>
                      
                      {/* Event Title */}
                      <h3 className="text-2xl font-bold text-[#8C6A26] mb-2 group-hover:text-[#C9A75A] transition-colors duration-300">
                        {evt.event}
                      </h3>
                      
                      {/* Subtitle */}
                      <h4 className="text-base font-medium text-[#A67C3A] mb-4 italic opacity-90">
                        {evt.title}
                      </h4>
                      
                      {/* Description */}
                      <p className="text-[#6E6B60] leading-relaxed text-[15px]">
                        {evt.description}
                      </p>

                      {/* Decorative Bottom Accent */}
                      <div className={`flex items-center gap-1.5 mt-5 ${leftSide ? 'justify-end' : 'justify-start'}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#C9A75A]/60"></div>
                        <div className="w-1 h-1 rounded-full bg-[#C9A75A]/40"></div>
                        <div className="w-0.5 h-0.5 rounded-full bg-[#C9A75A]/20"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* YEAR BADGE (Mobile) */}
                <div className="md:hidden mb-4 text-center">
                  <div className="inline-block px-6 py-2 bg-gradient-to-r from-[#C9A75A] to-[#876728] text-white font-bold text-lg rounded-full shadow-lg">
                    {evt.year}
                  </div>
                </div>

              </div>
            );
          })}

          {/* Elegant End Marker */}
          <div className="flex justify-center pt-10 animate-fade-in" style={{ animationDelay: '1s' }}>
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 w-4 h-4 bg-[#C9A75A] rounded-full blur-md opacity-40"></div>
                <div className="relative w-4 h-4 rounded-full bg-gradient-to-br from-[#C9A75A] to-[#876728] border-4 border-[#FFFDF8] shadow-lg"></div>
              </div>
              <div className="flex items-center gap-3 text-[#C9A75A]/50 text-xs uppercase tracking-[0.2em] font-medium">
                <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-[#C9A75A]/30"></div>
                <span>Present Day</span>
                <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-[#C9A75A]/30"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}