import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import SearchPalette from './SearchPalette';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden pb-20 md:pb-6 thin-scrollbar">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
