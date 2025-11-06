import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, X } from 'lucide-react';

interface FilterOptions {
  radius: number;
  interests: string[];
  memberCount: { min: number; max: number };
  sortBy: 'distance' | 'members' | 'recent';
}

interface AdvancedFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableInterests: string[];
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  availableInterests
}) => {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const resetFilters: FilterOptions = {
      radius: 2,
      interests: [],
      memberCount: { min: 0, max: 1000 },
      sortBy: 'distance'
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const toggleInterest = (interest: string) => {
    setLocalFilters(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const activeFiltersCount = 
    localFilters.interests.length +
    (localFilters.sortBy !== 'distance' ? 1 : 0) +
    (localFilters.memberCount.min !== 0 || localFilters.memberCount.max !== 1000 ? 1 : 0);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 relative">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Advanced Filters</SheetTitle>
          <SheetDescription>
            Refine your search to find the perfect bubbles
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Search Radius */}
          <div className="space-y-3">
            <Label>Search Radius: {localFilters.radius}km</Label>
            <Slider
              value={[localFilters.radius]}
              onValueChange={([value]) => setLocalFilters(prev => ({ ...prev, radius: value }))}
              min={0.5}
              max={10}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5km</span>
              <span>10km</span>
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-3">
            <Label>Sort By</Label>
            <Select
              value={localFilters.sortBy}
              onValueChange={(value: any) => setLocalFilters(prev => ({ ...prev, sortBy: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Nearest First</SelectItem>
                <SelectItem value="members">Most Popular</SelectItem>
                <SelectItem value="recent">Recently Active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Member Count Range */}
          <div className="space-y-3">
            <Label>Member Count</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="min-members" className="text-xs text-muted-foreground">
                  Minimum
                </Label>
                <Input
                  id="min-members"
                  type="number"
                  value={localFilters.memberCount.min}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    memberCount: { ...prev.memberCount, min: parseInt(e.target.value) || 0 }
                  }))}
                  min={0}
                />
              </div>
              <div>
                <Label htmlFor="max-members" className="text-xs text-muted-foreground">
                  Maximum
                </Label>
                <Input
                  id="max-members"
                  type="number"
                  value={localFilters.memberCount.max}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    memberCount: { ...prev.memberCount, max: parseInt(e.target.value) || 1000 }
                  }))}
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Interests */}
          <div className="space-y-3">
            <Label>Interests</Label>
            <div className="flex flex-wrap gap-2">
              {availableInterests.map((interest) => (
                <Badge
                  key={interest}
                  variant={localFilters.interests.includes(interest) ? "default" : "outline"}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                  {localFilters.interests.includes(interest) && (
                    <X className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              Reset
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1 bg-gradient-to-r from-secondary to-primary"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
