'use client';

import Link from 'next/link';
import { Heart, User, LogOut, Menu } from 'lucide-react';
import { Button } from '@crm-eco/ui';
import { useState } from 'react';

export function PortalHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-semibold text-slate-900">WealthShare</span>
              <span className="text-sm text-slate-500 ml-2">Member Portal</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              href="/" 
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              href="/enroll" 
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Enroll
            </Link>
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="w-4 h-4" />
              <span>Account</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 text-slate-500">
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-2">
              <Link 
                href="/" 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link 
                href="/enroll" 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Enroll
              </Link>
              <hr className="my-2" />
              <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-left flex items-center gap-2">
                <User className="w-4 h-4" />
                Account
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg text-left flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

