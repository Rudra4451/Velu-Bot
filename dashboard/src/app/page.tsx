import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-8">
        
        <h1 className="text-6xl font-extrabold tracking-tight bg-gradient-to-r from-pink-400 to-purple-400 text-transparent bg-clip-text drop-shadow-sm">
          Velu Dashboard
        </h1>
        
        <p className="text-xl text-slate-300">
          The ultimate control center for your Discord server.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
          
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center hover:scale-105 transition-transform cursor-pointer">
            <span className="text-4xl mb-4">🏆</span>
            <h2 className="text-lg font-bold">Economy</h2>
            <p className="text-sm text-slate-400 mt-2 text-center">Manage XP multipliers, shop items, and currency rules.</p>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center hover:scale-105 transition-transform cursor-pointer">
            <span className="text-4xl mb-4">🛡️</span>
            <h2 className="text-lg font-bold">Moderation</h2>
            <p className="text-sm text-slate-400 mt-2 text-center">View warnings, active timeouts, and automod logs.</p>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center hover:scale-105 transition-transform cursor-pointer">
            <span className="text-4xl mb-4">🎵</span>
            <h2 className="text-lg font-bold">Music</h2>
            <p className="text-sm text-slate-400 mt-2 text-center">See the current queue and control playback from the web.</p>
          </div>

        </div>

        <button className="mt-12 px-8 py-3 rounded-full bg-purple-500 hover:bg-purple-600 text-white font-semibold text-lg shadow-lg shadow-purple-500/30 transition-all">
          Login with Discord
        </button>

      </div>
    </div>
  );
}
