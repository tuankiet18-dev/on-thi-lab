import type { ExamSummary } from "@onthilab/contracts";
import { FileText, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { searchCourses, type CourseSearchResult } from "../lib/catalog-search";

const MAX_RESULTS = 6;
const DEBOUNCE_MS = 300;

interface SearchDropdownProps {
  exams: ExamSummary[];
  campusName?: string;
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  describedBy?: string;
  className?: string;
}

export function SearchDropdown({
  exams,
  campusName,
  query,
  onQueryChange,
  placeholder = "Ví dụ: SWD, PRF192, Java Web...",
  describedBy,
  className,
}: SearchDropdownProps) {
  const listboxId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const navigate = useNavigate();

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim().length >= 1) {
        setIsOpen(true);
        setActiveIndex(-1);
      } else {
        setIsOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results: CourseSearchResult[] =
    debouncedQuery.trim().length >= 1
      ? searchCourses(exams, debouncedQuery, campusName).slice(0, MAX_RESULTS)
      : [];

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
        break;
      case "Enter":
        event.preventDefault();
        if (results.length > 0) {
          handleSelect(results[activeIndex >= 0 ? activeIndex : 0]!);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  function handleSelect(result: CourseSearchResult) {
    const newestExam = result.exams[0];
    if (!newestExam) return;
    setIsOpen(false);
    setActiveIndex(-1);
    onQueryChange(result.courseCode);
    void navigate({
      to: "/exams/$examId",
      params: { examId: newestExam.id },
    });
  }

  function clearQuery() {
    onQueryChange("");
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  const showDropdown = isOpen && debouncedQuery.trim().length >= 1;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Tìm mã hoặc tên môn học
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
          size={20}
          aria-hidden="true"
        />
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `search-option-${activeIndex}` : undefined
          }
          aria-describedby={describedBy}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (debouncedQuery.trim().length >= 1) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="min-h-14 w-full rounded-xl border border-white bg-white py-3 pl-12 pr-14 text-base font-semibold text-foreground shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-200 focus:ring-3 focus:ring-white/35"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/30"
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-panel">
          {results.length === 0 ? (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Kết quả tìm kiếm"
              className="flex flex-col items-center gap-2 px-4 py-8 text-center"
            >
              <Search className="text-slate-300" size={28} aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-600">
                Không tìm thấy môn phù hợp
              </p>
              <p className="text-xs leading-5 text-slate-400">
                Hãy kiểm tra lại mã môn (SWD392, PRN222) hoặc tên môn.
              </p>
            </div>
          ) : (
            <>
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Kết quả tìm kiếm"
                className="py-1.5"
              >
                {results.map((result, index) => {
                  const newestExam = result.exams[0];
                  const isActive = index === activeIndex;
                  return (
                    <li
                      key={result.courseCode}
                      id={`search-option-${index}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSelect(result);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`cursor-pointer ${
                        isActive ? "bg-primary-soft" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left">
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft font-heading text-xs font-bold text-primary"
                          aria-hidden="true"
                        >
                          {result.courseCode.slice(0, 3)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-foreground">
                            {result.courseCode}
                            <span className="ml-1.5 text-xs font-normal text-slate-400">
                              · {result.courseName}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <FileText size={11} aria-hidden="true" />
                            {result.exams.length} đề
                            {newestExam && (
                              <span className="ml-1 text-slate-400">
                                · mới nhất: {newestExam.semester}
                              </span>
                            )}
                          </span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-border p-1.5">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    void navigate({
                      to: "/exams",
                      search: { q: query.trim() },
                    });
                    setIsOpen(false);
                  }}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                >
                  <Search size={14} aria-hidden="true" />
                  Tìm tất cả kết quả cho "{query.trim()}"
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
