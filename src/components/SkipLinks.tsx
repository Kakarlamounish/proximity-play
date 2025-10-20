import React from 'react';
import { Button } from '@/components/ui/button';

const SkipLinks: React.FC = () => {
  return (
    <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-4 focus-within:left-4 focus-within:z-50">
      <nav aria-label="Skip navigation links">
        <ul className="flex gap-2">
          <li>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-background border-2 focus:ring-2 focus:ring-primary"
            >
              <a href="#main-content">Skip to main content</a>
            </Button>
          </li>
          <li>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-background border-2 focus:ring-2 focus:ring-primary"
            >
              <a href="#navigation">Skip to navigation</a>
            </Button>
          </li>
          <li>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-background border-2 focus:ring-2 focus:ring-primary"
            >
              <a href="#search">Skip to search</a>
            </Button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default SkipLinks;