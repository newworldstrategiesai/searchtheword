"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchSuggestionButtonsProps = {
  searchQuery: string;
  fullText: string | null;
  onSelect: (suggestion: string) => void;
};

export function SearchSuggestionButtons({ searchQuery, fullText, onSelect }: SearchSuggestionButtonsProps) {
  const suggestions = useMemo(() => {
    if (!fullText || searchQuery.trim().length < 2) return [];

    const text = fullText.toLowerCase();
    const query = searchQuery.toLowerCase();
    const suggestions: string[] = [];

    // Extract key terms from the sermon text
    const words = text.split(/\s+/).filter(word => word.length > 3);
    const uniqueWords = [...new Set(words)];

    // Find related terms based on the current search
    uniqueWords.forEach(word => {
      if (word.includes(query) || query.includes(word)) {
        suggestions.push(word);
      }
    });

    // Add common sermon-related terms
    const sermonTerms = [
      "jesus", "christ", "god", "yahweh", "lord", "scripture", 
      "bible", "teaching", "commandment", "law", "covenant",
      "kingdom", "salvation", "faith", "prayer", "worship"
    ];

    sermonTerms.forEach(term => {
      if (text.includes(term) && !suggestions.includes(term) && term !== query) {
        suggestions.push(term);
      }
    });

    // Limit to 8 suggestions and prioritize relevance
    return suggestions
      .filter(s => s !== query)
      .slice(0, 8)
      .slice(0, 6); // Show max 6 suggestions
  }, [fullText, searchQuery]);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion, index) => (
        <Button
          key={`${suggestion}-${index}`}
          variant="outline"
          size="sm"
          onClick={() => onSelect(suggestion)}
          className={cn(
            "text-xs h-7 px-2 py-1",
            "hover:bg-primary hover:text-primary-foreground",
            "transition-colors duration-200"
          )}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
