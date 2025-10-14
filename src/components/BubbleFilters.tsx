import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface BubbleFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedInterest: string;
  onInterestChange: (value: string) => void;
  maxDistance: number;
  onDistanceChange: (value: number[]) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

const interests = [
  'all',
  'sports',
  'music',
  'food',
  'technology',
  'art',
  'travel',
  'gaming',
  'fitness',
  'reading',
  'photography',
  'cooking'
];

export const BubbleFilters: React.FC<BubbleFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedInterest,
  onInterestChange,
  maxDistance,
  onDistanceChange,
  sortBy,
  onSortChange,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filter Bubbles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search bubbles..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Interest Filter */}
        <div className="space-y-2">
          <Label>Interest</Label>
          <Select value={selectedInterest} onValueChange={onInterestChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select interest" />
            </SelectTrigger>
            <SelectContent>
              {interests.map((interest) => (
                <SelectItem key={interest} value={interest}>
                  {interest.charAt(0).toUpperCase() + interest.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Distance Filter */}
        <div className="space-y-2">
          <Label>Max Distance: {maxDistance} km</Label>
          <Slider
            value={[maxDistance]}
            onValueChange={onDistanceChange}
            min={1}
            max={50}
            step={1}
            className="w-full"
          />
        </div>

        {/* Sort By */}
        <div className="space-y-2">
          <Label>Sort By</Label>
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nearest">Nearest First</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="members">Most Members</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
