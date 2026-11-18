import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";

interface ResponseSearchBarProps {
  query: string;
  matchCount: number;
  activeIndex: number;
  capped: boolean;
  unsupported: boolean;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function ResponseSearchBar({
  query,
  matchCount,
  activeIndex,
  capped,
  unsupported,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
}: ResponseSearchBarProps) {
  const hasQuery = query !== "";
  const empty = hasQuery && !unsupported && matchCount === 0;

  let status: string | null = null;
  if (hasQuery) {
    if (unsupported) status = "Switch to Raw to search";
    else if (matchCount === 0) status = "No results";
    else status = `${activeIndex + 1} / ${matchCount}${capped ? "+" : ""}`;
  }

  const canNavigate = !unsupported && matchCount > 0;

  return (
    <div className="response-search" role="search" aria-label="Response search">
      <div className="response-search-box">
        <Search className="search-icon" size={13} aria-hidden="true" />
        <Input
          autoFocus
          aria-label="Search response body"
          placeholder="Find in response…"
          spellCheck={false}
          value={query}
          onValueChange={onQueryChange}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!canNavigate) return;
              if (event.shiftKey) onPrev();
              else onNext();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
      </div>
      {status ? (
        <span
          className={empty ? "response-search-status is-empty" : "response-search-status"}
          role="status"
        >
          {status}
        </span>
      ) : null}
      <Button
        className="icon-button"
        aria-label="Previous match"
        disabled={!canNavigate}
        onClick={onPrev}
      >
        <ChevronUp size={14} aria-hidden="true" />
      </Button>
      <Button
        className="icon-button"
        aria-label="Next match"
        disabled={!canNavigate}
        onClick={onNext}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </Button>
      <Button className="icon-button" aria-label="Close search" onClick={onClose}>
        <X size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}
