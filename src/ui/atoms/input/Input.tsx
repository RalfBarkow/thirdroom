import classNames from "classnames";

import "./Input.css";

interface IInput {
  id?: string;
  className?: string;
  name?: string;
  placeholder?: string;
  type?: "text" | "password" | "email" | "number" | "search";
  inputSize?: "sm" | "md" | "lg";
  state?: "success" | "error";
  value?: string;
  defaultValue?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: "on" | "off";
  autoFocus?: boolean;
  readonly?: boolean;
  size?: number;
  before?: React.ReactNode;
  after?: React.ReactNode;
}

export function Input({
  id,
  className,
  name,
  placeholder,
  type = "text",
  inputSize = "md",
  state,
  value,
  defaultValue,
  onChange,
  disabled,
  required,
  autoComplete = "off",
  autoFocus = false,
  readonly,
  size = 1,
  before,
  after,
}: IInput) {
  const inputClass = classNames(`Input Input--${inputSize}`, className, {
    "Input--success": state === "success",
    "Input--error": state === "error",
    "Input--disabled": disabled,
  });

  return (
    <div className={inputClass}>
      {before}
      <input
        id={id}
        name={name}
        placeholder={placeholder}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        readOnly={readonly}
        size={size}
      />
      {after}
    </div>
  );
}
