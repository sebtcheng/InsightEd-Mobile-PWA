import React from 'react';
import { TbTrophy, TbMedal } from "react-icons/tb";

const MyRankFooter = ({ rank, schoolName, score, medalColor }) => {
    return (
        <div className="fixed bottom-0 left-0 w-full z-40 px-4 pb-4 animate-in slide-in-from-bottom duration-500">
            <div className="bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 ring-1 ring-black/20">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 flex flex-col items-center justify-center bg-white/10 w-10 h-10 rounded-xl border border-white/10">
                        <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">Rank</span>
                        <span className={`text-lg font-black leading-none ${medalColor || 'text-white'}`}>#{rank}</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider mb-0.5">Your Ranking</p>
                        <h3 className="font-bold text-sm truncate max-w-[150px] sm:max-w-xs">{schoolName}</h3>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/5">
                    <TbTrophy className="text-yellow-400" size={16} />
                    <span className="font-black text-white text-sm">{Math.round(score)}%</span>
                </div>
            </div>
        </div>
    );
};

export default MyRankFooter;
