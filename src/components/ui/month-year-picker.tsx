"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, parse, isValid, addYears, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MonthYearPickerProps {
  date?: Date;
  onChange: (date: Date) => void;
  className?: string;
  placeholder?: string;
}

export function MonthYearPicker({
  date,
  onChange,
  className,
  placeholder = "MM/AAAA",
}: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(date || new Date());
  const [inputValue, setInputValue] = React.useState(
    date ? format(date, "MM/yyyy") : ""
  );
  
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (date) {
      setInputValue(format(date, "MM/yyyy"));
      setViewDate(date);
    }
  }, [date]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove non-digits
    
    // Mask logic MM/AAAA
    if (value.length > 6) value = value.slice(0, 6);
    
    if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }

    setInputValue(value);

    // Validate and update Valid Date
    if (value.length === 7) {
      const [monthStr, yearStr] = value.split("/");
      const month = parseInt(monthStr);
      
      if (month >= 1 && month <= 12) {
        const parsedDate = parse(value, "MM/yyyy", new Date());
        if (isValid(parsedDate)) {
          onChange(parsedDate);
          setViewDate(parsedDate);
        }
      }
    }
  };

  const months = [
    "Jan", "Fev", "Mar", "Abr",
    "Mai", "Jun", "Jul", "Ago",
    "Set", "Out", "Nov", "Dez"
  ];

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(viewDate.getFullYear(), monthIndex, 1);
    onChange(newDate);
    setIsOpen(false);
  };

  const changeYear = (amount: number) => {
    setViewDate(prev => addYears(prev, amount));
  };

  return (
    <div className={cn("relative", className)} ref={popoverRef}>
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          className="pl-10 h-12 bg-gray-1 border-none text-white placeholder:text-gray-5"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-0 top-0 h-12 w-10 text-gray-5 hover:text-white hover:bg-transparent"
          onClick={() => setIsOpen(!isOpen)}
        >
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </div>

      {isOpen && (
        <div className="absolute top-14 left-0 z-50 w-[280px] rounded-md border border-zinc-800 bg-zinc-900 shadow-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => changeYear(-1)}
              className="p-1 text-gray-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-white">
              {viewDate.getFullYear()}
            </span>
            <button
              onClick={() => changeYear(1)}
              className="p-1 text-gray-400 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {months.map((month, index) => {
              const isSelected = date && 
                date.getMonth() === index && 
                date.getFullYear() === viewDate.getFullYear();

              return (
                <button
                  key={month}
                  onClick={() => handleMonthSelect(index)}
                  className={cn(
                    "text-sm py-2 rounded transition-colors",
                    isSelected 
                      ? "bg-green text-white font-medium" 
                      : "text-gray-300 hover:bg-zinc-800 hover:text-white"
                  )}
                  type="button"
                >
                  {month}
                </button>
              );
            })}
          </div>
          
          <button 
            type="button"
            className="w-full mt-4 text-xs text-green hover:underline text-center"
            onClick={() => {
              const now = new Date();
              onChange(now);
              setViewDate(now);
              setIsOpen(false);
            }}
          >
            Este mês
          </button>
        </div>
      )}
    </div>
  );
}
