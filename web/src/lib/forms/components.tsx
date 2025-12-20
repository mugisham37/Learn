/**
 * Form Components
 * 
 * React components for form handling with validation and type safety.
 */

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface FormContextValue {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  setValue: (name: string, value: any) => void;
  setError: (name: string, error: string) => void;
  setTouched: (name: string, touched: boolean) => void;
  validateField: (name: string) => boolean;
  validateForm: () => boolean;
  resetForm: () => void;
  submitForm: () => Promise<void>;
}

export interface FormProviderProps {
  children: React.ReactNode;
  initialValues?: Record<string, any>;
  onSubmit?: (values: Record<string, any>) => Promise<void> | void;
  validate?: (values: Record<string, any>) => Record<string, string>;
}

export interface FormFieldProps {
  name: string;
  label?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export interface FormButtonProps {
  type?: 'submit' | 'button' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

// =============================================================================
// Context
// =============================================================================

const FormContext = createContext<FormContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

export function FormProvider({ 
  children, 
  initialValues = {}, 
  onSubmit,
  validate 
}: FormProviderProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouchedState] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    // Clear error when value changes
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  const setError = useCallback((name: string, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  const setTouched = useCallback((name: string, touched: boolean) => {
    setTouchedState(prev => ({ ...prev, [name]: touched }));
  }, []);

  const validateField = useCallback((name: string): boolean => {
    if (!validate) return true;
    
    const fieldErrors = validate(values);
    if (fieldErrors[name]) {
      setError(name, fieldErrors[name]);
      return false;
    }
    return true;
  }, [validate, values, setError]);

  const validateForm = useCallback((): boolean => {
    if (!validate) return true;
    
    const formErrors = validate(values);
    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  }, [validate, values]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouchedState({});
    setIsSubmitting(false);
  }, [initialValues]);

  const submitForm = useCallback(async () => {
    if (!onSubmit) return;
    
    setIsSubmitting(true);
    try {
      if (validateForm()) {
        await onSubmit(values);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit, validateForm, values]);

  const contextValue: FormContextValue = {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setError,
    setTouched,
    validateField,
    validateForm,
    resetForm,
    submitForm,
  };

  return (
    <FormContext.Provider value={contextValue}>
      {children}
    </FormContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

export function useForm(): FormContextValue {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useForm must be used within a FormProvider');
  }
  return context;
}

export function useFormField(name: string) {
  const { values, errors, touched, setValue, setTouched, validateField } = useForm();
  
  const value = values[name] || '';
  const error = errors[name];
  const isTouched = touched[name];
  const hasError = Boolean(error && isTouched);

  const handleChange = useCallback((newValue: any) => {
    setValue(name, newValue);
  }, [name, setValue]);

  const handleBlur = useCallback(() => {
    setTouched(name, true);
    validateField(name);
  }, [name, setTouched, validateField]);

  return {
    value,
    error,
    hasError,
    isTouched,
    onChange: handleChange,
    onBlur: handleBlur,
  };
}

// =============================================================================
// Form Field Component
// =============================================================================

export function FormField({ 
  name, 
  label, 
  type = 'text', 
  placeholder, 
  required, 
  disabled,
  className = '',
  children 
}: FormFieldProps) {
  const { value, error, hasError, onChange, onBlur } = useFormField(name);

  if (children) {
    // Render custom children with form field props
    return (
      <div className={`form-field ${hasError ? 'error' : ''} ${className}`}>
        {label && (
          <label htmlFor={name} className="form-label">
            {label}
            {required && <span className="required">*</span>}
          </label>
        )}
        {React.cloneElement(children as React.ReactElement, {
          id: name,
          name,
          value,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          onBlur,
          disabled,
        })}
        {hasError && <div className="form-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className={`form-field ${hasError ? 'error' : ''} ${className}`}>
      {label && (
        <label htmlFor={name} className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className="form-input"
        required={required}
      />
      {hasError && <div className="form-error">{error}</div>}
    </div>
  );
}

// =============================================================================
// Form Button Component
// =============================================================================

export function FormButton({ 
  type = 'button', 
  variant = 'primary', 
  disabled, 
  loading, 
  className = '',
  children,
  onClick 
}: FormButtonProps) {
  const { isSubmitting, submitForm } = useForm();

  const handleClick = useCallback(async () => {
    if (type === 'submit') {
      await submitForm();
    } else if (onClick) {
      onClick();
    }
  }, [type, submitForm, onClick]);

  const isDisabled = disabled || loading || (type === 'submit' && isSubmitting);

  return (
    <button
      type={type}
      className={`form-button form-button--${variant} ${className}`}
      disabled={isDisabled}
      onClick={handleClick}
    >
      {loading || (type === 'submit' && isSubmitting) ? 'Loading...' : children}
    </button>
  );
}