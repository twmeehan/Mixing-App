import React from "react";
import { Home, Users, Trophy, User } from "lucide-react";

type HeaderButtonProps = {
  label: string;
  icon: React.ReactNode;
  link?: string; // unused for now
};

function HeaderButton({ label, icon, link = "boop" }: HeaderButtonProps) {
  const handleClick = () => {
    console.log(`${label} clicked`);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-indigo-600 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Header() {
  return (
    <header className="w-full h-full flex items-center px-8 py-4 bg-white shadow-sm">
      <div className="flex w-full items-center justify-between">
        {/* Logo */}
        <div className="text-4xl font-bold text-gray-800">Mixing Dojo</div>

        {/* Buttons */}
        <nav className="flex items-center gap-10">
          <HeaderButton label="Home" icon={<Home className="w-5 h-5" />} />
          <HeaderButton label="Friends" icon={<Users className="w-5 h-5" />} />
          <HeaderButton label="Leaderboard" icon={<Trophy className="w-5 h-5" />} />
          <HeaderButton label="Profile" icon={<User className="w-5 h-5" />} />
        </nav>
      </div>
    </header>
  );
}


export default Header;
