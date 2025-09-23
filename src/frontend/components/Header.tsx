import React from "react";
import { Home, Users, Trophy, User } from "lucide-react";

type HeaderButtonProps = {
  label: string;
  icon: React.ReactNode;
  link?: string;
};

type HeaderProps = {
  sticky?: boolean;   // fixed at top
  heightVh?: number;  // header height (vh)
};

function HeaderButton({ label, icon, link = "#" }: HeaderButtonProps) {
  const handleClick = () => console.log(`${label} clicked`);
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-transparent hover:text-indigo-600 transition-colors"
      data-link={link}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Header({ sticky = true, heightVh = 10 }: HeaderProps) {
  const heightStyle = { height: `${heightVh}vh` };

  const content = (
    <header className="w-full h-full flex items-center px-8 py-4 bg-white shadow-sm">
      <div className="flex w-full items-center justify-between">
        <div className="text-4xl font-bold text-gray-800">Mixing Dojo</div>
        <nav className="flex items-center gap-10">
          <HeaderButton label="Home" icon={<Home className="w-5 h-5" />} />
          <HeaderButton label="Friends" icon={<Users className="w-5 h-5" />} />
          <HeaderButton label="Leaderboard" icon={<Trophy className="w-5 h-5" />} />
          <HeaderButton label="Profile" icon={<User className="w-5 h-5" />} />
        </nav>
      </div>
    </header>
  );

  if (sticky) {
    // fixed bar + automatic spacer so content isn’t hidden
    return (
      <>
        <div className="fixed top-0 left-0 w-screen" style={heightStyle}>
          {content}
        </div>
        <div style={heightStyle} /> {/* spacer */}
      </>
    );
  }

  // non-sticky variant
  return (
    <div className="w-full" style={heightStyle}>
      {content}
    </div>
  );
}

export default Header;
