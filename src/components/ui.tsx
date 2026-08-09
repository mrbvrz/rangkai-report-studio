import styled from "styled-components";
import { motion } from "framer-motion";
import { ChevronDown } from "./heroicons";
import { CalendarDays, ChevronLeft, ChevronRight } from "./heroicons";
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export const Button = styled.button<{
  $variant?: "primary" | "secondary" | "ghost" | "danger" | "warning";
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid
    ${({ $variant }) => ($variant === "secondary" ? "#dfe2da" : $variant === "warning" ? "#ead79b" : "transparent")};
  background: ${({ $variant }) => ($variant === "secondary" ? "#fff" : $variant === "ghost" ? "transparent" : $variant === "danger" ? "#fff0ed" : $variant === "warning" ? "#fff5cc" : "#6c8f58")};
  color: ${({ $variant }) => ($variant === "danger" ? "#b23c27" : $variant === "warning" ? "#795c17" : $variant === "primary" || !$variant ? "#fff" : "#343932")};
  font-weight: 550;
  font-size: 13px;
  transition: 0.18s ease;
  &:hover {
    transform: translateY(-1px);
    background: ${({ $variant }) => ($variant === "danger" ? "#ffe6e0" : $variant === "warning" ? "#ffedaa" : $variant === "secondary" ? "#f8faf6" : $variant === "ghost" ? "transparent" : "#5e7f4c")};
    box-shadow: ${({ $variant }) => ($variant === "ghost" ? "none" : "0 7px 18px rgba(30,35,28,.10)")};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

export const Card = styled(motion.div)`
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #e5e7e0;
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(30, 35, 28, 0.025);
`;

export const Input = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 13px;
  border-radius: 11px;
  border: 1px solid #dfe2da;
  background: #fff;
  color: #20231f;
  outline: none;
  transition: 0.18s;
  &:focus {
    border-color: #809970;
    box-shadow: 0 0 0 3px #edf5e8;
  }
`;
type PickerProps = {
  type?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};
function emitPickerChange(onChange: PickerProps["onChange"], value: string) {
  onChange?.({ target: { value } } as ChangeEvent<HTMLInputElement>);
}
function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}
function CalendarPicker({
  mode,
  value = "",
  onChange,
  className = "",
  placeholder,
  disabled,
}: PickerProps & { mode: "date" | "month" }) {
  const initial = value
    ? mode === "date"
      ? new Date(`${value}T00:00:00`)
      : new Date(`${value}-01T00:00:00`)
    : new Date();
  const [open, setOpen] = useState(false),
    [cursor, setCursor] = useState(
      new Date(initial.getFullYear(), initial.getMonth(), 1),
    ),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (value) {
      const next =
        mode === "date"
          ? new Date(`${value}T00:00:00`)
          : new Date(`${value}-01T00:00:00`);
      if (!Number.isNaN(next.getTime()))
        setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }, [value, mode]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const year = cursor.getFullYear(),
    month = cursor.getMonth();
  const chooseMonth = (nextMonth: number) => {
    const next = `${year}-${String(nextMonth + 1).padStart(2, "0")}`;
    emitPickerChange(onChange, next);
    setOpen(false);
  };
  const chooseDate = (day: number) => {
    const next = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    emitPickerChange(onChange, next);
    setOpen(false);
  };
  const days =
    mode === "date"
      ? Array.from(
          { length: new Date(year, month + 1, 0).getDate() },
          (_, i) => i + 1,
        )
      : [];
  const leading =
    mode === "date" ? (new Date(year, month, 1).getDay() + 6) % 7 : 0;
  const months = Array.from({ length: 12 }, (_, i) => i);
  const display =
    mode === "date" && value
      ? new Intl.DateTimeFormat("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${value}T00:00:00`))
      : mode === "month" && value
        ? monthLabel(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1)
        : placeholder || (mode === "date" ? "Pilih tanggal" : "Pilih bulan");
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center justify-between rounded-[11px] border border-[#dfe2da] bg-white px-3 text-left text-[13px] text-[#20231f] outline-none transition hover:border-[#b9c9b0] focus:border-[#809970] focus:ring-4 focus:ring-[#edf5e8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? "" : "text-[#8a9188]"}>{display}</span>
        <CalendarDays size={17} className="text-[#75836f]" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[290px] rounded-2xl border border-[#dfe5da] bg-white p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="rounded-lg p-2 text-[#657363] hover:bg-[#eef5e9]"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-[13px] font-medium capitalize text-[#364033]">
              {monthLabel(year, month)}
            </p>
            <button
              type="button"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="rounded-lg p-2 text-[#657363] hover:bg-[#eef5e9]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {mode === "month" ? (
            <div className="grid grid-cols-3 gap-2">
              {months.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => chooseMonth(item)}
                  className={`rounded-lg px-2 py-2.5 text-[12px] capitalize transition hover:bg-[#eef5e9] ${value === `${year}-${String(item + 1).padStart(2, "0")}` ? "bg-[#e6f2df] font-medium text-[#4c6843]" : "text-[#596256]"}`}
                >
                  {new Intl.DateTimeFormat("id-ID", { month: "short" }).format(
                    new Date(year, item, 1),
                  )}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-medium text-[#98a096]">
                {["Sn", "Se", "Sl", "Rb", "Km", "Jm", "Sb"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: leading }, (_, i) => (
                  <span key={`empty-${i}`} />
                ))}
                {days.map((day) => {
                  const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => chooseDate(day)}
                      className={`grid h-8 place-items-center rounded-lg text-[12px] transition hover:bg-[#eef5e9] ${value === key ? "bg-[#6c8f58] font-medium text-white hover:bg-[#5e7f4c]" : "text-[#596256]"}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export function DatePicker(props: PickerProps) {
  return <CalendarPicker {...props} mode="date" />;
}
export function MonthPicker(props: PickerProps) {
  return <CalendarPicker {...props} mode="month" />;
}
export const Textarea = styled.textarea`
  width: 100%;
  padding: 13px;
  border-radius: 11px;
  border: 1px solid #dfe2da;
  background: #fff;
  color: #20231f;
  outline: none;
  resize: vertical;
  transition: 0.18s;
  &:focus {
    border-color: #809970;
    box-shadow: 0 0 0 3px #edf5e8;
  }
`;
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  dropUp?: boolean;
  compact?: boolean;
};
export function Select({
  value,
  onChange,
  children,
  className = "",
  dropUp = false,
  compact = false,
  ...props
}: SelectProps) {
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null);
  const options = Children.toArray(children)
    .filter(
      (
        child,
      ): child is ReactElement<{
        value?: string | number;
        children?: ReactNode;
      }> => isValidElement(child),
    )
    .map((child) => ({
      value: String(child.props.value ?? ""),
      label: child.props.children,
    }));
  const current =
    options.find((option) => option.value === String(value ?? "")) ||
    options[0];
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const choose = (next: string) => {
    onChange?.({ target: { value: next } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-[11px] border border-[#dfe2da] bg-white px-3 text-left outline-none transition hover:border-[#b9c9b0] focus:border-[#809970] focus:ring-4 focus:ring-[#edf5e8] ${compact ? "h-9 text-[11px]" : "h-11 text-[13px]"}`}
      >
        <span className="truncate">{current?.label || "Pilih opsi"}</span>
        <ChevronDown
          size={compact ? 14 : 16}
          className="shrink-0 text-[#818a7c]"
        />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-50 max-h-64 overflow-auto rounded-xl border border-[#dfe5da] bg-white p-1.5 shadow-xl ${dropUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"}`}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === String(value ?? "")}
              key={option.value}
              onClick={() => choose(option.value)}
              className={`flex w-full rounded-lg px-3 py-2 text-left transition hover:bg-[#eef5e9] ${compact ? "text-[11px]" : "text-[13px]"} ${option.value === String(value ?? "") ? "bg-[#f1f7ed] font-medium text-[#4d6844]" : "text-[#4a5148]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-[13px] font-medium text-[#383d36]">
        {label}
        {hint && <small className="font-normal text-[#858b82]">{hint}</small>}
      </span>
      {children}
      {error && <small className="mt-1 block text-red-600">{error}</small>}
    </label>
  );
}
export function IconButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className="grid h-9 w-9 place-items-center rounded-[10px] text-[#656b62] transition hover:bg-[#eff1eb] hover:text-[#222720]"
      {...props}
    >
      {children}
    </button>
  );
}
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-[18px] border border-dashed border-[#d7dbd2] bg-white/50 p-8 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#edf3e9] text-[#5f7752]">
          {icon}
        </div>
        <h3 className="font-display font-medium">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#747a71]">
          {body}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
