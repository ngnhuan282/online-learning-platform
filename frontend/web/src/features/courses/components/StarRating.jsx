import { useState } from 'react';

const starStyles = {
  container: {
    display: 'inline-flex',
    gap: 2,
    alignItems: 'center',
  },
  star: {
    cursor: 'default',
    fontSize: 22,
    lineHeight: 1,
    transition: 'color 0.15s, transform 0.15s',
    userSelect: 'none',
    background: 'none',
    border: 'none',
    padding: 0,
  },
  clickable: {
    cursor: 'pointer',
  },
  label: {
    marginLeft: 8,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 500,
  },
};

/**
 * StarRating — hiển thị và chọn rating 1-5 sao.
 *
 * Props:
 *   value     — rating hiện tại (0-5)
 *   onChange   — callback(newRating) khi click sao (chỉ ở mode editable)
 *   readonly   — true = chỉ hiển thị, không click được
 *   size       — font size (default 22)
 *   showLabel  — hiển thị số bên cạnh sao
 */
export default function StarRating({
  value = 0,
  onChange,
  readonly = false,
  size = 22,
  showLabel = false,
}) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue || value;

  return (
    <span style={starStyles.container}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= displayValue;
        const isEditable = !readonly && onChange;
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} sao`}
            style={{
              ...starStyles.star,
              ...(isEditable ? starStyles.clickable : {}),
              fontSize: size,
              color: filled ? '#f59e0b' : '#cbd5e1',
              transform: hoverValue === star ? 'scale(1.2)' : 'scale(1)',
            }}
            onClick={() => isEditable && onChange(star)}
            onMouseEnter={() => isEditable && setHoverValue(star)}
            onMouseLeave={() => isEditable && setHoverValue(0)}
            disabled={!isEditable}
            tabIndex={isEditable ? 0 : -1}
          >
            ★
          </button>
        );
      })}
      {showLabel && (
        <span style={starStyles.label}>
          {value > 0 ? value.toFixed(1) : '—'}
        </span>
      )}
    </span>
  );
}
